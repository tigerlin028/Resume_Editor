import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Session, Resume
from app.schemas import ProfileOut, ProfileUpdateRequest, ProfileAddTextRequest, ResumeUploadResponse
from app.services.profile_service import (
    get_or_create_profile, merge_resume_into_profile, append_manual_text
)

router = APIRouter()


@router.get("", response_model=ProfileOut)
async def get_profile(db: AsyncSession = Depends(get_db)):
    profile = await get_or_create_profile(db)
    await db.commit()
    return profile


@router.put("", response_model=ProfileOut)
async def update_profile(req: ProfileUpdateRequest, db: AsyncSession = Depends(get_db)):
    profile = await get_or_create_profile(db)
    profile.structured_text = req.structured_text
    first_line = req.structured_text.split('\n')[0]
    if 'PROFILE:' in first_line:
        profile.owner_name = first_line.split('PROFILE:', 1)[-1].strip()
    await db.commit()
    await db.refresh(profile)
    return profile


@router.post("/add-text", response_model=ProfileOut)
async def add_text(req: ProfileAddTextRequest, db: AsyncSession = Depends(get_db)):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="内容不能为空")
    profile = await append_manual_text(db, req.text)
    return profile


@router.post("/start-session", response_model=ResumeUploadResponse)
async def start_session_from_profile(db: AsyncSession = Depends(get_db)):
    """Create a new session backed by the saved profile (no file upload needed)."""
    profile = await get_or_create_profile(db)
    if not profile.structured_text.strip():
        raise HTTPException(status_code=404, detail="尚无保存的档案，请先上传简历")

    session = Session(title="从档案生成 - 个人档案", status="pending")
    db.add(session)
    await db.flush()

    resume = Resume(
        session_id=session.id,
        original_filename="个人档案",
        file_path="profile",
        file_type="profile",
        parsed_text=profile.structured_text,
    )
    db.add(resume)
    await db.commit()
    await db.refresh(resume)

    return ResumeUploadResponse(
        resume_id=resume.id,
        session_id=session.id,
        original_filename="个人档案",
        file_type="profile",
        parsed_text=profile.structured_text,
    )
