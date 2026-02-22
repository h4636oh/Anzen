"""main.py — FastAPI signaling server for Anzen

Privacy guarantees:
  - Backend never inspects or logs message payloads (SDP/ICE are opaque to us
    from a content perspective — we only route them by peerId).
  - In-memory connection registry is dropped entirely on disconnect.
  - No message content is ever written to the database.
"""
import json
import logging
from contextlib import asynccontextmanager
from typing import Any

import bcrypt
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import init_db, get_db
from models import Room
from schemas import RoomCreate, RoomResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("anzen")


def hash_password(plain: str) -> str:
    """Hash a password with bcrypt."""
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a password against its bcrypt hash."""
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


# ── Lifespan ───────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    logger.info("Anzen signaling server started.")
    yield
    logger.info("Anzen signaling server shutting down.")


app = FastAPI(title="Anzen Signaling Server", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── In-memory signaling registry ───────────────────────────────────────────────
# Structure: { room_name: { peer_id: { ws: WebSocket, username: str, avatarSeed: str } } }
# This is NEVER persisted. It lives only in RAM for the duration of the process.
rooms_registry: dict[str, dict[str, dict[str, Any]]] = {}


# ── REST endpoints ─────────────────────────────────────────────────────────────
@app.post("/rooms", status_code=201)
async def create_room(body: RoomCreate, db: AsyncSession = Depends(get_db)):
    """Create a room. Idempotent — if it already exists with the same password, returns 200."""
    result = await db.execute(select(Room).where(Room.room_name == body.room_name))
    existing = result.scalar_one_or_none()
    if existing:
        if not verify_password(body.password, existing.hashed_password):
            raise HTTPException(status_code=409, detail="Room already exists with a different password.")
        return {"room_name": existing.room_name, "created": False}

    room = Room(
        room_name=body.room_name,
        hashed_password=hash_password(body.password),
    )
    db.add(room)
    await db.commit()
    logger.info(f"Room created: {body.room_name}")
    return {"room_name": room.room_name, "created": True}


@app.get("/rooms/{room_name}", response_model=RoomResponse)
async def check_room(room_name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Room).where(Room.room_name == room_name))
    room = result.scalar_one_or_none()
    return {"room_name": room_name, "exists": room is not None}


# ── WebSocket signaling ────────────────────────────────────────────────────────
@app.websocket("/ws/{room_name}")
async def websocket_signaling(room_name: str, ws: WebSocket, db: AsyncSession = Depends(get_db)):
    await ws.accept()

    # Step 1: Receive join message with password + peer identity
    try:
        raw = await ws.receive_text()
        join_msg = json.loads(raw)
    except WebSocketDisconnect:
        return  # client disconnected before sending join — just exit
    except Exception:
        await ws.send_text(json.dumps({"type": "error", "message": "Invalid message format"}))
        await ws.close(code=1003)
        return

    if join_msg.get("type") != "join":
        await ws.send_text(json.dumps({"type": "error", "message": "First message must be type=join"}))
        await ws.close(code=1008)
        return

    password = join_msg.get("password", "")
    peer_id = join_msg.get("peerId", "")
    username = join_msg.get("username", "Unknown")
    avatar_seed = join_msg.get("avatarSeed", "")

    if not peer_id:
        await ws.send_text(json.dumps({"type": "error", "message": "peerId required"}))
        await ws.close(code=1008)
        return

    # Step 2: Verify room password
    result = await db.execute(select(Room).where(Room.room_name == room_name))
    room = result.scalar_one_or_none()
    if not room or not verify_password(password, room.hashed_password):
        await ws.send_text(json.dumps({"type": "error", "message": "Invalid room or password"}))
        await ws.close(code=1008)
        return

    # Step 3: Register peer in memory
    if room_name not in rooms_registry:
        rooms_registry[room_name] = {}

    if len(rooms_registry.get(room_name, {})) >= 200:
        await ws.send_text(json.dumps({"type": "error", "message": "Room is full. Try again later."}))
        await ws.close(code=1008)
        return

    existing_peers = [
        {"peerId": pid, "username": data["username"], "avatarSeed": data["avatarSeed"]}
        for pid, data in rooms_registry[room_name].items()
    ]

    rooms_registry[room_name][peer_id] = {
        "ws": ws,
        "username": username,
        "avatarSeed": avatar_seed,
    }

    # Step 4: Tell this peer about everyone already in the room
    await ws.send_text(json.dumps({"type": "joined", "peers": existing_peers}))

    # Step 5: Tell existing peers about this new joiner
    await _broadcast_to_room_except(room_name, peer_id, {
        "type": "peer-joined",
        "peerId": peer_id,
        "username": username,
        "avatarSeed": avatar_seed,
    })

    logger.info(f"Peer {peer_id[:8]} joined room '{room_name}' (now {len(rooms_registry[room_name])} peers)")

    # Step 6: Relay signaling messages
    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            msg_type = msg.get("type")
            target_id = msg.get("to")

            # We only route these three message types — we never inspect their content
            if msg_type in ("offer", "answer", "ice-candidate") and target_id:
                msg["from"] = peer_id
                msg["username"] = username
                msg["avatarSeed"] = avatar_seed
                await _send_to_peer(room_name, target_id, msg)

    except WebSocketDisconnect:
        pass
    finally:
        # Step 7: Drop all in-memory state for this peer
        rooms_registry.get(room_name, {}).pop(peer_id, None)
        if not rooms_registry.get(room_name):
            rooms_registry.pop(room_name, None)

        await _broadcast_to_room_except(room_name, peer_id, {
            "type": "peer-left",
            "peerId": peer_id,
        })
        logger.info(f"Peer {peer_id[:8]} left room '{room_name}'")


# ── Helpers ────────────────────────────────────────────────────────────────────
async def _send_to_peer(room_name: str, peer_id: str, msg: dict):
    peer = rooms_registry.get(room_name, {}).get(peer_id)
    if peer:
        try:
            await peer["ws"].send_text(json.dumps(msg))
        except Exception:
            pass


async def _broadcast_to_room_except(room_name: str, exclude_peer_id: str, msg: dict):
    room = rooms_registry.get(room_name, {})
    text = json.dumps(msg)
    for pid, data in list(room.items()):
        if pid != exclude_peer_id:
            try:
                await data["ws"].send_text(text)
            except Exception:
                pass
