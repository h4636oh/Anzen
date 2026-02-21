// useWebRTC.js — Full WebRTC mesh peer connection management
//
// KEY DESIGN: All callback props (onMessage, onPeerJoined, onPeerLeft) are stored
// in refs. This lets us set channel.onmessage ONCE and always call the latest version
// of the callback, avoiding the stale-closure bug where activeRoom or other state
// captured in the callback is stale from the initial render.
import { useRef, useCallback } from 'react'
import { sendFile, reassembleFile, isMedia } from '../utils/fileTransfer.js'

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
}

export function useWebRTC({ signalingWsRef, localPeerId, localUser, onMessage, onPeerJoined, onPeerLeft }) {
    const peerConnections = useRef(new Map()) // peerId → RTCPeerConnection
    const dataChannels = useRef(new Map())  // peerId → RTCDataChannel
    const inboundFiles = useRef(new Map())  // peerId → { meta, chunks[] }
    const pendingMessages = useRef(new Map()) // peerId → Array<{type, payload}> queued while DC is 'connecting'

    // ── Callback refs: always call the latest version of each prop callback ────────
    // This is the fix for the stale-closure bug: channel.onmessage is set ONCE,
    // but it always reads the latest onMessage/onPeerJoined/onPeerLeft via these refs.
    const onMessageRef = useRef(onMessage)
    const onPeerJoinedRef = useRef(onPeerJoined)
    const onPeerLeftRef = useRef(onPeerLeft)
    onMessageRef.current = onMessage
    onPeerJoinedRef.current = onPeerJoined
    onPeerLeftRef.current = onPeerLeft

    // Refs for localPeerId / localUser (for broadcastText closure)
    const localPeerIdRef = useRef(localPeerId)
    const localUserRef = useRef(localUser)
    localPeerIdRef.current = localPeerId
    localUserRef.current = localUser

    // ── Send via live socket ───────────────────────────────────────────────────────
    function sendSignal(msg) {
        const ws = signalingWsRef.current
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg))
        }
    }

    // ── Stable data channel message handler (never reassigned to channel.onmessage) ─
    // Uses refs so it always calls the latest onMessage/onPeerJoined/onPeerLeft.
    const handleDataChannelMessage = useCallback((peerId, event) => {
        const data = event.data

        if (typeof data === 'string') {
            try {
                const msg = JSON.parse(data)

                if (msg.type === 'file-meta') {
                    inboundFiles.current.set(peerId, { meta: msg, chunks: [] })
                    return
                }

                if (msg.type === 'file-end') {
                    const entry = inboundFiles.current.get(peerId)
                    if (entry) {
                        const { blob, objectUrl } = reassembleFile(entry.chunks, entry.meta)
                        inboundFiles.current.delete(peerId)
                        // Use identity from file-meta (includes senderName & avatarSeed)
                        onMessageRef.current({
                            id: crypto.randomUUID(),
                            type: isMedia(entry.meta.mimeType) ? 'media' : 'file',
                            senderId: entry.meta.senderId || peerId,
                            senderName: entry.meta.senderName || 'Peer',
                            avatarSeed: entry.meta.avatarSeed || peerId,
                            timestamp: Date.now(),
                            fileName: entry.meta.name,
                            mimeType: entry.meta.mimeType,
                            objectUrl,
                            blob,
                        })
                    }
                    return
                }

                if (msg.type === 'text') {
                    onMessageRef.current(msg)   // always latest onMessage
                    return
                }
            } catch {
                // not JSON — ignore
            }
        } else if (data instanceof ArrayBuffer) {
            const entry = inboundFiles.current.get(peerId)
            if (entry) entry.chunks.push(data)
        }
    }, []) // stable — no deps needed; uses refs

    // ── Attach data channel (called once per channel, handler never re-assigned) ───
    const setupDataChannel = useCallback((peerId, channel) => {
        channel.binaryType = 'arraybuffer'
        channel.onmessage = (evt) => handleDataChannelMessage(peerId, evt)
        channel.onerror = (e) => console.warn('[DC error]', peerId, e)
        channel.onopen = () => {
            console.info('[DC open]', peerId)
            // Drain any messages that were queued while the channel was 'connecting'
            const queue = pendingMessages.current.get(peerId) || []
            pendingMessages.current.delete(peerId)
            for (const item of queue) {
                try {
                    if (item.type === 'text') channel.send(item.payload)
                } catch (e) { console.warn('[DC flush error]', e) }
            }
        }
        dataChannels.current.set(peerId, channel)
    }, [handleDataChannelMessage])

    // ── Cleanup a peer ─────────────────────────────────────────────────────────────
    const cleanupPeer = useCallback((peerId) => {
        peerConnections.current.get(peerId)?.close()
        peerConnections.current.delete(peerId)
        dataChannels.current.delete(peerId)
        inboundFiles.current.delete(peerId)
        pendingMessages.current.delete(peerId)
    }, [])

    // ── Create RTCPeerConnection ───────────────────────────────────────────────────
    const createPeerConnection = useCallback((peerId) => {
        if (peerConnections.current.has(peerId)) {
            // Avoid creating a duplicate connection for the same peer
            cleanupPeer(peerId)
        }

        const pc = new RTCPeerConnection(ICE_SERVERS)

        pc.onicecandidate = ({ candidate }) => {
            if (candidate) sendSignal({ type: 'ice-candidate', to: peerId, candidate })
        }

        pc.ondatachannel = ({ channel }) => {
            setupDataChannel(peerId, channel)
        }

        pc.onconnectionstatechange = () => {
            console.info('[PC state]', peerId, pc.connectionState)
            if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
                cleanupPeer(peerId)
                onPeerLeftRef.current(peerId)  // always latest
            }
        }

        peerConnections.current.set(peerId, pc)
        return pc
    }, [setupDataChannel, cleanupPeer])

    // ── Offerer side: initiates call ───────────────────────────────────────────────
    const initiateCall = useCallback(async (peerId) => {
        const pc = createPeerConnection(peerId)
        const channel = pc.createDataChannel('chat')
        setupDataChannel(peerId, channel)

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        sendSignal({ type: 'offer', to: peerId, sdp: offer })
        onPeerJoinedRef.current(peerId)
    }, [createPeerConnection, setupDataChannel])

    // ── Answerer side: handles incoming offer ──────────────────────────────────────
    const handleOffer = useCallback(async (peerId, sdp) => {
        const pc = createPeerConnection(peerId)
        await pc.setRemoteDescription(new RTCSessionDescription(sdp))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        sendSignal({ type: 'answer', to: peerId, sdp: answer })
        onPeerJoinedRef.current(peerId)
    }, [createPeerConnection])

    // ── Handle incoming answer ─────────────────────────────────────────────────────
    const handleAnswer = useCallback(async (peerId, sdp) => {
        const pc = peerConnections.current.get(peerId)
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp))
    }, [])

    // ── Handle incoming ICE candidate ──────────────────────────────────────────────
    const handleIceCandidate = useCallback(async (peerId, candidate) => {
        const pc = peerConnections.current.get(peerId)
        if (pc) {
            try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) }
            catch (e) { console.warn('[ICE candidate error]', e) }
        }
    }, [])

    // ── Broadcast text to all open data channels ───────────────────────────────────
    const broadcastText = useCallback((text) => {
        const msg = JSON.stringify({
            type: 'text',
            senderId: localPeerIdRef.current,    // always current
            senderName: localUserRef.current?.username,
            avatarSeed: localUserRef.current?.avatarSeed,
            timestamp: Date.now(),
            text,
        })
        let sent = 0
        for (const [peerId, channel] of dataChannels.current) {
            if (channel.readyState === 'open') {
                channel.send(msg)
                sent++
            } else if (channel.readyState === 'connecting') {
                // Queue it — will be sent once the channel opens
                if (!pendingMessages.current.has(peerId)) pendingMessages.current.set(peerId, [])
                pendingMessages.current.get(peerId).push({ type: 'text', payload: msg })
                sent++ // count as "handled" to suppress the warning
            }
        }
        if (sent === 0) console.warn('[broadcastText] no open/connecting data channels; channels:', [...dataChannels.current.entries()].map(([id, ch]) => `${id.slice(0, 8)}:${ch.readyState}`))
    }, []) // stable — uses refs

    // ── Send a file to all open data channels ─────────────────────────────────────
    const broadcastFile = useCallback((file) => {
        const senderMeta = {
            senderId: localPeerIdRef.current,
            senderName: localUserRef.current?.username,
            avatarSeed: localUserRef.current?.avatarSeed,
        }
        for (const [, channel] of dataChannels.current) {
            if (channel.readyState === 'open') sendFile(channel, file, senderMeta)
        }
    }, [])

    // ── Disconnect all ─────────────────────────────────────────────────────────────
    const disconnectAll = useCallback(() => {
        for (const peerId of [...peerConnections.current.keys()]) cleanupPeer(peerId)
    }, [cleanupPeer])

    return {
        initiateCall,
        handleOffer,
        handleAnswer,
        handleIceCandidate,
        broadcastText,
        broadcastFile,
        disconnectAll,
        getPeerIds: () => [...peerConnections.current.keys()],
    }
}
