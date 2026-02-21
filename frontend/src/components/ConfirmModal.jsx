// ConfirmModal.jsx — Reusable confirmation modal
import { X, AlertTriangle } from 'lucide-react'

export default function ConfirmModal({ title, message, confirmText, cancelText, onConfirm, onCancel, isDestructive }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={e => e.target === e.currentTarget && onCancel()}>
            <div className="surface rounded-xl w-full max-w-sm shadow-2xl overflow-hidden"
                style={{ background: 'var(--color-surface)' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-base">
                    <h2 className="font-semibold text-sm flex items-center gap-2"
                        style={{ color: isDestructive ? 'var(--color-error, #f87171)' : 'var(--color-text)' }}>
                        {isDestructive && <AlertTriangle size={16} />}
                        {title}
                    </h2>
                    <button onClick={onCancel} className="btn-ghost p-1 rounded-md">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-5 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {message}
                </div>

                {/* Footer */}
                <div className="border-t border-base px-5 py-4 flex justify-end gap-3">
                    <button onClick={onCancel} className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                        style={{ color: 'var(--color-text)' }}>
                        {cancelText || 'Cancel'}
                    </button>
                    <button onClick={onConfirm} className="px-4 py-2 rounded-md text-sm font-medium transition-colors text-white"
                        style={{ background: isDestructive ? 'var(--color-error, #f87171)' : 'var(--color-accent)' }}>
                        {confirmText || 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    )
}
