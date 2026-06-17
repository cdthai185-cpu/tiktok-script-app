from fastapi import APIRouter, File, HTTPException, UploadFile

from ..services import transcription_service
from ..services.transcription_service import TranscriptionError

router = APIRouter(tags=["transcribe"])

# Giới hạn upload mặc định 25MB (đủ ~25 phút audio nén opus 128kbps)
MAX_UPLOAD_BYTES = 25 * 1024 * 1024


@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File quá lớn ({len(raw)} bytes). Tối đa {MAX_UPLOAD_BYTES} bytes.",
        )
    if len(raw) < 1024:
        raise HTTPException(status_code=400, detail="File quá ngắn hoặc trống.")

    path = transcription_service.save_upload(raw, file.filename or "upload")
    try:
        return transcription_service.transcribe_file(path)
    except TranscriptionError as e:
        raise HTTPException(status_code=400, detail=str(e))
