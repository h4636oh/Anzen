import { useState, useEffect } from 'react'
import { Shield, KeyRound } from 'lucide-react'
import { hashPassword } from '../utils/crypto.js'

export default function LockScreen({ appPasswordHash, onUnlock }) {
    const [passwordInput, setPasswordInput] = useState('')
    const [error, setError] = useState('')

    // Prevent body scroll when locked
    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')

        const hash = await hashPassword(passwordInput)
        if (hash === appPasswordHash) {
            onUnlock()
        } else {
            setError('Incorrect password.')
            setPasswordInput('') // clear input on error
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md"
            style={{ background: 'rgba(0, 0, 0, 0.85)' }}>
            <div className="surface rounded-2xl p-8 w-full max-w-sm flex flex-col items-center gap-6 shadow-2xl border"
                style={{ borderColor: 'var(--color-border)' }}>

                {/* Logo and Status */}
                <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
                        style={{ background: 'var(--color-accent)' }}>
                        <Shield size={32} color="white" strokeWidth={2.5} />
                    </div>
                    <div className="text-center mt-2">
                        <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>
                            App Locked
                        </h2>
                        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                            Inactivity timeout reached.
                        </p>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <KeyRound size={16} strokeWidth={2.5} style={{ color: 'var(--color-text-muted)' }} />
                        </div>
                        <input
                            type="password"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            placeholder="Enter password"
                            autoFocus
                            className="w-full pl-10 pr-4 py-3 bg-transparent border rounded-xl focus:outline-none focus:ring-2 transition-all font-mono"
                            style={{
                                borderColor: 'var(--color-border)',
                                color: 'var(--color-text)',
                                '--tw-ring-color': 'var(--color-accent)'
                            }}
                        />
                    </div>
                    {error && (
                        <p className="text-sm text-red-500 font-medium text-center animate-pulse">{error}</p>
                    )}

                    <button type="submit"
                        className="btn-primary w-full py-3 rounded-xl text-base font-semibold shadow-md mt-2 flex items-center justify-center gap-2">
                        Unlock
                    </button>
                </form>
            </div>
        </div>
    )
}
