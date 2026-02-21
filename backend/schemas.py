"""schemas.py — Pydantic request/response models"""
from pydantic import BaseModel, Field


class RoomCreate(BaseModel):
    room_name: str = Field(..., min_length=3, max_length=128, pattern=r'^[a-z0-9\-]+$')
    password: str = Field(..., min_length=8, max_length=128)


class RoomResponse(BaseModel):
    room_name: str
    exists: bool
