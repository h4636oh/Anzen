// generators.js — Identity & Room name generation using real English dictionary words
//
// `an-array-of-english-words` exports a huge array of real English words.
// We slice to reasonable-length words (4-8 chars) for readability, then filter
// into semantic categories by simple heuristics (fast, works offline, no API needed).

import wordsRaw from 'an-array-of-english-words'

// Filter into usable subsets once at module load
const ALL_WORDS = wordsRaw.filter(w => w.length >= 4 && w.length <= 7 && /^[a-z]+$/.test(w))

// Adjective-ish words: heuristic — ends in common adjective suffixes or specific patterns
const ADJECTIVE_POOL = ALL_WORDS.filter(w =>
    /(?:ful|less|ous|ive|ish|al|ic|ed|en|nt|ry|ly|id|ky|ny|sy|zy)$/.test(w)
).slice(0, 2000)

// Noun-ish / animal-like short nouns: heuristic — short words that don't end in verb/adj suffixes
const NOUN_POOL = ALL_WORDS.filter(w =>
    w.length >= 4 && w.length <= 6 &&
    !/(?:ing|tion|ness|ment|ful|less|ous|ive|ish|al|ic|ed|ry|ly)$/.test(w)
).slice(0, 2000)

// Passphrase word pool — slightly longer, clearly noun-like
const PHRASE_POOL = ALL_WORDS.filter(w => w.length >= 4 && w.length <= 8).slice(0, 5000)

/** Pick a random element from an array */
function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
}

/** Capitalize first letter */
function cap(w) {
    return w.charAt(0).toUpperCase() + w.slice(1)
}

/**
 * Generate a unique username like "QuietRaven" or "BoldMoose"
 * Uses real dictionary adjectives + nouns for both halves.
 */
export function generateUsername() {
    const adj = pick(ADJECTIVE_POOL.length > 0 ? ADJECTIVE_POOL : NOUN_POOL)
    const noun = pick(NOUN_POOL)
    return cap(adj) + cap(noun)
}

/**
 * Generate a 4-word passphrase room name, e.g. "amber-basin-coral-drift"
 */
export function generateRoomName() {
    return [pick(PHRASE_POOL), pick(PHRASE_POOL), pick(PHRASE_POOL), pick(PHRASE_POOL)].join('-')
}

/**
 * Generate a deterministic avatar seed from a username string.
 * Returns a stable string used to render a DiceBear SVG.
 */
export function generateAvatarSeed(username) {
    // Simple hash → stable seed so same username always gets same avatar
    let h = 0
    for (let i = 0; i < username.length; i++) {
        h = (Math.imul(31, h) + username.charCodeAt(i)) | 0
    }
    return Math.abs(h).toString(36)
}
