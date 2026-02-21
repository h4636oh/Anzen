// InputArea.jsx — Text input with emoji, file attachment, and send
import { useRef, useState } from 'react'
import { Paperclip, Send, X } from 'lucide-react'

export default function InputArea({ onSendText, onSendFile, disabled }) {
    const [text, setText] = useState('')
    const [pendingFile, setPendingFile] = useState(null)
    const fileRef = useRef()

    function handleSubmit(e) {
        e.preventDefault()
        if (pendingFile) {
            onSendFile(pendingFile)
            setPendingFile(null)
        } else if (text.trim()) {
            onSendText(text.trim())
            setText('')
        }
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit(e)
        }
    }

    function handleFileChange(e) {
        const file = e.target.files?.[0]
        if (file) setPendingFile(file)
        e.target.value = ''
    }

    return (
        <form onSubmit={handleSubmit}
            className="flex items-stretch gap-2 px-4 py-3 border-t border-base"
            style={{ background: 'var(--color-surface)', height: '72px' }}>

            {/* Left area: always flex-1 so buttons stay pinned to the right */}
            <div className="flex-1 flex items-center min-w-0">
                {pendingFile ? (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-base surface-2 text-xs max-w-xs truncate"
                        style={{ color: 'var(--color-text)' }}>
                        <span className="truncate">{pendingFile.name}</span>
                        <button type="button" onClick={() => setPendingFile(null)} className="flex-shrink-0">
                            <X size={12} style={{ color: 'var(--color-text-muted)' }} />
                        </button>
                    </div>
                ) : (
                    <textarea
                        className="input-field w-full resize-none text-sm leading-relaxed"
                        rows={1}
                        placeholder={disabled ? 'Connect to a room to chat…' : 'Message'}
                        value={text}
                        disabled={disabled}
                        onChange={e => setText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        style={{ maxHeight: 120, overflowY: 'auto' }}
                    />
                )}
            </div>

            {/* Attach */}
            <button type="button"
                className="btn-ghost !p-0 rounded-lg border border-base flex-shrink-0 self-stretch aspect-square flex items-center justify-center"
                disabled={disabled}
                onClick={() => fileRef.current?.click()}
                title="Attach file">
                <Paperclip size={16} />
            </button>
            <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} multiple={false} />

            {/* Send */}
            <button type="submit"
                disabled={disabled || (!text.trim() && !pendingFile)}
                className="rounded-lg flex-shrink-0 self-stretch aspect-square flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-40"
                style={{ background: 'var(--color-accent)', color: 'white' }}>
                <Send size={16} />
            </button>
        </form>
    )
}
