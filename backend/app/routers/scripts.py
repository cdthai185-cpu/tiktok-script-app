from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db, backup_sqlite
from ..models import Script
from ..schemas import ScriptCreate, ScriptOut, ScriptUpdate

router = APIRouter(prefix="/scripts", tags=["scripts"])


@router.get("", response_model=list[ScriptOut])
def list_scripts(db: Session = Depends(get_db)):
    return db.query(Script).order_by(Script.updated_at.desc()).all()


@router.post("", response_model=ScriptOut, status_code=201)
def create_script(payload: ScriptCreate, db: Session = Depends(get_db)):
    backup_sqlite()
    obj = Script(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/{script_id}", response_model=ScriptOut)
def get_script(script_id: int, db: Session = Depends(get_db)):
    obj = db.get(Script, script_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Script not found")
    return obj


@router.put("/{script_id}", response_model=ScriptOut)
def update_script(script_id: int, payload: ScriptUpdate, db: Session = Depends(get_db)):
    obj = db.get(Script, script_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Script not found")
    backup_sqlite()
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{script_id}", status_code=204)
def delete_script(script_id: int, db: Session = Depends(get_db)):
    obj = db.get(Script, script_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Script not found")
    backup_sqlite()
    db.delete(obj)
    db.commit()
