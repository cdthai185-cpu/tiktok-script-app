from __future__ import annotations
from datetime import datetime
from pathlib import Path

from ..config import PROFILE_FILE, PROFILES_DIR

PROFILE_PATH = PROFILE_FILE
SNAPSHOT_PREFIX = "profile-"
SNAPSHOT_SUFFIX = ".md"


def _ensure_profile_exists() -> None:
    if not PROFILE_PATH.exists():
        PROFILE_PATH.write_text(
            "# Hồ sơ phong cách\n\n(Trống — chỉnh sửa ở giao diện app)\n",
            encoding="utf-8",
        )


def read_profile() -> dict:
    _ensure_profile_exists()
    content = PROFILE_PATH.read_text(encoding="utf-8")
    stat = PROFILE_PATH.stat()
    return {
        "content": content,
        "updated_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        "size_bytes": stat.st_size,
    }


def _snapshot_filename(now: datetime) -> str:
    return f"{SNAPSHOT_PREFIX}{now.strftime('%Y%m%d-%H%M%S')}{SNAPSHOT_SUFFIX}"


def write_profile(new_content: str) -> dict:
    _ensure_profile_exists()
    now = datetime.now()
    # Snapshot bản hiện tại TRƯỚC khi ghi đè
    current = PROFILE_PATH.read_text(encoding="utf-8")
    snapshot_path = PROFILES_DIR / _snapshot_filename(now)
    snapshot_path.write_text(current, encoding="utf-8")

    PROFILE_PATH.write_text(new_content, encoding="utf-8")
    return {
        "content": new_content,
        "updated_at": datetime.now().isoformat(),
        "size_bytes": len(new_content.encode("utf-8")),
        "snapshot": snapshot_path.name,
    }


def list_snapshots() -> list[dict]:
    files = sorted(
        PROFILES_DIR.glob(f"{SNAPSHOT_PREFIX}*{SNAPSHOT_SUFFIX}"),
        reverse=True,
    )
    out: list[dict] = []
    for f in files:
        stat = f.stat()
        out.append({
            "name": f.name,
            "size_bytes": stat.st_size,
            "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        })
    return out


def read_snapshot(name: str) -> dict:
    # Chặn path traversal: chỉ cho phép tên đúng pattern
    if not name.startswith(SNAPSHOT_PREFIX) or not name.endswith(SNAPSHOT_SUFFIX):
        raise FileNotFoundError(name)
    if "/" in name or "\\" in name or ".." in name:
        raise FileNotFoundError(name)
    path = PROFILES_DIR / name
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(name)
    return {
        "name": name,
        "content": path.read_text(encoding="utf-8"),
        "size_bytes": path.stat().st_size,
        "created_at": datetime.fromtimestamp(path.stat().st_mtime).isoformat(),
    }


def restore_snapshot(name: str) -> dict:
    snap = read_snapshot(name)
    return write_profile(snap["content"])
