from pydantic_settings import BaseSettings
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    database_url: str = f"sqlite+aiosqlite:///{BASE_DIR}/resume_editor.db"
    upload_dir: str = str(BASE_DIR / "uploads")
    cors_origins: list[str] = ["http://localhost:3000"]

    class Config:
        env_file = str(BASE_DIR / ".env")


settings = Settings()
