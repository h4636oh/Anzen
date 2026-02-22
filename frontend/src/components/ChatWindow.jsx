// ChatWindow.jsx — Main chat area with header, message list, and input
import { useEffect, useRef, useState, useLayoutEffect, useCallback } from 'react'
import { Hash, Users, Lock, LogOut, AlertCircle, RefreshCw, Loader, Menu } from 'lucide-react'
import MessageBubble from './MessageBubble.jsx'
import DateSeparator from './DateSeparator.jsx'
import InputArea from './InputArea.jsx'
import AboutRoomModal from './AboutRoomModal.jsx'
import Avatar from './Avatar.jsx'

export default function ChatWindow({ room, messages, peers, localUser, connectionStatus, wsError, onSendText, onSendFile, onOpenSidebar, onLeaveRoom, onLoadMore, allLoaded, loadingMore, theme }) {
    const [showAbout, setShowAbout] = useState(false)
    const bottomRef = useRef(null)
    const scrollContainerRef = useRef(null)
    const topSentinelRef = useRef(null)
    // Track previous message count to know if messages were prepended (not appended)
    const prevMsgCountRef = useRef(0)
    // Snapshot scroll anchor before a prepend so we can restore it
    const scrollAnchorRef = useRef(null)

    const connected = connectionStatus === 'connected'
    const failed = connectionStatus === 'failed'
    const connecting = connectionStatus === 'connecting'

    // ── Scroll to bottom only when a NEW message arrives at the end ──────────────
    useEffect(() => {
        const container = scrollContainerRef.current
        if (!container) return
        const prevCount = prevMsgCountRef.current
        const newCount = messages.length

        if (newCount > prevCount) {
            const diff = newCount - prevCount
            const wasPrepend = scrollAnchorRef.current !== null

            if (!wasPrepend) {
                // Message(s) appended (new real-time or initial load) → scroll to bottom
                bottomRef.current?.scrollIntoView({ behavior: prevCount === 0 ? 'instant' : 'smooth' })
            }
            // Prepend case is handled in the layout effect below
        }
        prevMsgCountRef.current = newCount
    }, [messages])

    // ── Restore scroll position after older messages are prepended ───────────────
    useLayoutEffect(() => {
        if (scrollAnchorRef.current === null) return
        const container = scrollContainerRef.current
        if (!container) return
        // New scrollHeight minus old scrollHeight = height of newly prepended content
        const delta = container.scrollHeight - scrollAnchorRef.current
        container.scrollTop += delta
        scrollAnchorRef.current = null
    }, [messages])

    // ── IntersectionObserver on the top sentinel ─────────────────────────────────
    const handleLoadMore = useCallback(() => {
        if (allLoaded || loadingMore) return
        // Snapshot the scroll height RIGHT before the state update so useLayoutEffect can restore
        const container = scrollContainerRef.current
        if (container) scrollAnchorRef.current = container.scrollHeight
        onLoadMore()
    }, [allLoaded, loadingMore, onLoadMore])

    useEffect(() => {
        const sentinel = topSentinelRef.current
        if (!sentinel) return
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) handleLoadMore() },
            { root: scrollContainerRef.current, threshold: 0.1 }
        )
        observer.observe(sentinel)
        return () => observer.disconnect()
    }, [handleLoadMore])

    // Status dot color
    const dotColor = connected ? '#22c55e' : connecting ? '#eab308' : '#ef4444'

    // Human-readable status label
    const statusLabel = connected
        ? `${peers.length} peer${peers.length !== 1 ? 's' : ''} connected`
        : connecting ? 'Connecting…'
            : failed ? 'Connection failed'
                : 'Not connected'

    return (
        <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--color-bg)' }}>

            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-base"
                style={{ background: 'var(--color-surface)' }}>
                {/* Hamburger — mobile only */}
                <button
                    onClick={onOpenSidebar}
                    className="btn-ghost p-2 rounded-md md:hidden flex-shrink-0"
                    title="Open sidebar"
                >
                    <Menu size={18} />
                </button>
                <div className="w-8 h-8 rounded-lg flex-shrink-0 items-center justify-center hidden md:flex"
                    style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)' }}>
                    <Hash size={16} style={{ color: 'var(--color-accent)' }} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-text)' }}>
                        {room?.roomName || 'Select a room'}
                    </p>
                    <div className="flex items-center gap-1.5">
                        {connecting
                            ? <Loader size={10} className="animate-spin" style={{ color: dotColor }} />
                            : <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                        }
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{statusLabel}</p>
                    </div>
                </div>

                {/* Peer avatars strip */}
                <div className="flex -space-x-2 mr-2">
                    {peers.slice(0, 3).map(peer => (
                        <Avatar key={peer.id} seed={peer.avatarSeed} username={peer.username} size={26} />
                    ))}
                    {peers.length > 3 && (
                        <div className="w-[26px] h-[26px] rounded-lg flex items-center justify-center text-xs font-bold"
                            style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '2px solid var(--color-surface)' }}>
                            +{peers.length - 3}
                        </div>
                    )}
                </div>

                <button onClick={() => onLeaveRoom(room?.roomName)}
                    className="btn-ghost p-2 rounded-md hover:text-red-500 transition-colors"
                    title="Leave room">
                    <LogOut size={15} />
                </button>
                <button onClick={() => setShowAbout(true)}
                    className="btn-ghost p-2 rounded-md"
                    title="About this room">
                    <Users size={15} />
                </button>
            </div>

            {/* Error banner */}
            {(failed || wsError) && (
                <div className="flex items-start gap-3 px-4 py-3 border-b border-base"
                    style={{ background: 'color-mix(in srgb, #ef4444 10%, transparent)', borderColor: 'color-mix(in srgb, #ef4444 30%, transparent)' }}>
                    <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>Connection Failed</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                            {wsError || 'Could not connect to the signaling server.'}
                        </p>
                        {wsError?.includes('Invalid room') && (
                            <p className="text-xs mt-1 font-medium" style={{ color: 'var(--color-text-muted)' }}>
                                💡 This room might not exist in the backend database yet. Use the sidebar Create panel to recreate it with the same name and password.
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Messages */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
                <div className="min-h-full flex flex-col justify-end py-2">

                    {/* Top sentinel — triggers load more when scrolled into view */}
                    <div ref={topSentinelRef} style={{ height: 1 }} />

                    {/* Load more indicator */}
                    {messages.length > 0 && (
                        <div className="flex items-center justify-center py-2">
                            {loadingMore ? (
                                <Loader size={14} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
                            ) : allLoaded ? (
                                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>All messages loaded</span>
                            ) : null}
                        </div>
                    )}

                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center flex-1 gap-3 px-4">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                                style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' }}>
                                <Lock size={22} style={{ color: 'var(--color-accent)' }} />
                            </div>
                            <p className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
                                {failed
                                    ? 'Connection failed — see the error above.'
                                    : connected
                                        ? 'Messages are end-to-end encrypted. Say hello! 👋'
                                        : 'Waiting to connect…'
                                }
                            </p>
                        </div>
                    )}

                    {messages.map((msg, idx) => {
                        const prev = messages[idx - 1]
                        const next = messages[idx + 1]
                        const showHeader = !prev || prev.senderId !== msg.senderId
                        const msgMinute = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        const nextMinute = next ? new Date(next.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null
                        const showTime = !next || next.senderId !== msg.senderId || nextMinute !== msgMinute
                        const isOwn = msg.senderId === localUser?.peerId
                        const msgDay = new Date(msg.timestamp).toDateString()
                        const prevDay = prev ? new Date(prev.timestamp).toDateString() : null
                        const showDate = !prev || prevDay !== msgDay
                        return (
                            <>
                                {showDate && <DateSeparator key={`date-${msg.id}`} date={msg.timestamp} />}
                                <MessageBubble key={msg.id} msg={msg} isOwn={isOwn} showHeader={showHeader} showTime={showTime} />
                            </>
                        )
                    })}
                    <div ref={bottomRef} />
                </div>
            </div>

            {/* Input */}
            <InputArea
                onSendText={onSendText}
                onSendFile={onSendFile}
                disabled={!connected}
                theme={theme}
            />

            {showAbout && (
                <AboutRoomModal room={room} peers={peers} onClose={() => setShowAbout(false)} />
            )}
        </div>
    )
}
