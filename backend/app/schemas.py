from datetime import datetime
from pydantic import BaseModel, ConfigDict


class ScriptBase(BaseModel):
    title: str = ""
    input_text: str = ""
    generated_text: str = ""
    status: str = "draft"


class ScriptCreate(ScriptBase):
    pass


class ScriptUpdate(BaseModel):
    title: str | None = None
    input_text: str | None = None
    generated_text: str | None = None
    status: str | None = None


class ScriptOut(ScriptBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime
