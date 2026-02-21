// ChatWindow.jsx — Main chat area with header, message list, and input
import { useEffect, useRef, useState } from 'react'
import { Hash, Users, Lock, AlertCircle, RefreshCw, Loader, Menu } from 'lucide-react'
import MessageBubble from './MessageBubble.jsx'
import DateSeparator from './DateSeparator.jsx'
import InputArea from './InputArea.jsx'
import AboutRoomModal from './AboutRoomModal.jsx'
import Avatar from './Avatar.jsx'

export default function ChatWindow({ room, messages, peers, localUser, connectionStatus, wsError, onSendText, onSendFile, onOpenSidebar }) {
    const [showAbout, setShowAbout] = useState(false)
    const bottomRef = useRef(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const connected = connectionStatus === 'connected'
    const failed = connectionStatus === 'failed'
    const connecting = connectionStatus === 'connecting'

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

                <button onClick={() => setShowAbout(true)}
                    className="btn-ghost p-2 rounded-md"
                    title="About this room">
                    <Users size={15} />
                </button>
                <Lock size={13} style={{ color: 'var(--color-accent)' }} title="E2E encrypted" />
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
            <div className="flex-1 overflow-y-auto">
                <div className="min-h-full flex flex-col justify-end py-2">
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
            />

            {showAbout && (
                <AboutRoomModal room={room} peers={peers} onClose={() => setShowAbout(false)} />
            )}
        </div>
    )
}
