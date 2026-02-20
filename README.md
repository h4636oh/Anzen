# Anzen — Private P2P Chat

**End-to-end encrypted peer-to-peer chat. No message ever touches a server.**

## Stack
| Layer | Tech |
|---|---|
| Frontend | React + Vite (JS), Tailwind CSS |
| Local storage | IndexedDB via `localforage` |
| Avatars | DiceBear `bottts` |
| Username gen | `an-array-of-english-words` (real dictionary, heuristic filtered) |
| Backend (signaling only) | FastAPI + SQLite/PostgreSQL |
| P2P transport | WebRTC Data Channels (DTLS end-to-end encrypted) |

## Running Locally

### 1. Backend
```bash
cd backend
cp .env.example .env          # edit as needed
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

## Privacy Model

- The backend **only** stores room names + bcrypt-hashed passwords in SQLite/PostgreSQL.
- All peer connection state lives in RAM and is wiped on disconnect.
- The backend never reads or logs the contents of SDP offers/answers or ICE candidates.
- All chat data travels directly peer-to-peer over DTLS-encrypted RTCDataChannels.
- "Clear Chat" wipes the entire IndexedDB (messages, rooms, identity).

## Architecture

```
Browser A                    FastAPI (signaling)            Browser B
   |                               |                            |
   |── WS /ws/{room} ─────────────►|                            |
   |       join (password hash) ──►|                            |
   |◄────── joined (peers list) ───|                            |
   |                               |◄──── WS /ws/{room} ───────|
   |                               |◄──── join ────────────────|
   |◄────── peer-joined ───────────|                            |
   |                               |──── peer-joined ──────────►|
   |── offer ──────────────────────►────────────────────────────►|
   |◄──────────────────────────────◄──── answer ─────────────── |
   |── ice-candidate ──────────────►────────────────────────────►|
   |◄──────────────────────────────◄──── ice-candidate ─────────|
   |                                                             |
   |◄═══════════════ WebRTC DataChannel (DTLS) ═════════════════►|
   |                      messages / files                       |
```
