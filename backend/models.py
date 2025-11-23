from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from db import Base  # import the Base from db.py

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, default="")
    email = Column(String(150), unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String(50), nullable=False)
    organization = Column(String(150), nullable=True)
    tech_stack = Column(String(150), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    firebase_uid = Column(String(128), unique=True, nullable=True)
    verified_at = Column(DateTime, nullable=True)

class Upload(Base):
    __tablename__ = "uploads"
    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String(150), nullable=False, index=True)
    filename = Column(String(300), nullable=False)
    storage_path = Column(String(500), nullable=False)
    size = Column(Integer, nullable=False)
    checksum = Column(String(128), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    parsed_count = Column(Integer, default=0)

class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"
    id = Column(Integer, primary_key=True, index=True)
    upload_id = Column(Integer, ForeignKey("uploads.id"), nullable=False, index=True)
    user_email = Column(String(150), nullable=False, index=True)
    status = Column(String(50), default="queued")  # queued|running|done|failed
    progress = Column(Integer, default=0)
    result_path = Column(String(500), nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    upload = relationship("Upload", primaryjoin="AnalysisJob.upload_id==Upload.id")

class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("analysis_jobs.id"), nullable=False)
    user_email = Column(String(150), nullable=False, index=True)
    title = Column(String(250), default="Analysis report")
    summary = Column(Text, nullable=True)
    artifacts_path = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class LogEntry(Base):
    __tablename__ = "log_entries"
    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String(150), nullable=False, index=True)
    upload_id = Column(Integer, ForeignKey("uploads.id"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=True)
    level = Column(String(50), nullable=True)
    service = Column(String(150), nullable=True)
    message = Column(Text, nullable=True)
    raw = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    # NOTE: latency_ms column removed intentionally
