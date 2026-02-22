// fileTransfer.js — WebRTC data channel file chunking utilities

const CHUNK_SIZE = 16 * 1024 // 16 KB per chunk

/**
 * Send a File over a RTCDataChannel with chunking.
 * senderMeta: { senderId, senderName, avatarSeed } — included in file-meta so the
 * receiver can display the correct username and avatar instead of "Peer".
 */
export async function sendFile(channel, file, senderMeta = {}) {
    const buffer = await file.arrayBuffer()
    const totalChunks = Math.ceil(buffer.byteLength / CHUNK_SIZE)

    // Send metadata first (includes sender identity for the receiver's display)
    channel.send(JSON.stringify({
        type: 'file-meta',
        name: file.name,
        mimeType: file.type,
        size: file.size,
        totalChunks,
        transferId: crypto.randomUUID(),
        senderId: senderMeta.senderId || '',
        senderName: senderMeta.senderName || 'Peer',
        avatarSeed: senderMeta.avatarSeed || '',
        caption: senderMeta.caption || '',
    }))

    // Send binary chunks
    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, buffer.byteLength)
        channel.send(buffer.slice(start, end))
    }

    // Send end marker
    channel.send(JSON.stringify({ type: 'file-end' }))
}

/**
 * Reconstruct a Blob from accumulated ArrayBuffer chunks.
 */
export function reassembleFile(chunks, meta) {
    const blob = new Blob(chunks, { type: meta.mimeType || 'application/octet-stream' })
    const objectUrl = URL.createObjectURL(blob)
    return { blob, objectUrl }
}

/**
 * Returns true if the mimeType is a displayable image or video.
 */
export function isMedia(mimeType) {
    return mimeType?.startsWith('image/') || mimeType?.startsWith('video/')
}
