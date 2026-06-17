import shutil
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings, DATA_DIR


class Base(DeclarativeBase):
    pass


engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def backup_sqlite() -> Path | None:
    if not settings.database_url.startswith("sqlite"):
        return None
    db_path = DATA_DIR / "app.db"
    if not db_path.exists():
        return None
    backup_path = DATA_DIR / "app.db.bak"
    shutil.copy2(db_path, backup_path)
    return backup_path


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
