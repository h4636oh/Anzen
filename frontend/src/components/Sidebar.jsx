// Sidebar.jsx — Left navigation: rooms list + user profile (with drag-to-resize & mobile overlay)
import { useState, useRef, useCallback } from 'react'
import { Plus, Hash, Shield, LogOut, Trash2, Sun, Moon, X } from 'lucide-react'
import { generateRoomName } from '../utils/generators.js'
import Avatar from './Avatar.jsx'

const MIN_WIDTH = 200
const MAX_WIDTH = 480

export default function Sidebar({
    user,
    rooms,
    activeRoom,
    onSelectRoom,
    onJoinRoom,
    onLeaveRoom,
    onGoToLanding,
    theme,
    onToggleTheme,
    width,
    onWidthChange,
    isOpen,
    onClose,
}) {
    const [showJoinPanel, setShowJoinPanel] = useState(false)
    const [roomInput, setRoomInput] = useState('')
    const [passInput, setPassInput] = useState('')
    const [isCreating, setIsCreating] = useState(false)
    const [formError, setFormError] = useState('')
    const dragging = useRef(false)

    // ── Validation (mirrors backend Pydantic constraints) ─────────────────────────
    const ROOM_PATTERN = /^[a-z0-9-]+$/
    function validateForm(room, pass) {
        const r = room.trim().toLowerCase()
        const p = pass.trim()
        if (r.length < 3) return 'Room name must be at least 3 characters.'
        if (r.length > 128) return 'Room name must be 128 characters or fewer.'
        if (!ROOM_PATTERN.test(r)) return 'Room name can only contain lowercase letters, numbers, and hyphens.'
        if (p.length < 8) return 'Password must be at least 8 characters.'
        if (p.length > 128) return 'Password must be 128 characters or fewer.'
        return ''
    }

    // ── Resize drag handle (desktop only) ────────────────────────────────────────
    const onMouseDown = useCallback((e) => {
        e.preventDefault()
        dragging.current = true
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'

        const onMove = (ev) => {
            if (!dragging.current) return
            const newW = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, ev.clientX))
            onWidthChange(newW)
        }
        const onUp = () => {
            dragging.current = false
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
    }, [onWidthChange])

    function handleGenerateRoom() {
        setRoomInput(generateRoomName())
    }

    function handleSubmit(e) {
        e.preventDefault()
        const error = validateForm(roomInput, passInput)
        if (error) { setFormError(error); return }
        setFormError('')
        onJoinRoom(roomInput.trim().toLowerCase(), passInput.trim(), isCreating)
        setRoomInput('')
        setPassInput('')
        setShowJoinPanel(false)
        onClose?.() // close sidebar on mobile after joining
    }

    function handleSelectRoom(roomName) {
        onSelectRoom(roomName)
        onClose?.() // close sidebar on mobile after selecting a room
    }

    return (
        <>
            {/* Mobile backdrop overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-30 md:hidden"
                    style={{ background: 'rgba(0,0,0,0.5)' }}
                    onClick={onClose}
                />
            )}

            {/*
              Wrapper reserves flex space on desktop only (md+).
              On mobile it collapses to zero width so the sidebar overlay
              doesn't push any content aside.
            */}
            <div
                className="flex-shrink-0 hidden md:block"
                style={{ width, minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH }}
            />

            <aside
                className={[
                    // On mobile: fixed overlay (out of flow, no space reserved)
                    // On desktop (md+): relative, in-flow
                    'fixed top-0 left-0 h-full flex flex-col border-r border-base z-40',
                    'transition-transform duration-300 ease-in-out',
                    'md:translate-x-0',
                    isOpen ? 'translate-x-0' : '-translate-x-full',
                ].join(' ')}
                style={{
                    background: 'var(--color-surface)',
                    width,
                    minWidth: MIN_WIDTH,
                    maxWidth: MAX_WIDTH,
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-base">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: 'var(--color-accent)' }}>
                            <Shield size={16} color="white" strokeWidth={2.5} />
                        </div>
                        <span className="font-bold text-base" style={{ color: 'var(--color-text)' }}>Anzen</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={onToggleTheme} className="btn-ghost p-2 rounded-md" title="Toggle theme">
                            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                        </button>
                        <button onClick={() => { setShowJoinPanel(v => !v); setFormError(''); setRoomInput(''); setPassInput('') }}
                            className="btn-ghost p-2 rounded-md" title="Join or create room">
                            <Plus size={16} className={`transition-transform duration-300 ${showJoinPanel ? 'rotate-45' : ''}`} style={{ color: showJoinPanel ? 'var(--color-accent)' : undefined }} />
                        </button>
                        {/* Close button — mobile only */}
                        <button
                            onClick={onClose}
                            className="btn-ghost p-2 rounded-md md:hidden"
                            title="Close sidebar"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Join / Create panel */}
                <div
                    className={`transition-all duration-300 ease-in-out overflow-hidden ${showJoinPanel ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'}`}
                >
                    <form onSubmit={handleSubmit} className="px-3 py-3 border-b border-base flex flex-col gap-2">
                        <div className="relative flex surface-2 rounded-md p-0.5">
                            {/* Sliding red indicator */}
                            <div
                                className="absolute top-0.5 bottom-0.5 rounded shadow-sm transition-all duration-300 ease-out"
                                style={{
                                    width: 'calc(50% - 0.125rem)',
                                    left: isCreating ? 'calc(50% + 0.125rem)' : '0.125rem',
                                    background: 'var(--color-accent)'
                                }}
                            />
                            <button type="button"
                                onClick={() => setIsCreating(false)}
                                className={`flex-1 relative z-10 text-sm py-1.5 rounded transition-all font-medium outline-none ${!isCreating ? 'text-white' : 'opacity-60 hover:opacity-100'}`}>
                                Join
                            </button>
                            <button type="button"
                                onClick={() => setIsCreating(true)}
                                className={`flex-1 relative z-10 text-sm py-1.5 rounded transition-all font-medium outline-none ${isCreating ? 'text-white' : 'opacity-60 hover:opacity-100'}`}>
                                Create
                            </button>
                        </div>
                        <div className="flex gap-1.5">
                            <input className="input-field flex-1 text-sm py-2"
                                placeholder="room-name"
                                value={roomInput}
                                maxLength={128}
                                onChange={e => { setRoomInput(e.target.value); setFormError('') }} />
                            {isCreating && (
                                <button type="button" onClick={handleGenerateRoom}
                                    className="btn-ghost !py-0 !px-2.5 self-stretch text-base border border-base rounded flex items-center justify-center"
                                    title="Generate room name">
                                    ⚄
                                </button>
                            )}
                        </div>
                        <input className="input-field text-sm py-2"
                            placeholder="password"
                            type="password"
                            value={passInput}
                            maxLength={128}
                            onChange={e => { setPassInput(e.target.value); setFormError('') }} />
                        {formError && (
                            <p className="text-xs px-0.5" style={{ color: 'var(--color-error, #f87171)' }}>
                                {formError}
                            </p>
                        )}
                        <button type="submit" className="btn-primary text-sm py-2 rounded-md">
                            {isCreating ? 'Create Room' : 'Join Room'}
                        </button>
                    </form>
                </div>

                {/* Rooms list */}
                <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-0.5">
                    <p className="text-xs font-semibold tracking-wider px-2 py-1.5" style={{ color: 'var(--color-text-muted)' }}>
                        ROOMS
                    </p>
                    {rooms.length === 0 && (
                        <p className="text-sm px-2 py-2" style={{ color: 'var(--color-text-muted)' }}>
                            No rooms yet — click + to join one.
                        </p>
                    )}
                    {rooms.map(room => (
                        <div key={room.roomName}
                            className={`sidebar-item group ${activeRoom === room.roomName ? 'active' : ''}`}
                            onClick={() => handleSelectRoom(room.roomName)}>
                            <Hash size={15} />
                            <span className="flex-1 text-sm truncate">{room.roomName}</span>
                            {activeRoom === room.roomName && (
                                <button onClick={(e) => { e.stopPropagation(); onLeaveRoom(room.roomName) }}
                                    className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-0.5 transition-opacity"
                                    title="Leave room">
                                    <Trash2 size={13} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                {/* User profile */}
                <div className="border-t border-base px-3 flex items-center gap-2.5"
                    style={{ height: '72px' }}>
                    <Avatar seed={user?.avatarSeed} username={user?.username} size={36} />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                            {user?.username || 'Loading…'}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>You</p>
                    </div>
                    <button onClick={onGoToLanding} className="btn-ghost p-1.5 rounded-md" title="Back to home">
                        <LogOut size={15} />
                    </button>
                </div>

                {/* Drag handle — desktop only */}
                <div
                    onMouseDown={onMouseDown}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize z-10 group hidden md:block"
                    title="Drag to resize"
                >
                    <div className="h-full w-0.5 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                        style={{ background: 'var(--color-accent)' }} />
                </div>
            </aside>
        </>
    )
}
