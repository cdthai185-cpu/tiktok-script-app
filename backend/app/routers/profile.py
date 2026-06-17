from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services import profile_service

router = APIRouter(prefix="/profile", tags=["profile"])


class ProfileWriteIn(BaseModel):
    content: str


@router.get("")
def get_profile():
    return profile_service.read_profile()


@router.put("")
def put_profile(payload: ProfileWriteIn):
    return profile_service.write_profile(payload.content)


@router.get("/snapshots")
def get_snapshots():
    return profile_service.list_snapshots()


@router.get("/snapshots/{name}")
def get_snapshot(name: str):
    try:
        return profile_service.read_snapshot(name)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Snapshot not found")


@router.post("/snapshots/{name}/restore")
def restore_snapshot(name: str):
    try:
        return profile_service.restore_snapshot(name)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Snapshot not found")
