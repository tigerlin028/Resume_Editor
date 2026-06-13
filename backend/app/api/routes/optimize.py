import json
import asyncio
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import Session, Resume, Optimization
from app.schemas import OptimizeRequest, OptimizeStartResponse, OptimizationResult
from app.services.claude_service import stream_optimization
from app.services.diff_service import compute_diff

router = APIRouter()

# In-memory store for active optimization streams: session_id -> asyncio.Queue
_streams: dict[int, asyncio.Queue] = {}


@router.post("", response_model=OptimizeStartResponse)
async def start_optimization(
    req: OptimizeRequest,
    db: AsyncSession = Depends(get_db),
):
    # Validate resume belongs to session
    resume = await db.get(Resume, req.resume_id)
    if not resume or resume.session_id != req.session_id:
        raise HTTPException(status_code=404, detail="简历不存在")

    session = await db.get(Session, req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")

    # Update session title if JD provided
    if req.jd_text:
        jd_snippet = req.jd_text[:30].replace("\n", " ")
        session.title = f"{jd_snippet}… - {resume.original_filename}"
        session.status = "processing"

    # Create optimization row
    opt = Optimization(
        session_id=req.session_id,
        resume_id=req.resume_id,
        jd_text=req.jd_text,
        instructions=req.instructions,
        parent_id=req.parent_id,
    )
    db.add(opt)
    await db.commit()
    await db.refresh(opt)

    # Prepare stream queue and kick off background task
    queue: asyncio.Queue = asyncio.Queue()
    _streams[req.session_id] = queue

    asyncio.create_task(
        _run_optimization(opt.id, resume.parsed_text, req.jd_text, req.instructions, queue)
    )

    return OptimizeStartResponse(optimization_id=opt.id, session_id=req.session_id)


async def _run_optimization(
    opt_id: int,
    resume_text: str,
    jd_text: str,
    instructions: str | None,
    queue: asyncio.Queue,
):
    from app.database import AsyncSessionLocal

    full_text = []
    usage_data = {}

    try:
        async for event_json in stream_optimization(resume_text, jd_text, instructions):
            event = json.loads(event_json)
            if event["type"] == "token":
                full_text.append(event["content"])
            elif event["type"] == "done":
                usage_data = event
            await queue.put(event_json)

        optimized_text = "".join(full_text)
        diff_json = compute_diff(resume_text, optimized_text)

        async with AsyncSessionLocal() as db:
            opt = await db.get(Optimization, opt_id)
            if opt:
                opt.optimized_text = optimized_text
                opt.diff_json = diff_json
                opt.input_tokens = usage_data.get("input_tokens")
                opt.output_tokens = usage_data.get("output_tokens")
                opt.cache_read_tokens = usage_data.get("cache_read_tokens")
                opt.cache_creation_tokens = usage_data.get("cache_creation_tokens")

                session = await db.get(Session, opt.session_id)
                if session:
                    session.status = "completed"

                await db.commit()

    except Exception as e:
        async with AsyncSessionLocal() as db:
            opt = await db.get(Optimization, opt_id)
            if opt:
                session = await db.get(Session, opt.session_id)
                if session:
                    session.status = "failed"
                await db.commit()

        await queue.put(json.dumps({"type": "error", "message": str(e)}))
    finally:
        await queue.put(None)  # sentinel


@router.get("/stream/{session_id}")
async def stream_result(session_id: int):
    async def generate():
        queue = _streams.get(session_id)
        if queue is None:
            yield f"data: {json.dumps({'type': 'error', 'message': '没有进行中的优化任务'})}\n\n"
            return

        while True:
            item = await queue.get()
            if item is None:
                _streams.pop(session_id, None)
                yield f"data: {json.dumps({'type': 'end'})}\n\n"
                break
            yield f"data: {item}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/{optimization_id}", response_model=OptimizationResult)
async def get_optimization(optimization_id: int, db: AsyncSession = Depends(get_db)):
    opt = await db.get(Optimization, optimization_id)
    if not opt:
        raise HTTPException(status_code=404, detail="优化记录不存在")
    return opt
