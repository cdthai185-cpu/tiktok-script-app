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
    duration_seconds: int = 60
    style_tone: str = "default"
    context_qa: str = ""
    video_type: str = "knowledge"
    context_scene: str = ""
    main_message: str = ""


class QuestionsIn(BaseModel):
    input_text: str
    duration_seconds: int = 60
    video_type: str = "knowledge"


@router.post("/generate")
def generate_standalone(payload: GenerateIn):
    try:
        return generation_service.generate_variants(
            payload.input_text,
            duration_seconds=payload.duration_seconds,
            tone=payload.style_tone,
            context_qa=payload.context_qa,
            video_type=payload.video_type,
            context_scene=payload.context_scene,
            main_message=payload.main_message,
        )
    except GenerationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/scripts/{script_id}/generate")
def generate_for_script(script_id: int, db: Session = Depends(get_db)):
    obj = db.get(Script, script_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Script not found")
    if not obj.input_text.strip():
        raise HTTPException(status_code=400, detail="Script chưa có dàn ý (input_text trống).")
    try:
        return generation_service.generate_variants(
            obj.input_text,
            duration_seconds=obj.duration_seconds or 60,
            tone=obj.style_tone or "default",
            context_qa=obj.context_qa or "",
            video_type=obj.video_type or "knowledge",
            context_scene=obj.context_scene or "",
            main_message=obj.main_message or "",
        )
    except GenerationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/suggest_questions")
def suggest_questions_standalone(payload: QuestionsIn):
    try:
        return generation_service.suggest_questions(
            payload.input_text,
            duration_seconds=payload.duration_seconds,
            video_type=payload.video_type,
        )
    except GenerationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/scripts/{script_id}/suggest_questions")
def suggest_questions_for_script(script_id: int, db: Session = Depends(get_db)):
    obj = db.get(Script, script_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Script not found")
    if not obj.input_text.strip():
        raise HTTPException(status_code=400, detail="Cần dàn ý trước khi hỏi.")
    try:
        return generation_service.suggest_questions(
            obj.input_text,
            duration_seconds=obj.duration_seconds or 60,
            video_type=obj.video_type or "knowledge",
        )
    except GenerationError as e:
        raise HTTPException(status_code=400, detail=str(e))
