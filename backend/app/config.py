import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent

# Production (Fly.io / cloud) dùng /data volume.
# Local dev dùng folder cùng cấp project.
DATA_ROOT = Path(os.environ.get("DATA_ROOT") or BASE_DIR.parent)
DATA_DIR = DATA_ROOT / "data"
PROFILES_DIR = DATA_ROOT / "profiles"
UPLOADS_DIR = DATA_DIR / "uploads"
PROFILE_FILE = DATA_ROOT / "profile.md"

DATA_DIR.mkdir(parents=True, exist_ok=True)
PROFILES_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Lần đầu chạy production (volume rỗng): copy profile.md mặc định từ image
_default_profile = BASE_DIR.parent / "profile.md"
if not PROFILE_FILE.exists() and _default_profile.exists() and PROFILE_FILE != _default_profile:
    PROFILE_FILE.write_text(_default_profile.read_text(encoding="utf-8"), encoding="utf-8")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(BASE_DIR / ".env"), extra="ignore")

    database_url: str = f"sqlite:///{DATA_DIR / 'app.db'}"
    cors_origins: str = "http://localhost:3000"

    # === LLM provider ===
    # Mặc định Groq (free, không cần thẻ).
    # Để chuyển sang Anthropic: set llm_provider=anthropic và anthropic_api_key.
    llm_provider: str = "groq"

    # Groq (free)
    groq_api_key: str = ""
    # Model chính + fallback chain khi 429 (mỗi model quota riêng)
    groq_llm_model: str = "llama-3.3-70b-versatile"
    # Fallback: openai/gpt-oss-120b (Groq host OpenAI open-source, mạnh) → 8b-instant (nhẹ)
    groq_llm_fallbacks: str = "openai/gpt-oss-120b,llama-3.1-8b-instant"
    groq_stt_model: str = "whisper-large-v3"
    groq_base_url: str = "https://api.groq.com/openai/v1"

    # Anthropic (paid — bật khi muốn nâng cấp giọng)
    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-4-5"

    # OpenAI (chỉ cần nếu dùng Whisper API trả phí thay vì Groq)
    openai_api_key: str = ""
    whisper_model: str = "whisper-1"

    # Generation control (tối ưu cho Groq free 100k tokens/day)
    llm_max_tokens: int = 1500
    generation_variants: int = 3
    critique_max_regens: int = 1  # 1 regen thay vì 2 → tiết kiệm ~30% quota


settings = Settings()


def _is_real_key(k: str) -> bool:
    k = (k or "").strip()
    return bool(k) and not k.endswith("XXXXX") and len(k) > 20


def has_llm_key() -> bool:
    if settings.llm_provider == "groq":
        return _is_real_key(settings.groq_api_key)
    if settings.llm_provider == "anthropic":
        return _is_real_key(settings.anthropic_api_key)
    return False


def has_stt_key() -> bool:
    # STT mặc định cũng đi qua Groq (whisper-large-v3 free).
    # Nếu dùng OpenAI Whisper trả phí thì check openai key.
    if _is_real_key(settings.groq_api_key):
        return True
    return _is_real_key(settings.openai_api_key)
