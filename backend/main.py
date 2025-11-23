# backend/main.py
import os
import logging
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

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

# CORS
FRONTEND_ORIGIN_ENV = os.environ.get("FRONTEND_ORIGIN", "")
origins = [o.strip() for o in FRONTEND_ORIGIN_ENV.split(",") if o.strip()]
if not origins:
    origins = ["http://localhost:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
# - auth_router mounted at /auth (new refactored paths)
app.include_router(auth_router, prefix="/auth")
# - resources router mounted at root (keeps existing resource paths unchanged)
app.include_router(resources_router, prefix="")

# Create tables at startup (dev convenience)
Base.metadata.create_all(bind=engine)

@app.get("/")
def root():
    return {"ok": True, "message": "InsightLogs backend running"}

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
