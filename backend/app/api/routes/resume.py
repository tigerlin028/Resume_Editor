import uuid
import os
import asyncio
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import aiofiles

from app.database import get_db, AsyncSessionLocal
from app.models import Session, Resume
from app.schemas import ResumeUploadResponse
from app.services.resume_parser import parse_resume
from app.config import settings

router = APIRouter()

ALLOWED_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/msword": "docx",
}


async def _background_merge(parsed_text: str):
    """Merge the new resume into the profile in the background."""
    from app.services.profile_service import merge_resume_into_profile
    try:
        async with AsyncSessionLocal() as db:
            await merge_resume_into_profile(db, parsed_text)
    except Exception:
        pass  # profile merge failure must not affect upload


@router.post("/upload", response_model=ResumeUploadResponse)
async def upload_resume(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
):
    content_type = file.content_type or ""
    file_type = ALLOWED_TYPES.get(content_type)

    # Fallback: check extension
    if not file_type and file.filename:
        ext = Path(file.filename).suffix.lower()
        if ext == ".pdf":
            file_type = "pdf"
        elif ext in (".docx", ".doc"):
            file_type = "docx"

    if not file_type:
        raise HTTPException(status_code=400, detail="只支持 PDF 或 Word (.docx) 格式")

    # Save file
    upload_dir = Path(settings.upload_dir) / "resumes"
    upload_dir.mkdir(parents=True, exist_ok=True)
    saved_name = f"{uuid.uuid4().hex}.{file_type}"
    file_path = upload_dir / saved_name

    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    # Parse
    try:
        parsed_text = parse_resume(str(file_path), file_type)
    except Exception as e:
        os.unlink(file_path)
        raise HTTPException(status_code=422, detail=f"简历解析失败：{e}")

    if not parsed_text.strip():
        os.unlink(file_path)
        raise HTTPException(status_code=422, detail="简历内容为空，请检查文件")

    # Create session + resume
    session = Session(
        title=f"简历优化 - {file.filename}",
        status="pending",
    )
    db.add(session)
    await db.flush()

    resume = Resume(
        session_id=session.id,
        original_filename=file.filename or saved_name,
        file_path=str(file_path),
        file_type=file_type,
        parsed_text=parsed_text,
    )
    db.add(resume)
    await db.commit()
    await db.refresh(resume)

    # Merge into profile asynchronously (don't block the response)
    asyncio.create_task(_background_merge(parsed_text))

    return ResumeUploadResponse(
        resume_id=resume.id,
        session_id=session.id,
        original_filename=resume.original_filename,
        file_type=file_type,
        parsed_text=parsed_text,
    )
