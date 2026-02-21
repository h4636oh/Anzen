// LandingPage.jsx — Entry point: Chat or Clear Chat
import { useState } from 'react'
import { Sun, Moon, Shield, ArrowRight, Trash2, KeyRound, X, Eye, EyeOff } from 'lucide-react'
import { hashPassword } from '../utils/crypto.js'

export default function LandingPage({ onEnterChat, onClearChat, theme, onToggleTheme, appPasswordHash, onSaveAppPassword }) {
    const [confirmClear, setConfirmClear] = useState(false)
    const [authMode, setAuthMode] = useState(null) // 'create' | 'enter' | null
    const [passwordInput, setPasswordInput] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [authError, setAuthError] = useState('')

    function handleClear() {
        if (confirmClear) {
            onClearChat()
            setConfirmClear(false)
        } else {
            setConfirmClear(true)
        }
    }

    function handleChatClick() {
        if (!appPasswordHash) {
            setAuthMode('create')
            setPasswordInput('')
            setShowPassword(false)
            setAuthError('')
        } else if (appPasswordHash === 'SKIP') {
            onEnterChat('SKIP')
        } else {
            setAuthMode('enter')
            setPasswordInput('')
            setShowPassword(false)
            setAuthError('')
        }
    }

    async function handleAuthSubmit(e) {
        e.preventDefault()
        setAuthError('')

        if (authMode === 'create') {
            if (!passwordInput.trim()) {
                setAuthError('Password cannot be empty.')
                return
            }
            const hash = await hashPassword(passwordInput)
            await onSaveAppPassword(hash)
            onEnterChat(passwordInput)
        } else if (authMode === 'enter') {
            const hash = await hashPassword(passwordInput)
            if (hash === appPasswordHash) {
                onEnterChat(passwordInput)
            } else {
                setAuthError('Incorrect password.')
            }
        }
    }

    async function handleSkipPassword() {
        await onSaveAppPassword('SKIP')
        onEnterChat('SKIP')
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
                    <button onClick={handleChatClick}
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

            {/* Auth Modal */}
            {authMode && (
                <div className="absolute inset-0 z-50 flex items-center justify-center px-4"
                    style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(2px)' }}>
                    <div className="surface w-full max-w-sm rounded-xl p-6 shadow-2xl relative">
                        <button onClick={() => setAuthMode(null)}
                            className="absolute top-4 right-4 text-base p-1 hover:opacity-75 transition-opacity"
                            style={{ color: 'var(--color-text-muted)' }}>
                            <X size={18} />
                        </button>

                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                                style={{ background: 'var(--color-surface-hover)' }}>
                                <KeyRound size={20} style={{ color: 'var(--color-accent)' }} />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">
                                    {authMode === 'create' ? 'App Password' : 'Enter Password'}
                                </h3>
                                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                    {authMode === 'create'
                                        ? 'Protect your local chat data.'
                                        : 'Unlock your chat application.'}
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4">
                            {authMode === 'create' && (
                                <div className="text-xs p-3 rounded-lg border leading-relaxed"
                                    style={{
                                        borderColor: 'var(--color-border)',
                                        background: 'var(--color-bg)',
                                        color: 'var(--color-text-muted)'
                                    }}>
                                    Your password will encrypt your local messages.
                                    <br />
                                    <span className="font-semibold" style={{ color: 'var(--color-accent)' }}>
                                        If skipped, your data is stored in plaintext.
                                    </span>
                                </div>
                            )}
                            <div>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={passwordInput}
                                        onChange={(e) => setPasswordInput(e.target.value)}
                                        placeholder="Enter password"
                                        autoFocus
                                        className="w-full pl-4 pr-10 py-2 bg-transparent border rounded-lg focus:outline-none focus:ring-1 transition-all"
                                        style={{
                                            borderColor: 'var(--color-border)',
                                            color: 'var(--color-text)',
                                            '--tw-ring-color': 'var(--color-accent)'
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center transition-opacity hover:opacity-80"
                                        style={{ color: 'var(--color-text-muted)' }}
                                        title={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                {authError && (
                                    <p className="text-xs mt-2 text-red-500 font-medium">{authError}</p>
                                )}
                            </div>

                            <div className="flex gap-2 mt-2">
                                <button type="submit"
                                    className="flex-1 btn-primary py-2 rounded-lg text-sm font-semibold">
                                    {authMode === 'create' ? 'Save & Continue' : 'Unlock'}
                                </button>
                                {authMode === 'create' && (
                                    <button type="button" onClick={handleSkipPassword}
                                        className="flex-1 btn-ghost py-2 rounded-lg border border-base text-sm font-medium">
                                        Skip
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
