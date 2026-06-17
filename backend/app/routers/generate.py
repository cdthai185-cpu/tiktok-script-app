from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Script
from ..services import generation_service
from ..services.generation_service import GenerationError

router = APIRouter(tags=["generate"])


class GenerateIn(BaseModel):
    input_text: str


@router.post("/generate")
def generate_standalone(payload: GenerateIn):
    try:
        return generation_service.generate_variants(payload.input_text)
    except GenerationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/scripts/{script_id}/generate")
def generate_for_script(script_id: int, db: Session = Depends(get_db)):
    obj = db.get(Script, script_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Script not found")
    if not obj.input_text.strip():
        raise HTTPException(status_code=400, detail="Script chưa có mô tả (input_text trống).")
    try:
        return generation_service.generate_variants(obj.input_text)
    except GenerationError as e:
        raise HTTPException(status_code=400, detail=str(e))
