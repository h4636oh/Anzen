// App.jsx — Root component: manages identity, routing, signaling WS, and WebRTC
import { useState, useEffect, useRef, useCallback } from 'react'
import LandingPage from './components/LandingPage.jsx'
import Sidebar from './components/Sidebar.jsx'
import ChatWindow from './components/ChatWindow.jsx'
import ConfirmModal from './components/ConfirmModal.jsx'
import LockScreen from './components/LockScreen.jsx'
import RoomConnection from './components/RoomConnection.jsx'
import { generateUsername, generateAvatarSeed } from './utils/generators.js'
import { getPrefs, savePrefs, getRooms, saveRoom, deleteRoom, getMessages, getMessagesPage, addMessage, wipeAllData, updateRoomActivity, clearUnread, initEncryption } from './hooks/useIndexedDB.js'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function App() {
  // ── Identity & theme ─────────────────────────────────────────────────────────
  const [user, setUser] = useState(null)       // { username, avatarSeed, peerId }
  const [theme, setTheme] = useState('dark')
  const [appPasswordHash, setAppPasswordHash] = useState(null)

  // ── Navigation ────────────────────────────────────────────────────────────────
  const [view, setView] = useState('landing')  // 'landing' | 'chat'

  // ── Inactivity Lock ───────────────────────────────────────────────────────────
  const [isLocked, setIsLocked] = useState(false)
  const lastActivityAt = useRef(Date.now())
  const INACTIVITY_LIMIT_MS = 5 * 60 * 1000 // 5 minutes

  // ── Sidebar width (resizable) & mobile visibility ───────────────────────────
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [sidebarOpen, setSidebarOpen] = useState(false) // mobile: sidebar hidden by default

  // ── Rooms ─────────────────────────────────────────────────────────────────────
  const [rooms, setRooms] = useState([])
  const [activeRoom, setActiveRoom] = useState(null)
  const [roomToLeave, setRoomToLeave] = useState(null)
  const [roomToDisconnect, setRoomToDisconnect] = useState(null)

  // Rooms that the user purposely dropped the connection for without deleting
  const [disconnectedRooms, setDisconnectedRooms] = useState(new Set())

  // Room data mapped by roomName
  const [messagesByRoom, setMessagesByRoom] = useState({})
  const [peersByRoom, setPeersByRoom] = useState({})
  const [statusByRoom, setStatusByRoom] = useState({})
  const [errorByRoom, setErrorByRoom] = useState({})

  // Pagination mapped by roomName
  const [allLoadedByRoom, setAllLoadedByRoom] = useState({})
  const [loadingMoreByRoom, setLoadingMoreByRoom] = useState({})
  const msgOffsetRefs = useRef({})

  const roomActionsRef = useRef({}) // roomName -> { broadcastText, broadcastFile, disconnectAll, getPeerIds }

  // ── Connection Limits ─────────────────────────────────────────────────────────
  const [limitModal, setLimitModal] = useState(null) // 'warning250' | 'prompt450' | null
  const [pendingJoinRoom, setPendingJoinRoom] = useState(null)

  const totalPeers = Object.values(peersByRoom).reduce((acc, peers) => acc + (peers?.length || 0), 0)

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
    setAppPasswordHash(prefs.appPasswordHash || null)
    applyTheme(savedTheme)
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

  async function handleSaveAppPassword(hash) {
    await savePrefs({ appPasswordHash: hash })
    setAppPasswordHash(hash)
  }

  // ── Room Activity Sync (Cross-tab) ──────────────────────────────────────────
  useEffect(() => {
    const bc = new BroadcastChannel('anzen-rooms')
    bc.onmessage = (e) => {
      if (e.data.type === 'activity') {
        const { roomName } = e.data
        setRooms(prev => {
          const next = [...prev]
          const idx = next.findIndex(r => r.roomName === roomName)
          if (idx !== -1) {
            const isUnread = roomName !== activeRoom
            next[idx] = { ...next[idx], lastMessageAt: Date.now(), hasUnread: isUnread }
            const [room] = next.splice(idx, 1)
            next.unshift(room)
          }
          return next
        })
      }
    }
    return () => bc.close()
  }, [activeRoom])

  const notifyRoomActivity = useCallback(async (roomName) => {
    const isUnread = roomName !== activeRoom
    await updateRoomActivity(roomName, isUnread)

    setRooms(prev => {
      const next = [...prev]
      const idx = next.findIndex(r => r.roomName === roomName)
      if (idx !== -1) {
        next[idx] = { ...next[idx], lastMessageAt: Date.now(), hasUnread: isUnread }
        const [room] = next.splice(idx, 1)
        next.unshift(room)
      }
      return next
    })

    const bc = new BroadcastChannel('anzen-rooms')
    bc.postMessage({ type: 'activity', roomName })
    bc.close()
  }, [activeRoom])

  // ── Inactivity Tracker ────────────────────────────────────────────────────────
  useEffect(() => {
    function updateActivity() {
      lastActivityAt.current = Date.now()
    }

    // Attach listeners
    window.addEventListener('mousemove', updateActivity)
    window.addEventListener('keydown', updateActivity)
    window.addEventListener('click', updateActivity)
    window.addEventListener('scroll', updateActivity, true)
    window.addEventListener('touchstart', updateActivity)

    // Check periodically
    const interval = setInterval(() => {
      if (!isLocked && appPasswordHash && appPasswordHash !== 'SKIP') {
        if (Date.now() - lastActivityAt.current > INACTIVITY_LIMIT_MS) {
          setIsLocked(true)
        }
      }
    }, 10000) // Check every 10 seconds

    return () => {
      window.removeEventListener('mousemove', updateActivity)
      window.removeEventListener('keydown', updateActivity)
      window.removeEventListener('click', updateActivity)
      window.removeEventListener('scroll', updateActivity, true)
      window.removeEventListener('touchstart', updateActivity)
      clearInterval(interval)
    }
  }, [isLocked, appPasswordHash, INACTIVITY_LIMIT_MS])

  // ── RoomConnection Callbacks ─────────────────────────────────────────────────
  const handleIncomingMessage = useCallback(async (roomName, msg) => {
    setMessagesByRoom(prev => ({
      ...prev,
      [roomName]: [...(prev[roomName] || []), msg]
    }))
    await addMessage(roomName, msg)
    await notifyRoomActivity(roomName)
  }, [notifyRoomActivity])

  const handlePeersUpdate = useCallback((roomName, updater) => {
    setPeersByRoom(prev => ({ ...prev, [roomName]: updater(prev[roomName] || []) }))
  }, [])

  const handleConnectionStatusChange = useCallback((roomName, status, error) => {
    setStatusByRoom(prev => ({ ...prev, [roomName]: status }))
    setErrorByRoom(prev => ({ ...prev, [roomName]: error }))
  }, [])

  const registerRoomActions = useCallback((roomName, actions) => {
    roomActionsRef.current[roomName] = actions
  }, [])

  const unregisterRoomActions = useCallback((roomName) => {
    delete roomActionsRef.current[roomName]
  }, [])

  // ── Room initialization ───────────────────────────────────────────────────────
  const PAGE_SIZE = 40

  async function loadInitialMessages(roomName) {
    if (!msgOffsetRefs.current[roomName]) msgOffsetRefs.current[roomName] = 0
    msgOffsetRefs.current[roomName] = 0
    setAllLoadedByRoom(prev => ({ ...prev, [roomName]: false }))
    const { msgs, total } = await getMessagesPage(roomName, 0, PAGE_SIZE)
    msgOffsetRefs.current[roomName] = msgs.length
    setMessagesByRoom(prev => ({ ...prev, [roomName]: msgs }))
    setAllLoadedByRoom(prev => ({ ...prev, [roomName]: msgs.length >= total }))
  }

  async function handleLoadMore(roomName) {
    if (loadingMoreByRoom[roomName] || allLoadedByRoom[roomName] || !roomName) return
    setLoadingMoreByRoom(prev => ({ ...prev, [roomName]: true }))
    try {
      const currentOffset = msgOffsetRefs.current[roomName] || 0
      const { msgs, total } = await getMessagesPage(roomName, currentOffset, PAGE_SIZE)
      if (msgs.length === 0) {
        setAllLoadedByRoom(prev => ({ ...prev, [roomName]: true }))
        return
      }
      msgOffsetRefs.current[roomName] = currentOffset + msgs.length
      setMessagesByRoom(prev => ({
        ...prev,
        [roomName]: [...msgs, ...(prev[roomName] || [])]
      }))
      setAllLoadedByRoom(prev => ({ ...prev, [roomName]: msgOffsetRefs.current[roomName] >= total }))
    } finally {
      setLoadingMoreByRoom(prev => ({ ...prev, [roomName]: false }))
    }
  }

  // ── Room actions ──────────────────────────────────────────────────────────────
  async function performJoinRoom(roomName, password, isCreating) {
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
          setActiveRoom(roomName)
          handleConnectionStatusChange(roomName, 'failed', `Server error (${res.status}): ${detail}`)
          return
        }
      } catch (e) {
        setActiveRoom(roomName)
        handleConnectionStatusChange(roomName, 'failed', 'Cannot reach the backend at ' + API_BASE + '. Is it running?')
        return
      }
    }

    await saveRoom(roomName, { password })
    const updatedRooms = await getRooms()
    setRooms(updatedRooms)
    setActiveRoom(roomName)

    // the RoomConnection component will mount automatically since this room is now in `rooms`
    if (!messagesByRoom[roomName]) {
      await loadInitialMessages(roomName)
    }

    setDisconnectedRooms(prev => {
      if (!prev.has(roomName)) return prev
      const next = new Set(prev)
      next.delete(roomName)
      return next
    })
  }

  async function handleJoinRoom(roomName, password, isCreating) {
    const isNewRoom = !rooms.find(r => r.roomName === roomName)
    if (isNewRoom) {
      if (totalPeers >= 450) {
        setLimitModal('prompt450')
        return
      }
      if (totalPeers >= 250) {
        setPendingJoinRoom({ roomName, password, isCreating })
        setLimitModal('warning250')
        return
      }
    }
    await performJoinRoom(roomName, password, isCreating)
  }

  function confirmPendingJoin() {
    if (pendingJoinRoom) {
      performJoinRoom(pendingJoinRoom.roomName, pendingJoinRoom.password, pendingJoinRoom.isCreating)
      setPendingJoinRoom(null)
    }
    setLimitModal(null)
  }

  function openNewTabAndCancel() {
    window.open(window.location.href, '_blank')
    setLimitModal(null)
  }

  async function handleSelectRoom(roomName) {
    const room = rooms.find(r => r.roomName === roomName)
    if (!room) return
    setActiveRoom(roomName)

    await clearUnread(roomName)
    setRooms(prev => prev.map(r => r.roomName === roomName ? { ...r, hasUnread: false } : r))

    if (!messagesByRoom[roomName]) {
      await loadInitialMessages(roomName)
    }

    setDisconnectedRooms(prev => {
      if (!prev.has(roomName)) return prev
      const next = new Set(prev)
      next.delete(roomName)
      return next
    })
  }

  function handleLeaveRoom(roomName) {
    setRoomToLeave(roomName)
  }

  function handleDisconnectRoom(roomName) {
    setRoomToDisconnect(roomName)
  }

  function confirmDisconnectRoom() {
    if (!roomToDisconnect) return
    const roomName = roomToDisconnect
    setRoomToDisconnect(null)

    setDisconnectedRooms(prev => {
      const next = new Set(prev)
      next.add(roomName)
      return next
    })

    if (activeRoom === roomName) {
      setActiveRoom(null)
    }

    setStatusByRoom(prev => { const n = { ...prev }; delete n[roomName]; return n })
    setErrorByRoom(prev => { const n = { ...prev }; delete n[roomName]; return n })
  }

  async function confirmLeaveRoom() {
    if (!roomToLeave) return
    const roomName = roomToLeave
    setRoomToLeave(null)

    // Unmounting the RoomConnection handles WebRTC & DC closures.
    await deleteRoom(roomName)
    const updatedRooms = await getRooms()
    setRooms(updatedRooms)
    if (activeRoom === roomName) {
      setActiveRoom(null)
    }

    setMessagesByRoom(prev => { const n = { ...prev }; delete n[roomName]; return n })
    setPeersByRoom(prev => { const n = { ...prev }; delete n[roomName]; return n })
    setStatusByRoom(prev => { const n = { ...prev }; delete n[roomName]; return n })
    setErrorByRoom(prev => { const n = { ...prev }; delete n[roomName]; return n })
    delete msgOffsetRefs.current[roomName]
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

    roomActionsRef.current[activeRoom]?.broadcastText(text)

    setMessagesByRoom(prev => ({ ...prev, [activeRoom]: [...(prev[activeRoom] || []), msg] }))
    await addMessage(activeRoom, msg)
    await notifyRoomActivity(activeRoom)
  }

  async function handleSendFile(file, caption = '') {
    if (!user || !activeRoom) return
    roomActionsRef.current[activeRoom]?.broadcastFile(file, caption)

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
      caption: caption,
    }
    setMessagesByRoom(prev => ({ ...prev, [activeRoom]: [...(prev[activeRoom] || []), msg] }))
    await addMessage(activeRoom, msg)
    await notifyRoomActivity(activeRoom)
  }


  // ── Wipe ──────────────────────────────────────────────────────────────────────
  async function handleClearChat() {
    for (const actions of Object.values(roomActionsRef.current)) {
      actions.disconnectAll?.()
    }
    await wipeAllData()
    setUser(null)
    setAppPasswordHash(null)
    setRooms([])
    setActiveRoom(null)
    setMessagesByRoom({})
    setPeersByRoom({})
    setStatusByRoom({})
    setErrorByRoom({})
    setAllLoadedByRoom({})
    msgOffsetRefs.current = {}
    await loadIdentity()
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  if (view === 'landing') {
    return (
      <>
        <LandingPage
          onEnterChat={async (rawPassword) => {
            await initEncryption(rawPassword)
            const savedRooms = await getRooms()
            setRooms(savedRooms)
            setDisconnectedRooms(new Set(savedRooms.map(r => r.roomName)))
            lastActivityAt.current = Date.now()
            for (const r of savedRooms) {
              await loadInitialMessages(r.roomName)
            }
            setView('chat')
          }}
          onClearChat={handleClearChat}
          theme={theme}
          onToggleTheme={toggleTheme}
          appPasswordHash={appPasswordHash}
          onSaveAppPassword={handleSaveAppPassword}
        />
        {isLocked && (
          <LockScreen
            appPasswordHash={appPasswordHash}
            onUnlock={() => {
              setIsLocked(false)
              lastActivityAt.current = Date.now()
            }}
          />
        )}
      </>
    )
  }

  const activeRoomData = rooms.find(r => r.roomName === activeRoom)

  return (
    <div className="flex h-screen overflow-hidden">
      {isLocked && (
        <LockScreen
          appPasswordHash={appPasswordHash}
          onUnlock={() => {
            setIsLocked(false)
            lastActivityAt.current = Date.now()
          }}
        />
      )}

      {/* Render headless RoomConnections for all saved rooms */}
      {rooms.filter(r => !disconnectedRooms.has(r.roomName)).map(r => (
        <RoomConnection
          key={r.roomName}
          roomName={r.roomName}
          password={r.password}
          user={user}
          isActive={activeRoom === r.roomName}
          onMessage={handleIncomingMessage}
          onPeersUpdate={handlePeersUpdate}
          onConnectionStatusChange={handleConnectionStatusChange}
          registerActions={registerRoomActions}
          unregisterActions={unregisterRoomActions}
        />
      ))}

      <Sidebar
        user={user}
        rooms={rooms}
        activeRoom={activeRoom}
        onSelectRoom={handleSelectRoom}
        onJoinRoom={handleJoinRoom}
        onLeaveRoom={handleLeaveRoom}
        onDisconnectRoom={handleDisconnectRoom}
        statusByRoom={statusByRoom}
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
          messages={messagesByRoom[activeRoom] || []}
          peers={peersByRoom[activeRoom] || []}
          localUser={user}
          connectionStatus={statusByRoom[activeRoom] || 'idle'}
          wsError={errorByRoom[activeRoom]}
          onSendText={handleSendText}
          onSendFile={handleSendFile}
          onOpenSidebar={() => setSidebarOpen(true)}
          onLeaveRoom={handleLeaveRoom}
          onLoadMore={() => handleLoadMore(activeRoom)}
          allLoaded={!!allLoadedByRoom[activeRoom]}
          loadingMore={!!loadingMoreByRoom[activeRoom]}
          theme={theme}
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

      {/* Leave Room Confirmation Modal */}
      {roomToLeave && (
        <ConfirmModal
          title="Leave Room"
          message={`Are you sure you want to leave the room "${roomToLeave}"? All chats and history for this room will be permanently deleted from your device.`}
          confirmText="Leave and Delete"
          onConfirm={confirmLeaveRoom}
          onCancel={() => setRoomToLeave(null)}
          isDestructive={true}
        />
      )}

      {/* Disconnect Room Confirmation Modal */}
      {roomToDisconnect && (
        <ConfirmModal
          title="Disconnect Room"
          message={`Do you want to disconnect from this room? You can reconnect later by clicking it in the sidebar.`}
          confirmText="Disconnect"
          onConfirm={confirmDisconnectRoom}
          onCancel={() => setRoomToDisconnect(null)}
          isDestructive={false}
        />
      )}

      {/* 250 Connections Warning Modal */}
      {limitModal === 'warning250' && (
        <ConfirmModal
          title="High Connection Count"
          message="You are approaching 250 active connections. Joining more rooms may degrade your PC's performance. Continue?"
          confirmText="Continue"
          onConfirm={confirmPendingJoin}
          onCancel={() => {
            setLimitModal(null)
            setPendingJoinRoom(null)
          }}
          isDestructive={false}
        />
      )}

      {/* 450 Connections Limit Prompt Modal */}
      {limitModal === 'prompt450' && (
        <ConfirmModal
          title="Maximum Connections Reached"
          message="You've reached 450 active connections. Due to browser limitations, you must open Anzen in a new tab to connect with more people. Open new tab?"
          confirmText="Open New Tab"
          onConfirm={openNewTabAndCancel}
          onCancel={() => setLimitModal(null)}
          isDestructive={false}
        />
      )}
    </div>
  )
}
