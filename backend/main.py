from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.api.routes import resume, optimize, history, export, profile


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Resume Editor API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(resume.router, prefix="/api/v1/resumes", tags=["resumes"])
app.include_router(optimize.router, prefix="/api/v1/optimize", tags=["optimize"])
app.include_router(history.router, prefix="/api/v1/history", tags=["history"])
app.include_router(export.router, prefix="/api/v1/export", tags=["export"])
app.include_router(profile.router, prefix="/api/v1/profile", tags=["profile"])


@app.get("/")
async def root():
    return {"status": "ok", "message": "Resume Editor API"}
