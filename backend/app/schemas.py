from datetime import datetime
from pydantic import BaseModel


class ResumeUploadResponse(BaseModel):
    resume_id: int
    session_id: int
    original_filename: str
    file_type: str
    parsed_text: str


class OptimizeRequest(BaseModel):
    session_id: int
    resume_id: int
    jd_text: str
    instructions: str | None = None
    parent_id: int | None = None


class OptimizeStartResponse(BaseModel):
    optimization_id: int
    session_id: int


class OptimizationResult(BaseModel):
    id: int
    session_id: int
    resume_id: int
    jd_text: str
    instructions: str | None
    optimized_text: str | None
    diff_json: str | None
    parent_id: int | None
    input_tokens: int | None
    output_tokens: int | None
    cache_read_tokens: int | None
    cache_creation_tokens: int | None
    created_at: datetime

    class Config:
        from_attributes = True


class SessionSummary(BaseModel):
    id: int
    title: str
    status: str
    created_at: datetime
    optimization_count: int = 0

    class Config:
        from_attributes = True


class SessionDetail(BaseModel):
    id: int
    title: str
    status: str
    created_at: datetime
    resume_id: int
    resume_filename: str
    parsed_text: str
    optimizations: list[OptimizationResult]

    class Config:
        from_attributes = True


class HistoryListResponse(BaseModel):
    items: list[SessionSummary]
    total: int
    page: int
    limit: int


class ExportResponse(BaseModel):
    export_id: int
    download_url: str


class ProfileOut(BaseModel):
    id: int
    owner_name: str | None
    structured_text: str
    updated_at: datetime

    class Config:
        from_attributes = True


class ProfileUpdateRequest(BaseModel):
    structured_text: str


class ProfileAddTextRequest(BaseModel):
    text: str
