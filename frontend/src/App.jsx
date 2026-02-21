// App.jsx — Root component: manages identity, routing, signaling WS, and WebRTC
import { useState, useEffect, useRef, useCallback } from 'react'
import LandingPage from './components/LandingPage.jsx'
import Sidebar from './components/Sidebar.jsx'
import ChatWindow from './components/ChatWindow.jsx'
import { generateUsername, generateAvatarSeed } from './utils/generators.js'
import { getPrefs, savePrefs, getRooms, saveRoom, deleteRoom, getMessages, getMessagesPage, addMessage, wipeAllData } from './hooks/useIndexedDB.js'
import { useWebRTC } from './hooks/useWebRTC.js'

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function App() {
  // ── Identity & theme ─────────────────────────────────────────────────────────
  const [user, setUser] = useState(null)       // { username, avatarSeed, peerId }
  const [theme, setTheme] = useState('dark')

  // ── Navigation ────────────────────────────────────────────────────────────────
  const [view, setView] = useState('landing')  // 'landing' | 'chat'

  // ── Sidebar width (resizable) & mobile visibility ───────────────────────────
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [sidebarOpen, setSidebarOpen] = useState(false) // mobile: sidebar hidden by default

  // ── Rooms ─────────────────────────────────────────────────────────────────────
  const [rooms, setRooms] = useState([])
  const [activeRoom, setActiveRoom] = useState(null)
  const [messages, setMessages] = useState([])  // messages for activeRoom
  const [peers, setPeers] = useState([])         // [{ id, username, avatarSeed }]
  const [connectionStatus, setConnectionStatus] = useState('idle')
  const [wsError, setWsError] = useState(null)   // last error message from backend
  const [allLoaded, setAllLoaded] = useState(false)     // true when no older pages remain
  const [loadingMore, setLoadingMore] = useState(false)  // true while fetching an older page
  const msgOffsetRef = useRef(0)                         // how many msgs from the end we've loaded

  // ── Signaling WebSocket ───────────────────────────────────────────────────────
  const wsRef = useRef(null)
  const peerMetaRef = useRef(new Map()) // peerId → { username, avatarSeed }

  // ── Load persisted identity on mount ─────────────────────────────────────────
  useEffect(() => {
    loadIdentity()
  }, [])

  async function loadIdentity() {
    const prefs = await getPrefs()
    const username = prefs.username || generateUsername()
    const avatarSeed = prefs.avatarSeed || generateAvatarSeed(username)
    const peerId = prefs.peerId || crypto.randomUUID()
    const savedTheme = prefs.theme || 'dark'

    if (!prefs.username) {
      await savePrefs({ username, avatarSeed, peerId, theme: savedTheme })
    }

    setUser({ username, avatarSeed, peerId })
    setTheme(savedTheme)
    applyTheme(savedTheme)

    const savedRooms = await getRooms()
    setRooms(savedRooms)
  }

  function applyTheme(t) {
    document.documentElement.classList.toggle('dark', t === 'dark')
  }

  function toggleTheme() {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      savePrefs({ theme: next })
      return next
    })
  }

  // ── WebRTC callbacks ──────────────────────────────────────────────────────────
  const handleIncomingMessage = useCallback(async (msg) => {
    if (!activeRoom) return
    setMessages(prev => [...prev, msg])
    await addMessage(activeRoom, msg)
  }, [activeRoom])

  const handlePeerJoined = useCallback((peerId) => {
    const meta = peerMetaRef.current.get(peerId) || { username: 'Unknown', avatarSeed: peerId }
    setPeers(prev => prev.find(p => p.id === peerId) ? prev : [...prev, { id: peerId, ...meta }])
  }, [])

  const handlePeerLeft = useCallback((peerId) => {
    setPeers(prev => prev.filter(p => p.id !== peerId))
  }, [])

  const { initiateCall, handleOffer, handleAnswer, handleIceCandidate, broadcastText, broadcastFile, disconnectAll } = useWebRTC({
    signalingWsRef: wsRef,   // pass the ref, not wsRef.current — hooks always read .current at call time
    localPeerId: user?.peerId,
    localUser: user,
    onMessage: handleIncomingMessage,
    onPeerJoined: handlePeerJoined,
    onPeerLeft: handlePeerLeft,
  })

  // ── Open signaling WebSocket for a room ───────────────────────────────────────
  function openSignalingWs(roomName, password) {
    // Close existing WS
    wsRef.current?.close()
    setConnectionStatus('connecting')
    setWsError(null)
    setPeers([])
    let hadError = false

    const ws = new WebSocket(`${WS_BASE}/ws/${roomName}`)
    wsRef.current = ws

    // Timeout: if WS doesn't open within 8s, close and show an error
    const timeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close()
        setConnectionStatus('failed')
        setWsError('Connection timed out — is the backend running at ' + WS_BASE + '?')
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
          setConnectionStatus('connected')
          // Initiate calls to all existing peers in the room
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
          setConnectionStatus('failed')
          setWsError(msg.message || 'Server error')
          console.error('[Signaling error]', msg.message)
          break
        }
        default:
          break
      }
    }

    ws.onclose = () => {
      clearTimeout(timeout)
      // Only revert to idle if there was no error — preserve the error state if it failed
      if (!hadError) setConnectionStatus(prev => prev === 'connecting' ? 'failed' : 'idle')
    }

    ws.onerror = () => {
      clearTimeout(timeout)
      setConnectionStatus('failed')
      setWsError('Could not reach the signaling server')
    }
  }

  // ── Room actions ──────────────────────────────────────────────────────────────
  async function handleJoinRoom(roomName, password, isCreating) {
    // Create room on backend first if creating
    if (isCreating) {
      try {
        const res = await fetch(`${API_BASE}/rooms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room_name: roomName, password }),
        })
        if (!res.ok) {
          let detail = 'Failed to create room on server'
          try { detail = (await res.json()).detail || detail } catch { /* ignore */ }
          // Surface error in the chat area so user can see it
          setActiveRoom(roomName)
          setConnectionStatus('failed')
          setWsError(`Server error (${res.status}): ${detail}`)
          return  // abort — do NOT save to IndexedDB since room wasn't created
        }
      } catch (e) {
        setActiveRoom(roomName)
        setConnectionStatus('failed')
        setWsError('Cannot reach the backend at ' + API_BASE + '. Is it running?')
        return
      }
    }

    await saveRoom(roomName, { password })
    const updatedRooms = await getRooms()
    setRooms(updatedRooms)
    setActiveRoom(roomName)

    await loadInitialMessages(roomName)
    openSignalingWs(roomName, password)
  }

  async function handleSelectRoom(roomName) {
    const room = rooms.find(r => r.roomName === roomName)
    if (!room) return
    setActiveRoom(roomName)
    await loadInitialMessages(roomName)
    openSignalingWs(roomName, room.password)
  }

  const PAGE_SIZE = 40

  async function loadInitialMessages(roomName) {
    msgOffsetRef.current = 0
    setAllLoaded(false)
    const { msgs, total } = await getMessagesPage(roomName, 0, PAGE_SIZE)
    msgOffsetRef.current = msgs.length
    setMessages(msgs)
    setAllLoaded(msgs.length >= total)
  }

  async function handleLoadMore(roomName) {
    if (loadingMore || allLoaded || !roomName) return
    setLoadingMore(true)
    try {
      const currentOffset = msgOffsetRef.current
      const { msgs, total } = await getMessagesPage(roomName, currentOffset, PAGE_SIZE)
      if (msgs.length === 0) {
        setAllLoaded(true)
        return
      }
      msgOffsetRef.current = currentOffset + msgs.length
      setMessages(prev => [...msgs, ...prev])
      setAllLoaded(msgOffsetRef.current >= total)
    } finally {
      setLoadingMore(false)
    }
  }

  async function handleLeaveRoom(roomName) {
    disconnectAll()
    wsRef.current?.close()
    await deleteRoom(roomName)
    const updatedRooms = await getRooms()
    setRooms(updatedRooms)
    if (activeRoom === roomName) {
      setActiveRoom(null)
      setMessages([])
      setConnectionStatus('idle')
      setAllLoaded(false)
      msgOffsetRef.current = 0
    }
  }

  // ── Send handlers ─────────────────────────────────────────────────────────────
  async function handleSendText(text) {
    if (!user || !activeRoom) return
    const msg = {
      id: crypto.randomUUID(),
      type: 'text',
      senderId: user.peerId,
      senderName: user.username,
      avatarSeed: user.avatarSeed,
      timestamp: Date.now(),
      text,
    }
    broadcastText(text)
    setMessages(prev => [...prev, msg])
    await addMessage(activeRoom, msg)
  }

  async function handleSendFile(file) {
    if (!user || !activeRoom) return
    broadcastFile(file)

    // Create a local display message for the sender (mirrors what the receiver gets)
    const blob = file
    const objectUrl = URL.createObjectURL(file)
    const msg = {
      id: crypto.randomUUID(),
      type: file.type.startsWith('image/') || file.type.startsWith('video/') ? 'media' : 'file',
      senderId: user.peerId,
      senderName: user.username,
      avatarSeed: user.avatarSeed,
      timestamp: Date.now(),
      fileName: file.name,
      mimeType: file.type,
      objectUrl,
      blob,
    }
    setMessages(prev => [...prev, msg])
    await addMessage(activeRoom, msg)
  }


  // ── Wipe ──────────────────────────────────────────────────────────────────────
  async function handleClearChat() {
    disconnectAll()
    wsRef.current?.close()
    await wipeAllData()
    setUser(null)
    setRooms([])
    setActiveRoom(null)
    setMessages([])
    setConnectionStatus('idle')
    await loadIdentity()
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  if (view === 'landing') {
    return (
      <LandingPage
        onEnterChat={() => setView('chat')}
        onClearChat={handleClearChat}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    )
  }

  const activeRoomData = rooms.find(r => r.roomName === activeRoom)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        user={user}
        rooms={rooms}
        activeRoom={activeRoom}
        onSelectRoom={handleSelectRoom}
        onJoinRoom={handleJoinRoom}
        onLeaveRoom={handleLeaveRoom}
        onGoToLanding={() => setView('landing')}
        theme={theme}
        onToggleTheme={toggleTheme}
        width={sidebarWidth}
        onWidthChange={setSidebarWidth}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      {activeRoom ? (
        <ChatWindow
          room={activeRoomData}
          messages={messages}
          peers={peers}
          localUser={user}
          connectionStatus={connectionStatus}
          wsError={wsError}
          onSendText={handleSendText}
          onSendFile={handleSendFile}
          onOpenSidebar={() => setSidebarOpen(true)}
          onLoadMore={() => handleLoadMore(activeRoom)}
          allLoaded={allLoaded}
          loadingMore={loadingMore}
        />
      ) : (
        <div className="relative flex-1 flex items-center justify-center flex-col gap-3 px-6"
          style={{ background: 'var(--color-bg)' }}>
          {/* Hamburger for empty state on mobile */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-4 left-4 btn-ghost p-2 rounded-md md:hidden"
            title="Open sidebar"
          >
            <span style={{ fontSize: 20 }}>☰</span>
          </button>
          <p className="text-base text-center" style={{ color: 'var(--color-text-muted)' }}>
            Select a room from the sidebar or create one to get started.
          </p>
        </div>
      )}
    </div>
  )
}
