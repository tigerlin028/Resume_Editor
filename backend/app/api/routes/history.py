from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete

from app.database import get_db
from app.models import Session, Resume, Optimization, Export
from app.schemas import HistoryListResponse, SessionSummary, SessionDetail, OptimizationResult, SessionRenameRequest

router = APIRouter()


@router.get("", response_model=HistoryListResponse)
async def list_history(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * limit

    total_result = await db.execute(select(func.count()).select_from(Session))
    total = total_result.scalar_one()

    result = await db.execute(
        select(Session).order_by(Session.created_at.desc()).offset(offset).limit(limit)
    )
    sessions = result.scalars().all()

    items = []
    for s in sessions:
        count_result = await db.execute(
            select(func.count()).select_from(Optimization).where(Optimization.session_id == s.id)
        )
        count = count_result.scalar_one()
        items.append(SessionSummary(
            id=s.id,
            title=s.title,
            status=s.status,
            created_at=s.created_at,
            optimization_count=count,
        ))

    return HistoryListResponse(items=items, total=total, page=page, limit=limit)


@router.get("/{session_id}", response_model=SessionDetail)
async def get_session_detail(session_id: int, db: AsyncSession = Depends(get_db)):
    session = await db.get(Session, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")

    resume_result = await db.execute(
        select(Resume).where(Resume.session_id == session_id).order_by(Resume.created_at).limit(1)
    )
    resume = resume_result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")

    opt_result = await db.execute(
        select(Optimization)
        .where(Optimization.session_id == session_id)
        .order_by(Optimization.created_at)
    )
    optimizations = opt_result.scalars().all()

    return SessionDetail(
        id=session.id,
        title=session.title,
        status=session.status,
        created_at=session.created_at,
        resume_id=resume.id,
        resume_filename=resume.original_filename,
        parsed_text=resume.parsed_text,
        optimizations=[OptimizationResult.model_validate(o) for o in optimizations],
    )


@router.patch("/{session_id}/title")
async def rename_session(session_id: int, body: SessionRenameRequest, db: AsyncSession = Depends(get_db)):
    session = await db.get(Session, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")

    session.title = body.title.strip()
    await db.commit()
    return {"success": True}


@router.delete("/{session_id}")
async def delete_session(session_id: int, db: AsyncSession = Depends(get_db)):
    session = await db.get(Session, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")

    await db.delete(session)
    await db.commit()
    return {"success": True}
