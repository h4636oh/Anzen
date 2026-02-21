// crypto.js — Web Crypto API utilities for hashing and encryption

// ── Hashing ───────────────────────────────────────────────────────────────────
export async function hashPassword(password) {
    if (!password) return null;
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}


// ── At-Rest Encryption ────────────────────────────────────────────────────────
// We use PBKDF2 to derive an AES-GCM key from the app password.

export function generateSalt() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function deriveKeyFromPassword(password, saltHex) {
    if (!password || !saltHex) return null;
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );

    const saltBuffer = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: saltBuffer,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false, // we don't need to extract the raw key, just use it
        ['encrypt', 'decrypt']
    );
}

export async function encryptData(key, data) {
    if (!key) return data; // Fallback if no encryption initialized

    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const stringData = JSON.stringify(data);
    const encodedData = enc.encode(stringData);

    const ciphertextBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encodedData
    );

    return {
        _encrypted: true, // Marker to easily identify encrypted payloads
        iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
        ciphertext: Array.from(new Uint8Array(ciphertextBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
    };
}

export async function decryptData(key, encryptedData) {
    if (!key || !encryptedData || !encryptedData._encrypted) {
        return encryptedData; // Not encrypted, return as-is
    }

    const dec = new TextDecoder();
    const ivBuffer = new Uint8Array(encryptedData.iv.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const ciphertextBuffer = new Uint8Array(encryptedData.ciphertext.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

    try {
        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: ivBuffer },
            key,
            ciphertextBuffer
        );

        const decryptedString = dec.decode(decryptedBuffer);
        return JSON.parse(decryptedString);
    } catch (e) {
        console.error("Decryption failed. The password or salt might be incorrect.", e);
        return null; // Signals auth failure during DB read
    }
}
