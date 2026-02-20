// MessageBubble.jsx — A single message row, collapsing avatar/name for consecutive same-sender messages
import Avatar from './Avatar.jsx'
import { isMedia } from '../utils/fileTransfer.js'
import { Download, FileText } from 'lucide-react'

/**
 * Props:
 *   msg         — message object
 *   isOwn       — boolean, true if sent by local user
 *   showHeader  — boolean, show avatar + name (false if same sender as previous)
 */
export default function MessageBubble({ msg, isOwn, showHeader }) {
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    return (
        <div className={`flex gap-2 px-4 ${showHeader ? 'mt-3' : 'mt-0.5'} ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar — only show on first message in a sequence */}
            <div className="flex-shrink-0" style={{ width: 32 }}>
                {showHeader && !isOwn && (
                    <Avatar seed={msg.avatarSeed} username={msg.senderName} size={32} />
                )}
            </div>

            {/* Content */}
            <div className={`flex flex-col flex-1 ${isOwn ? 'items-end' : 'items-start'}`}>
                {showHeader && (
                    <p className="text-xs font-medium mb-1" style={{ color: isOwn ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                        {isOwn ? 'You' : msg.senderName}
                    </p>
                )}

                {msg.type === 'text' && (
                    <div className="max-w-xs lg:max-w-md">
                        <div className={`px-3 py-2 rounded-xl text-sm leading-relaxed break-words ${isOwn ? 'rounded-tr-sm' : 'rounded-tl-sm'
                            }`}
                            style={{
                                background: isOwn ? 'var(--color-accent)' : 'var(--color-surface-2)',
                                color: isOwn ? 'white' : 'var(--color-text)',
                            }}>
                            {msg.text}
                        </div>
                    </div>
                )}

                {(msg.type === 'media') && (
                    <div className="max-w-xs lg:max-w-md">
                        {msg.mimeType?.startsWith('image/') && (
                            <img src={msg.objectUrl} alt={msg.fileName}
                                className="rounded-xl max-w-full border border-base"
                                style={{ maxHeight: 280, objectFit: 'cover' }} />
                        )}
                        {msg.mimeType?.startsWith('video/') && (
                            <video src={msg.objectUrl} controls
                                className="rounded-xl max-w-full border border-base"
                                style={{ maxHeight: 280 }} />
                        )}
                    </div>
                )}

                {msg.type === 'file' && (
                    <a href={msg.objectUrl} download={msg.fileName}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-base surface text-sm hover:opacity-80 transition-opacity">
                        <FileText size={16} style={{ color: 'var(--color-accent)' }} />
                        <span className="truncate max-w-xs" style={{ color: 'var(--color-text)' }}>{msg.fileName}</span>
                        <Download size={14} style={{ color: 'var(--color-text-muted)' }} />
                    </a>
                )}

                <span className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{time}</span>
            </div>
        </div>
    )
}
