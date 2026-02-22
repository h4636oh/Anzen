import { useEffect, useRef, useCallback } from 'react'
import { useWebRTC } from '../hooks/useWebRTC'

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

export default function RoomConnection({
    roomName,
    password,
    user,
    onMessage,
    onPeersUpdate,
    onConnectionStatusChange,
    registerActions,
    unregisterActions
}) {
    const wsRef = useRef(null)
    const peerMetaRef = useRef(new Map())

    const handleIncomingMessage = useCallback((msg) => {
        onMessage(roomName, msg)
    }, [roomName, onMessage])

    const handlePeerJoined = useCallback((peerId) => {
        onPeersUpdate(roomName, (prevPeers = []) => {
            const meta = peerMetaRef.current.get(peerId) || { username: 'Unknown', avatarSeed: peerId }
            if (prevPeers.find(p => p.id === peerId)) return prevPeers
            return [...prevPeers, { id: peerId, ...meta }]
        })
    }, [roomName, onPeersUpdate])

    const handlePeerLeft = useCallback((peerId) => {
        onPeersUpdate(roomName, (prevPeers = []) => prevPeers.filter(p => p.id !== peerId))
    }, [roomName, onPeersUpdate])

    const {
        initiateCall,
        handleOffer,
        handleAnswer,
        handleIceCandidate,
        broadcastText,
        broadcastFile,
        disconnectAll,
        getPeerIds
    } = useWebRTC({
        signalingWsRef: wsRef,
        localPeerId: user?.peerId,
        localUser: user,
        onMessage: handleIncomingMessage,
        onPeerJoined: handlePeerJoined,
        onPeerLeft: handlePeerLeft,
    })

    useEffect(() => {
        if (registerActions) {
            registerActions(roomName, { broadcastText, broadcastFile, disconnectAll, getPeerIds })
        }
        return () => {
            if (unregisterActions) unregisterActions(roomName)
        }
    }, [roomName, registerActions, unregisterActions, broadcastText, broadcastFile, disconnectAll, getPeerIds])

    useEffect(() => {
        if (!user || !roomName) return

        onConnectionStatusChange(roomName, 'connecting', null)
        let hadError = false
        onPeersUpdate(roomName, () => []) // clear peers on reconnect

        const ws = new WebSocket(`${WS_BASE}/ws/${roomName}`)
        wsRef.current = ws

        const timeout = setTimeout(() => {
            if (ws.readyState !== WebSocket.OPEN) {
                ws.close()
                onConnectionStatusChange(roomName, 'failed', 'Connection timed out — is the backend running at ' + WS_BASE + '?')
            }
        }, 8000)

        ws.onopen = () => {
            clearTimeout(timeout)
            ws.send(JSON.stringify({
                type: 'join',
                password,
                peerId: user.peerId,
                username: user.username,
                avatarSeed: user.avatarSeed,
            }))
        }

        ws.onmessage = async (evt) => {
            let msg
            try { msg = JSON.parse(evt.data) } catch { return }

            switch (msg.type) {
                case 'joined': {
                    onConnectionStatusChange(roomName, 'connected', null)
                    for (const peer of (msg.peers || [])) {
                        peerMetaRef.current.set(peer.peerId, { username: peer.username, avatarSeed: peer.avatarSeed })
                        await initiateCall(peer.peerId)
                    }
                    break
                }
                case 'peer-joined': {
                    peerMetaRef.current.set(msg.peerId, { username: msg.username, avatarSeed: msg.avatarSeed })
                    break
                }
                case 'offer': {
                    peerMetaRef.current.set(msg.from, { username: msg.username || 'Peer', avatarSeed: msg.avatarSeed || msg.from })
                    await handleOffer(msg.from, msg.sdp)
                    break
                }
                case 'answer': {
                    await handleAnswer(msg.from, msg.sdp)
                    break
                }
                case 'ice-candidate': {
                    await handleIceCandidate(msg.from, msg.candidate)
                    break
                }
                case 'peer-left': {
                    handlePeerLeft(msg.peerId)
                    break
                }
                case 'error': {
                    hadError = true
                    onConnectionStatusChange(roomName, 'failed', msg.message || 'Server error')
                    console.error('[Signaling error]', msg.message)
                    break
                }
                default:
                    break
            }
        }

        ws.onclose = () => {
            clearTimeout(timeout)
            if (!hadError) {
                onConnectionStatusChange(roomName, 'idle', null)
            }
        }

        ws.onerror = () => {
            clearTimeout(timeout)
            onConnectionStatusChange(roomName, 'failed', 'Could not reach the signaling server')
        }

        return () => {
            clearTimeout(timeout)
            disconnectAll()
            ws.close()
        }
    }, [roomName, password, user, initiateCall, handleOffer, handleAnswer, handleIceCandidate, handlePeerLeft, onConnectionStatusChange, onPeersUpdate, disconnectAll])

    return null
}
