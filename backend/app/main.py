from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import Base, engine
from .routers import scripts, profile, generate, transcribe


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="TikTok Script App", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(scripts.router)
app.include_router(profile.router)
app.include_router(generate.router)
app.include_router(transcribe.router)


@app.get("/keys/status")
def keys_status():
    """Frontend dùng để bật/tắt nút tuỳ key có hay không."""
    from .config import has_llm_key, has_stt_key, settings
    return {
        "llm": has_llm_key(),
        "stt": has_stt_key(),
        "provider": settings.llm_provider,
    }
