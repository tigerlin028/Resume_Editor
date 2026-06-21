import os
import re
import uuid
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Optimization, Export, Session
from app.schemas import ExportResponse, CustomExportRequest
from app.services.export_service import export_to_docx, export_to_pdf
from app.config import settings


def _build_filename(opt: Optimization, session: Session, ext: str) -> str:
    company = re.sub(r'[^\w\s\-]', '', session.title or '').strip().replace(' ', '_') or 'Resume'
    return f"{company}.{ext}"

router = APIRouter()

_MEDIA = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def _rm(path: str) -> None:
    try:
        os.unlink(path)
    except OSError:
        pass


@router.post("/custom/{fmt}")
async def export_custom(fmt: str, body: CustomExportRequest, background_tasks: BackgroundTasks):
    if fmt not in ("pdf", "docx"):
        raise HTTPException(status_code=400, detail="fmt must be pdf or docx")

    export_dir = Path(settings.upload_dir) / "exports"
    export_dir.mkdir(parents=True, exist_ok=True)

    tmp_path = str(export_dir / f"{uuid.uuid4().hex}.{fmt}")
    try:
        if fmt == "pdf":
            export_to_pdf(body.text, tmp_path)
        else:
            export_to_docx(body.text, tmp_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败：{e}")

    background_tasks.add_task(_rm, tmp_path)
    return FileResponse(path=tmp_path, media_type=_MEDIA[fmt], filename=f"Resume_edited.{fmt}")


async def _generate_export(
    optimization_id: int,
    fmt: str,
    db: AsyncSession,
) -> ExportResponse:
    opt = await db.get(Optimization, optimization_id)
    if not opt or not opt.optimized_text:
        raise HTTPException(status_code=404, detail="优化结果不存在")

    export_dir = Path(settings.upload_dir) / "exports"
    export_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4().hex}.{fmt}"
    output_path = str(export_dir / filename)

    try:
        if fmt == "pdf":
            export_to_pdf(opt.optimized_text, output_path)
        else:
            export_to_docx(opt.optimized_text, output_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败：{e}")

    export = Export(
        optimization_id=optimization_id,
        format=fmt,
        file_path=output_path,
    )
    db.add(export)
    await db.commit()
    await db.refresh(export)

    return ExportResponse(
        export_id=export.id,
        download_url=f"/api/v1/export/download/{export.id}",
    )


@router.post("/{optimization_id}/pdf", response_model=ExportResponse)
async def export_pdf(optimization_id: int, db: AsyncSession = Depends(get_db)):
    return await _generate_export(optimization_id, "pdf", db)


@router.post("/{optimization_id}/docx", response_model=ExportResponse)
async def export_docx(optimization_id: int, db: AsyncSession = Depends(get_db)):
    return await _generate_export(optimization_id, "docx", db)


@router.get("/download/{export_id}")
async def download_export(export_id: int, db: AsyncSession = Depends(get_db)):
    export = await db.get(Export, export_id)
    if not export or not Path(export.file_path).exists():
        raise HTTPException(status_code=404, detail="文件不存在")

    opt = await db.get(Optimization, export.optimization_id)
    session = await db.get(Session, opt.session_id) if opt else None

    media_types = {
        "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    ext = "pdf" if export.format == "pdf" else "docx"
    filename = _build_filename(opt, session, ext) if opt and session else f"Resume.{ext}"
    return FileResponse(
        path=export.file_path,
        media_type=media_types.get(export.format, "application/octet-stream"),
        filename=filename,
    )
