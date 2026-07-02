from datetime import datetime
from sqlalchemy import String, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class Script(Base):
    __tablename__ = "scripts"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), default="")
    input_text: Mapped[str] = mapped_column(Text, default="")
    generated_text: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="draft")

    # === NEW: kịch bản chi tiết ===
    duration_seconds: Mapped[int] = mapped_column(default=60)
    # Văn phong: default | humor | deep | storytelling | energetic | selfmock
    style_tone: Mapped[str] = mapped_column(String(40), default="default")
    # Q&A: các câu trả lời của user cho câu hỏi app suggest
    context_qa: Mapped[str] = mapped_column(Text, default="")

    # Loại video: product | vlog | knowledge | case | opinion
    # Quyết định tỷ lệ 5 lớp nội dung
    video_type: Mapped[str] = mapped_column(String(20), default="knowledge")
    # Bối cảnh quay (showroom / công trường / studio / ngoài đường...)
    context_scene: Mapped[str] = mapped_column(Text, default="")
    # Thông điệp chính (1 câu tổng kết ý muốn truyền tải)
    main_message: Mapped[str] = mapped_column(Text, default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
