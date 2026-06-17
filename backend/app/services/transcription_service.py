from __future__ import annotations
from pathlib import Path

from openai import OpenAI

from ..config import settings, has_stt_key, UPLOADS_DIR


class TranscriptionError(RuntimeError):
    pass


def _stt_client() -> tuple[OpenAI, str]:
    """
    Trả (client, model).
    Ưu tiên Groq Whisper (free). Fallback OpenAI Whisper nếu chỉ có OpenAI key.
    """
    if not has_stt_key():
        raise TranscriptionError(
            "Cả GROQ_API_KEY và OPENAI_API_KEY đều chưa set. "
            "Paste key (khuyên Groq, free) vào backend/.env rồi restart backend."
        )

    g = (settings.groq_api_key or "").strip()
    if g and not g.endswith("XXXXX") and len(g) > 20:
        return OpenAI(api_key=g, base_url=settings.groq_base_url), settings.groq_stt_model

    return OpenAI(api_key=settings.openai_api_key), settings.whisper_model


def transcribe_file(path: Path) -> dict:
    client, model = _stt_client()
    if not path.exists():
        raise TranscriptionError(f"File không tồn tại: {path}")

    with path.open("rb") as f:
        resp = client.audio.transcriptions.create(
            model=model,
            file=f,
            language="vi",
            response_format="verbose_json",
        )

    text = getattr(resp, "text", "") or ""
    duration = getattr(resp, "duration", None)
    return {
        "text": text.strip(),
        "duration_seconds": duration,
        "filename": path.name,
        "model": model,
    }


def save_upload(content: bytes, original_name: str) -> Path:
    import secrets
    import re

    safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", original_name)[:60]
    token = secrets.token_hex(4)
    path = UPLOADS_DIR / f"{token}_{safe_name}"
    path.write_bytes(content)
    return path
