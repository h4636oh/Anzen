// useIndexedDB.js — localforage wrapper for Anzen's local storage
import localforage from 'localforage'
import { generateSalt, deriveKeyFromPassword, encryptData, decryptData } from '../utils/crypto.js'

// Create separate stores per data type
const prefsStore = localforage.createInstance({ name: 'anzen', storeName: 'userPreferences' })
const roomsStore = localforage.createInstance({ name: 'anzen', storeName: 'rooms' })
const messagesStore = localforage.createInstance({ name: 'anzen', storeName: 'messages' })

let dbEncryptionKey = null;

export async function initEncryption(password) {
    if (!password || password === 'SKIP') {
        dbEncryptionKey = null;
        return;
    }
    let saltHex = await prefsStore.getItem('cryptoSalt');
    if (!saltHex) {
        saltHex = generateSalt();
        await prefsStore.setItem('cryptoSalt', saltHex);
    }
    dbEncryptionKey = await deriveKeyFromPassword(password, saltHex);
}

// ── User Preferences ──────────────────────────────────────────────────────────
export async function getPrefs() {
    const username = await prefsStore.getItem('username')
    const avatarSeed = await prefsStore.getItem('avatarSeed')
    const theme = await prefsStore.getItem('theme')
    const peerId = await prefsStore.getItem('peerId')   // ← was missing, caused new UUID on every reload
    const appPasswordHash = await prefsStore.getItem('appPasswordHash')
    const cryptoSalt = await prefsStore.getItem('cryptoSalt')
    return { username, avatarSeed, theme, peerId, appPasswordHash, cryptoSalt }
}

export async function savePrefs(prefs) {
    for (const [key, value] of Object.entries(prefs)) {
        await prefsStore.setItem(key, value)
    }
}

// ── Rooms ─────────────────────────────────────────────────────────────────────
export async function getRooms() {
    const keys = await roomsStore.keys();
    const rooms = [];
    for (const key of keys) {
        const encryptedValue = await roomsStore.getItem(key);
        const decryptedValue = await decryptData(dbEncryptionKey, encryptedValue) || encryptedValue;
        if (decryptedValue) {
            rooms.push({ roomName: key, ...decryptedValue })
        }
    }
    return rooms.sort((a, b) => (b.lastMessageAt || b.joinedAt || 0) - (a.lastMessageAt || a.joinedAt || 0))
}

export async function saveRoom(roomName, data) {
    const encryptedExisting = await roomsStore.getItem(roomName)
    const existing = await decryptData(dbEncryptionKey, encryptedExisting)

    let toStore;
    if (!existing) {
        toStore = { ...data, joinedAt: Date.now(), lastMessageAt: Date.now(), hasUnread: false }
    } else {
        toStore = { ...existing, ...data }
    }

    await roomsStore.setItem(roomName, await encryptData(dbEncryptionKey, toStore))
}

export async function updateRoomActivity(roomName, hasUnread = false) {
    const encryptedExisting = await roomsStore.getItem(roomName)
    const data = await decryptData(dbEncryptionKey, encryptedExisting)
    if (data) {
        await roomsStore.setItem(roomName, await encryptData(dbEncryptionKey, { ...data, lastMessageAt: Date.now(), hasUnread }))
    }
}

export async function clearUnread(roomName) {
    const encryptedExisting = await roomsStore.getItem(roomName)
    const data = await decryptData(dbEncryptionKey, encryptedExisting)
    if (data && data.hasUnread) {
        await roomsStore.setItem(roomName, await encryptData(dbEncryptionKey, { ...data, hasUnread: false }))
    }
}

export async function deleteRoom(roomName) {
    await roomsStore.removeItem(roomName)
    await messagesStore.removeItem(roomName)
}

// ── Messages ──────────────────────────────────────────────────────────────────

// helpers for blob to base64
async function blobToBase64(blob) {
    return new Promise((resolve, _) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}
function base64ToBlob(base64, mimeType) {
    const parts = base64.split(',');
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mimeType });
}

/** Recreate session-scoped objectUrls from stored blobs */
function hydrateBlobs(msgs) {
    return msgs.map(msg => {
        let hydratedMsg = msg;
        if (msg.blobData) {
            try {
                hydratedMsg = { ...msg, blob: base64ToBlob(msg.blobData, msg.mimeType), blobData: undefined };
            } catch (e) {
                console.error("Failed to restore blob", e);
            }
        }

        if (hydratedMsg.blob && (hydratedMsg.type === 'media' || hydratedMsg.type === 'file')) {
            try { return { ...hydratedMsg, objectUrl: URL.createObjectURL(hydratedMsg.blob) } }
            catch { return hydratedMsg }
        }
        return hydratedMsg
    })
}

export async function getMessages(roomName) {
    const encrypted = await messagesStore.getItem(roomName)
    const msgs = (await decryptData(dbEncryptionKey, encrypted)) || []
    return hydrateBlobs(msgs)
}

export async function getMessagesPage(roomName, offset = 0, limit = 40) {
    const encrypted = await messagesStore.getItem(roomName)
    const all = (await decryptData(dbEncryptionKey, encrypted)) || []
    const total = all.length
    const end = Math.max(0, total - offset)
    const start = Math.max(0, end - limit)
    const slice = all.slice(start, end)
    return { msgs: hydrateBlobs(slice), total }
}

export async function addMessage(roomName, message) {
    const encryptedExisting = await messagesStore.getItem(roomName)
    const existing = (await decryptData(dbEncryptionKey, encryptedExisting)) || []

    // Never store objectUrl — it's session-scoped. We store blob and recreate on load.
    const { objectUrl: _drop, ...toStore } = message

    let serializeBlob = toStore;
    if (toStore.blob) {
        try {
            const base64 = await blobToBase64(toStore.blob);
            serializeBlob = { ...toStore, blobData: base64, blob: undefined };
        } catch (e) {
            console.error("Failed to convert blob for storage", e);
        }
    }

    existing.push(serializeBlob)
    await messagesStore.setItem(roomName, await encryptData(dbEncryptionKey, existing))
}

// ── Wipe ──────────────────────────────────────────────────────────────────────
export async function wipeAllData() {
    await prefsStore.clear()
    await roomsStore.clear()
    await messagesStore.clear()
    dbEncryptionKey = null;
}
