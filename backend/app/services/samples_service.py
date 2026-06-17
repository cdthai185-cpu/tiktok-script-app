from __future__ import annotations
from pathlib import Path
import re

from ..config import BASE_DIR, DATA_ROOT, PROFILE_FILE

SAMPLES_PATH = DATA_ROOT / "samples.md"
PROFILE_PATH = PROFILE_FILE


def load_samples() -> list[str]:
    """
    Đọc mẫu kịch bản thật để inject few-shot.

    Ưu tiên:
    1. File samples.md (1 mẫu mỗi block ngăn bởi --- hoặc heading ###)
    2. Fallback: trích mẫu trong profile.md (section "Mẫu giọng thật")
    """
    if SAMPLES_PATH.exists():
        raw = SAMPLES_PATH.read_text(encoding="utf-8").strip()
        if raw:
            return _split_samples(raw)
    return _extract_from_profile()


def _split_samples(raw: str) -> list[str]:
    # Chia theo --- hoặc heading ### Mẫu
    blocks = re.split(r"\n---+\n|\n###\s+", raw)
    out: list[str] = []
    for b in blocks:
        b = b.strip()
        if not b:
            continue
        # Bỏ leading "Mẫu N" nếu có
        b = re.sub(r"^Mẫu\s*\d*\s*\n+", "", b, flags=re.IGNORECASE)
        # Bỏ ngoặc kép quote markdown đầu dòng
        b = re.sub(r"^>\s?", "", b, flags=re.MULTILINE)
        if len(b) > 30:
            out.append(b.strip())
    return out


def _extract_from_profile() -> list[str]:
    if not PROFILE_PATH.exists():
        return []
    raw = PROFILE_PATH.read_text(encoding="utf-8")
    # Tìm section ## Mẫu giọng thật
    m = re.search(
        r"##\s+Mẫu giọng thật.*?(?=\n##\s|\Z)",
        raw,
        re.DOTALL,
    )
    if not m:
        return []
    section = m.group(0)
    return _split_samples(section)


def profile_text() -> str:
    if PROFILE_PATH.exists():
        return PROFILE_PATH.read_text(encoding="utf-8")
    return ""
