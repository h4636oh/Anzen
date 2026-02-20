// fileTransfer.js — WebRTC data channel file chunking utilities

const CHUNK_SIZE = 16 * 1024 // 16 KB per chunk

/**
 * Send a File over a RTCDataChannel with chunking.
 * @param {RTCDataChannel} channel
 * @param {File} file
 */
export async function sendFile(channel, file) {
    const buffer = await file.arrayBuffer()
    const totalChunks = Math.ceil(buffer.byteLength / CHUNK_SIZE)

    // Send metadata first
    channel.send(JSON.stringify({
        type: 'file-meta',
        name: file.name,
        mimeType: file.type,
        size: file.size,
        totalChunks,
        transferId: crypto.randomUUID(),
    }))

    // Send binary chunks
    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, buffer.byteLength)
        const chunk = buffer.slice(start, end)
        channel.send(chunk)
    }

    // Send end marker
    channel.send(JSON.stringify({ type: 'file-end' }))
}

/**
 * Reconstruct a Blob from accumulated ArrayBuffer chunks.
 * @param {ArrayBuffer[]} chunks
 * @param {object} meta - { name, mimeType, size }
 * @returns {{ blob: Blob, objectUrl: string }}
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
