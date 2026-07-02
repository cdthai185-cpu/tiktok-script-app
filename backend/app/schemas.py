from datetime import datetime
from pydantic import BaseModel, ConfigDict


class ScriptBase(BaseModel):
    title: str = ""
    input_text: str = ""
    generated_text: str = ""
    status: str = "draft"
    duration_seconds: int = 60
    style_tone: str = "default"
    context_qa: str = ""
    video_type: str = "knowledge"
    context_scene: str = ""
    main_message: str = ""


class ScriptCreate(ScriptBase):
    pass


class ScriptUpdate(BaseModel):
    title: str | None = None
    input_text: str | None = None
    generated_text: str | None = None
    status: str | None = None
    duration_seconds: int | None = None
    style_tone: str | None = None
    context_qa: str | None = None
    video_type: str | None = None
    context_scene: str | None = None
    main_message: str | None = None


class ScriptOut(ScriptBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime
