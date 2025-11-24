# main.py
import os
import logging
from typing import List
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware

# load env if using dotenv (keeps parity with your current setup)
from dotenv import load_dotenv
load_dotenv()

# DB and models
from db import engine, Base, get_db
# import models to ensure metadata is registered
import models  # noqa: F401

# routers & handlers
from auth import router as auth_router
from app_resources import router as resources_router

# import specific handler functions & pydantic models from auth to use in aliases
from auth import (
    signup_user,
    login_for_access_token,
    get_profile,
    verify_token_endpoint,
    google_login,
    get_current_active_user,
    UserCreate,
    LoginPayload,
)

# basic logger (stream to stdout so Render captures it)
logger = logging.getLogger("main")
logger.setLevel(logging.INFO)
if not logger.handlers:
    logger.addHandler(logging.StreamHandler())

# Create FastAPI app
app = FastAPI(title="InsightLogs Backend (compat mode)")

# -------------------------
# CORS setup (robust & env-driven)
# -------------------------
# App will read FRONTEND_ORIGIN (single origin) or CORS_ALLOWED_ORIGINS (comma-separated list)
FRONTEND_ORIGIN_ENV = os.environ.get("FRONTEND_ORIGIN", "").strip() or os.environ.get("CORS_ALLOWED_ORIGINS", "").strip()

def _parse_origins(env_value: str) -> List[str]:
    if not env_value:
        return []
    # special-case single '*' to mean allow all (no credentials)
    if env_value == "*":
        return ["*"]
    parts = [p.strip().rstrip("/") for p in env_value.split(",") if p.strip()]
    return parts

origins = _parse_origins(FRONTEND_ORIGIN_ENV)
# sensible fallback for local development if nothing provided
if not origins:
    origins = ["https://insightlogs.onrender.com", "http://localhost:5173"]

# If the user explicitly set '*' we must not set allow_credentials=True
allow_credentials = False if origins == ["*"] else True

logger.info("CORS origins: %s (allow_credentials=%s)", origins, allow_credentials)

# Add CORSMiddleware BEFORE including routers
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------
# Optional: request logging middleware to debug Origin/CORS (safe to keep in prod)
# -------------------------
@app.middleware("http")
async def log_origin_middleware(request: Request, call_next):
    origin = request.headers.get("origin")
    logger.info("INCOMING: %s %s Origin=%s", request.method, request.url.path, origin)
    response = await call_next(request)
    logger.info("OUTGOING: %s %s Access-Control-Allow-Origin=%s",
                request.method, request.url.path, response.headers.get("access-control-allow-origin"))
    return response

# Include routers
app.include_router(auth_router, prefix="/auth")
app.include_router(resources_router, prefix="")

# Create tables at startup (dev convenience). Doing this at startup avoids surprising create_all at import-time.
@app.on_event("startup")
def on_startup():
    try:
        logger.info("Running Base.metadata.create_all(bind=engine)")
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        logger.exception("Failed to create DB tables on startup: %s", e)

# Root / health
@app.get("/")
def root():
    return {"ok": True, "message": "InsightLogs backend running"}

@app.get("/health")
def health():
    return {"status": "ok"}

# -------------------------
# Legacy compatibility aliases (unchanged)
# -------------------------
@app.post("/signup", tags=["compat"])
def signup_compat(user: UserCreate, db = Depends(get_db)):
    return signup_user(user=user, db=db)

@app.post("/token", tags=["compat"])
def token_compat(payload: LoginPayload, db = Depends(get_db)):
    return login_for_access_token(payload=payload, db=db)

@app.post("/api/auth/token", tags=["compat"])
def token_compat_api(payload: LoginPayload, db = Depends(get_db)):
    return login_for_access_token(payload=payload, db=db)

@app.get("/profile", tags=["compat"])
def profile_compat(current_user = Depends(get_current_active_user)):
    return get_profile(current_user=current_user)

@app.get("/verify-token", tags=["compat"])
def verify_token_compat(current_user = Depends(get_current_active_user)):
    return verify_token_endpoint(current_user=current_user)

@app.post("/api/auth/google-login", tags=["compat"])
def google_login_compat(request: Request, db = Depends(get_db)):
    return google_login(request=request, db=db)
