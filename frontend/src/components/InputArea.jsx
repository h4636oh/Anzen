// InputArea.jsx — Text input with emoji, file attachment, camera, and send
import { useRef, useState } from 'react'
import { Paperclip, Send, X, Camera } from 'lucide-react'
import CameraCapture from './CameraCapture.jsx'

export default function InputArea({ onSendText, onSendFile, disabled }) {
    const [text, setText] = useState('')
    const [pendingFile, setPendingFile] = useState(null)
    const [showCamera, setShowCamera] = useState(false)
    const fileRef = useRef()

    function handleSubmit(e) {
        e.preventDefault()
        if (pendingFile) {
            onSendFile(pendingFile, text.trim())
            setPendingFile(null)
            setText('')
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

    function handleCameraCapture(file) {
        setPendingFile(file)
        setShowCamera(false)
    }

    return (
        <form onSubmit={handleSubmit}
            className="flex items-center gap-2 px-4 py-3 border-t border-base relative"
            style={{ background: 'var(--color-surface)', height: '72px' }}>

            {showCamera && (
                <CameraCapture
                    onCapture={handleCameraCapture}
                    onClose={() => setShowCamera(false)}
                />
            )}

            {pendingFile && (
                <div className="absolute left-4 bottom-full mb-3 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-base shadow-lg z-10 max-w-sm"
                    style={{ background: 'var(--color-surface)' }}>
                    <span className="truncate text-sm font-medium" style={{ color: 'var(--color-text)' }}>{pendingFile.name}</span>
                    <button type="button" onClick={() => setPendingFile(null)} className="p-0.5 hover:bg-black/10 rounded-full transition-colors flex-shrink-0">
                        <X size={14} style={{ color: 'var(--color-text-muted)' }} />
                    </button>
                </div>
            )}

            {/* Left area: always flex-1 so buttons stay pinned to the right */}
            <div className="flex-1 flex items-center min-w-0">
                <textarea
                    className="input-field w-full resize-none text-sm leading-relaxed"
                    rows={1}
                    placeholder={disabled ? 'Connect to a room to chat…' : (pendingFile ? 'Add a caption…' : 'Message')}
                    value={text}
                    disabled={disabled}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    style={{ maxHeight: 120, overflowY: 'auto' }}
                />
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

            {/* Camera */}
            <button type="button"
                className="btn-ghost !p-0 rounded-lg border border-base flex-shrink-0 self-stretch aspect-square flex items-center justify-center"
                disabled={disabled}
                onClick={() => setShowCamera(true)}
                title="Take photo or video">
                <Camera size={16} />
            </button>

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
