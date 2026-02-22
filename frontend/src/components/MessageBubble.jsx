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
export default function MessageBubble({ msg, isOwn, showHeader, showTime, onMediaLoad }) {
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    return (
        <div className={`flex gap-2 px-2 md:px-4 ${showHeader ? 'mt-3' : 'mt-0.5'} ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar / spacer */}
            <div className="flex-shrink-0" style={{ width: isOwn ? 8 : 24 }}>
                {!isOwn && showHeader && (
                    <Avatar seed={msg.avatarSeed} username={msg.senderName} size={24} />
                )}
            </div>

            {/* Content */}
            <div className={`flex flex-col flex-1 min-w-0 ${isOwn ? 'items-end' : 'items-start'}`}>
                {showHeader && (
                    <p className="text-xs font-medium mb-1" style={{ color: isOwn ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                        {isOwn ? 'You' : msg.senderName}
                    </p>
                )}

                {msg.type === 'text' && (
                    <div style={{ maxWidth: 'min(90%, 24rem)' }}>
                        <div className={`px-3 py-2 rounded-xl text-sm leading-relaxed break-words overflow-hidden`}
                            style={{
                                background: isOwn ? 'var(--color-accent)' : 'var(--color-surface-2)',
                                color: isOwn ? 'white' : 'var(--color-text)',
                            }}>
                            {msg.text}
                        </div>
                    </div>
                )}

                {(msg.type === 'media') && (
                    <div className="max-w-xs lg:max-w-md flex flex-col rounded-xl overflow-hidden border border-base"
                        style={{
                            background: isOwn ? 'var(--color-accent)' : 'var(--color-surface-2)',
                        }}>
                        {msg.mimeType?.startsWith('image/') && (
                            <img src={msg.objectUrl} alt={msg.fileName}
                                onLoad={onMediaLoad}
                                className="w-full object-cover"
                                style={{ maxHeight: 280, display: 'block' }} />
                        )}
                        {msg.mimeType?.startsWith('video/') && (
                            <video src={msg.objectUrl} controls
                                onLoadedData={onMediaLoad}
                                className="w-full object-cover"
                                style={{ maxHeight: 280, display: 'block' }} />
                        )}
                        {msg.caption && (
                            <div className="px-3 py-2 text-sm leading-relaxed break-words"
                                style={{ color: isOwn ? 'white' : 'var(--color-text)' }}>
                                {msg.caption}
                            </div>
                        )}
                    </div>
                )}

                {msg.type === 'file' && (
                    <div className="max-w-xs lg:max-w-md flex flex-col rounded-xl overflow-hidden border border-base"
                        style={{
                            background: isOwn ? 'var(--color-accent)' : 'var(--color-surface-2)',
                        }}>
                        <a href={msg.objectUrl} download={msg.fileName}
                            className="flex items-center gap-2 px-3 py-2 text-sm hover:opacity-80 transition-opacity"
                            style={{
                                color: isOwn ? 'white' : 'var(--color-text)',
                                background: 'rgba(0,0,0,0.1)'
                            }}>
                            <FileText size={16} />
                            <span className="truncate flex-1 min-w-0 max-w-xs">{msg.fileName}</span>
                            <Download size={14} flexShrink={0} />
                        </a>
                        {msg.caption && (
                            <div className="px-3 py-2 text-sm leading-relaxed break-words border-t border-base"
                                style={{ color: isOwn ? 'white' : 'var(--color-text)' }}>
                                {msg.caption}
                            </div>
                        )}
                    </div>
                )}

                {showTime && (
                    <span className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{time}</span>
                )}
            </div>
        </div>
    )
}
