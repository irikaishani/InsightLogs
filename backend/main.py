import os
import logging
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

# load env if using dotenv
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

logger = logging.getLogger("main")
logger.setLevel(logging.INFO)
logger.addHandler(logging.StreamHandler())

# Create FastAPI app
app = FastAPI(title="InsightLogs Backend (compat mode)")

# --- CORS setup (robust and safe defaults) -----------------
# Accept either FRONTEND_ORIGIN or CORS_ALLOWED_ORIGINS environment variable (backwards compatible).
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
    origins = ["http://localhost:5173"]

# If the user explicitly set '*' we must not set allow_credentials=True
allow_credentials = False if origins == ["*"] else True

logger.info("CORS origins: %s (allow_credentials=%s)", origins, allow_credentials)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
# - auth_router mounted at /auth (new refactored paths)
app.include_router(auth_router, prefix="/auth")
# - resources router mounted at root (keeps existing resource paths unchanged)
app.include_router(resources_router, prefix="")

# Create tables at startup (dev convenience). Running create_all at import-time may
# be surprising on some deployments, so we perform it on the startup event instead.
@app.on_event("startup")
def on_startup():
    try:
        logger.info("Running Base.metadata.create_all(bind=engine)")
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        logger.exception("Failed to create DB tables on startup: %s", e)


@app.get("/")
def root():
    return {"ok": True, "message": "InsightLogs backend running"}

# Health endpoint (useful for Render and load balancers)
@app.get("/health")
def health():
    return {"status": "ok"}

# -------------------------
# Legacy compatibility aliases
# -------------------------
# These wrappers call the functions defined in auth.py so frontend can keep calling the
# original endpoints (/signup, /token, /profile, /verify-token, /api/auth/google-login, etc.)
# without edits.

# 1) /signup  -> calls auth.signup_user
@app.post("/signup", tags=["compat"])
def signup_compat(user: UserCreate, db: Session = Depends(get_db)):
    """
    Compatibility endpoint: calls auth.signup_user
    """
    return signup_user(user=user, db=db)

# 2) /token -> calls auth.login_for_access_token
@app.post("/token", tags=["compat"])
def token_compat(payload: LoginPayload, db: Session = Depends(get_db)):
    """
    Compatibility endpoint: calls auth.login_for_access_token
    """
    return login_for_access_token(payload=payload, db=db)

# 2b) /api/auth/token -> same as above (some frontends use this path)
@app.post("/api/auth/token", tags=["compat"])
def token_compat_api(payload: LoginPayload, db: Session = Depends(get_db)):
    return login_for_access_token(payload=payload, db=db)

# 3) /profile -> calls auth.get_profile (depends on auth.get_current_active_user)
@app.get("/profile", tags=["compat"])
def profile_compat(current_user = Depends(get_current_active_user)):
    """
    Compatibility endpoint: calls auth.get_profile
    """
    return get_profile(current_user=current_user)

# 4) /verify-token -> calls auth.verify_token_endpoint
@app.get("/verify-token", tags=["compat"])
def verify_token_compat(current_user = Depends(get_current_active_user)):
    return verify_token_endpoint(current_user=current_user)

# 5) /api/auth/google-login -> calls auth.google_login
@app.post("/api/auth/google-login", tags=["compat"])
def google_login_compat(request: Request, db: Session = Depends(get_db)):
    """
    Compatibility endpoint: calls auth.google_login
    """
    # auth.google_login expects (request, db)
    return google_login(request=request, db=db)

# 6) Optional: map /auth/* still exists via auth_router, so both /auth/token and /token work.
# Add any additional legacy endpoints here as needed, following the same pattern.
