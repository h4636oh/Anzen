// useIndexedDB.js — localforage wrapper for Anzen's local storage
import localforage from 'localforage'

// Create separate stores per data type
const prefsStore = localforage.createInstance({ name: 'anzen', storeName: 'userPreferences' })
const roomsStore = localforage.createInstance({ name: 'anzen', storeName: 'rooms' })
const messagesStore = localforage.createInstance({ name: 'anzen', storeName: 'messages' })

// ── User Preferences ──────────────────────────────────────────────────────────
export async function getPrefs() {
    const username = await prefsStore.getItem('username')
    const avatarSeed = await prefsStore.getItem('avatarSeed')
    const theme = await prefsStore.getItem('theme')
    const peerId = await prefsStore.getItem('peerId')   // ← was missing, caused new UUID on every reload
    return { username, avatarSeed, theme, peerId }
}

export async function savePrefs(prefs) {
    for (const [key, value] of Object.entries(prefs)) {
        await prefsStore.setItem(key, value)
    }
}

// ── Rooms ─────────────────────────────────────────────────────────────────────
export async function getRooms() {
    const rooms = []
    await roomsStore.iterate((value, key) => {
        rooms.push({ roomName: key, ...value })
    })
    return rooms
}

export async function saveRoom(roomName, data) {
    await roomsStore.setItem(roomName, { ...data, joinedAt: Date.now() })
}

export async function deleteRoom(roomName) {
    await roomsStore.removeItem(roomName)
}

// ── Messages ──────────────────────────────────────────────────────────────────

/** Recreate session-scoped objectUrls from stored blobs */
function hydrateBlobs(msgs) {
    return msgs.map(msg => {
        if (msg.blob && (msg.type === 'media' || msg.type === 'file')) {
            try { return { ...msg, objectUrl: URL.createObjectURL(msg.blob) } }
            catch { return msg }
        }
        return msg
    })
}

export async function getMessages(roomName) {
    const msgs = (await messagesStore.getItem(roomName)) || []
    return hydrateBlobs(msgs)
}

/**
 * Paginated load — newest-first pagination.
 * offset=0 → last `limit` messages (newest page)
 * offset=40 → the 40 before those, etc.
 * Returns { msgs, total } so callers know when all pages are exhausted.
 */
export async function getMessagesPage(roomName, offset = 0, limit = 40) {
    const all = (await messagesStore.getItem(roomName)) || []
    const total = all.length
    const end = total - offset
    const start = Math.max(0, end - limit)
    const slice = all.slice(start, end)
    return { msgs: hydrateBlobs(slice), total }
}

export async function addMessage(roomName, message) {
    const existing = (await messagesStore.getItem(roomName)) || []
    // Never store objectUrl — it's session-scoped. We store blob and recreate on load.
    const { objectUrl: _drop, ...toStore } = message
    existing.push(toStore)
    await messagesStore.setItem(roomName, existing)
}

// ── Wipe ──────────────────────────────────────────────────────────────────────
export async function wipeAllData() {
    await prefsStore.clear()
    await roomsStore.clear()
    await messagesStore.clear()
}
