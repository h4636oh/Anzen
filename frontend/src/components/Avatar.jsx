// Avatar.jsx — DiceBear SVG avatar renderer
import { createAvatar } from '@dicebear/core'
import { bottts } from '@dicebear/collection'
import { useMemo } from 'react'

export default function Avatar({ seed, username, size = 36 }) {
    const svgDataUri = useMemo(() => {
        const avatar = createAvatar(bottts, {
            seed: seed || username || 'anzen',
            size: 64,
        })
        const svg = avatar.toString()
        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
    }, [seed, username])

    return (
        <img
            src={svgDataUri}
            alt={username || 'avatar'}
            width={size}
            height={size}
            className="rounded-lg flex-shrink-0"
            style={{ width: size, height: size }}
        />
    )
}
