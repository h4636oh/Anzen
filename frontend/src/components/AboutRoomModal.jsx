// AboutRoomModal.jsx — Overlay showing room info and connected peers
import { X, Hash, Users, Clock, Shield } from 'lucide-react'
import Avatar from './Avatar.jsx'

export default function AboutRoomModal({ room, peers, onClose }) {
    if (!room) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="surface rounded-xl w-full max-w-sm shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-base">
                    <h2 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>About Room</h2>
                    <button onClick={onClose} className="btn-ghost p-1 rounded-md">
                        <X size={16} />
                    </button>
                </div>

                {/* Room info */}
                <div className="px-5 py-4 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)' }}>
                            <Hash size={18} style={{ color: 'var(--color-accent)' }} />
                        </div>
                        <div>
                            <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{room.roomName}</p>
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Room</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        <Clock size={12} />
                        <span>Joined {new Date(room.joinedAt).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        <Shield size={12} />
                        <span>End-to-end encrypted via WebRTC DTLS</span>
                    </div>
                </div>

                {/* Peers */}
                <div className="border-t border-base px-5 py-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Users size={13} style={{ color: 'var(--color-text-muted)' }} />
                        <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                            CONNECTED PEERS — {peers.length}
                        </p>
                    </div>
                    <div className="flex flex-col gap-2">
                        {peers.length === 0 && (
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                No peers connected yet. Share the room name and password.
                            </p>
                        )}
                        {peers.map(peer => (
                            <div key={peer.id} className="flex items-center gap-2">
                                <Avatar seed={peer.avatarSeed} username={peer.username} size={28} />
                                <span className="text-sm" style={{ color: 'var(--color-text)' }}>{peer.username}</span>
                                <span className="ml-auto text-xs px-1.5 py-0.5 rounded"
                                    style={{ background: 'color-mix(in srgb, #22c55e 15%, transparent)', color: '#22c55e' }}>
                                    online
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
