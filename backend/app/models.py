from datetime import datetime
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    resumes: Mapped[list["Resume"]] = relationship(back_populates="session", cascade="all, delete-orphan")
    optimizations: Mapped[list["Optimization"]] = relationship(back_populates="session", cascade="all, delete-orphan")


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    file_type: Mapped[str] = mapped_column(String(10), nullable=False)
    parsed_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    session: Mapped["Session"] = relationship(back_populates="resumes")
    optimizations: Mapped[list["Optimization"]] = relationship(back_populates="resume")


class Optimization(Base):
    __tablename__ = "optimizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"), nullable=False)
    resume_id: Mapped[int] = mapped_column(ForeignKey("resumes.id"), nullable=False)
    jd_text: Mapped[str] = mapped_column(Text, nullable=False)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    optimized_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    diff_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("optimizations.id"), nullable=True)
    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cache_read_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cache_creation_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    session: Mapped["Session"] = relationship(back_populates="optimizations")
    resume: Mapped["Resume"] = relationship(back_populates="optimizations")
    exports: Mapped[list["Export"]] = relationship(back_populates="optimization", cascade="all, delete-orphan")


class Export(Base):
    __tablename__ = "exports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    optimization_id: Mapped[int] = mapped_column(ForeignKey("optimizations.id"), nullable=False)
    format: Mapped[str] = mapped_column(String(10), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    optimization: Mapped["Optimization"] = relationship(back_populates="exports")


class Profile(Base):
    """Single-row candidate profile accumulating all resume versions."""
    __tablename__ = "profile"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    structured_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
