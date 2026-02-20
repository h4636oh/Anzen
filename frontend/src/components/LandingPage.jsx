// LandingPage.jsx — Entry point: Chat or Clear Chat
import { useState } from 'react'
import { Sun, Moon, Shield, ArrowRight, Trash2 } from 'lucide-react'

export default function LandingPage({ onEnterChat, onClearChat, theme, onToggleTheme }) {
    const [confirmClear, setConfirmClear] = useState(false)

    function handleClear() {
        if (confirmClear) {
            onClearChat()
            setConfirmClear(false)
        } else {
            setConfirmClear(true)
        }
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4"
            style={{ background: 'var(--color-bg)' }}>

            {/* Theme toggle */}
            <button onClick={onToggleTheme}
                className="absolute top-5 right-5 btn-ghost rounded-full p-2"
                title="Toggle theme">
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Card */}
            <div className="surface rounded-xl p-8 w-full max-w-sm flex flex-col items-center gap-6 shadow-lg">

                {/* Logo */}
                <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center"
                        style={{ background: 'var(--color-accent)' }}>
                        <Shield size={28} color="white" strokeWidth={2.5} />
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>
                            Anzen
                        </h1>
                        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                            Private • Encrypted • No Servers
                        </p>
                    </div>
                </div>

                {/* Tagline */}
                <p className="text-sm text-center leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                    End-to-end encrypted peer-to-peer chat. Your messages never touch a server.
                </p>

                {/* CTA */}
                <div className="w-full flex flex-col gap-3">
                    <button onClick={onEnterChat}
                        className="btn-primary w-full flex items-center justify-center gap-2 py-3 rounded-lg text-base">
                        Chat
                        <ArrowRight size={16} />
                    </button>

                    {confirmClear ? (
                        <div className="flex gap-2">
                            <button onClick={handleClear}
                                className="flex-1 py-2 text-sm font-semibold rounded-lg border transition-all duration-150"
                                style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}>
                                Confirm Clear
                            </button>
                            <button onClick={() => setConfirmClear(false)}
                                className="flex-1 btn-ghost rounded-lg border border-base">
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <button onClick={handleClear}
                            className="btn-ghost w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-base text-sm">
                            <Trash2 size={14} />
                            Clear Chat
                        </button>
                    )}
                </div>

                {/* Footer */}
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    <span className="text-accent font-medium">安全</span> · Anzen means "safety" in Japanese
                </p>
            </div>
        </div>
    )
}
