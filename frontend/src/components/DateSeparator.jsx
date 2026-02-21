// DateSeparator.jsx — Date divider shown between messages from different days
export default function DateSeparator({ date }) {
    const label = formatDate(date)

    return (
        <div className="flex items-center gap-3 px-4 my-3">
            <div className="flex-1 h-px" style={{ background: 'var(--color-border, #e5e7eb)' }} />
            <span
                className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                style={{
                    background: 'var(--color-surface-2)',
                    color: 'var(--color-text-muted)',
                }}
            >
                {label}
            </span>
            <div className="flex-1 h-px" style={{ background: 'var(--color-border, #e5e7eb)' }} />
        </div>
    )
}

function formatDate(date) {
    const now = new Date()
    const d = new Date(date)

    const toMidnight = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
    const diffDays = Math.round((toMidnight(now) - toMidnight(d)) / 86400000)

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'

    return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: diffDays > 365 ? 'numeric' : undefined })
}
