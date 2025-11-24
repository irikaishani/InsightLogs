# backend/auth.py
import os
import logging
import secrets
from datetime import datetime, timedelta
from typing import Optional, List

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from passlib.context import CryptContext
from jose import jwt

# firebase init helper (replace with your real init)
from firebase_admin_init import init_firebase_admin
from firebase_admin import auth as firebase_auth

from db import get_db
from models import User

load_dotenv()
init_firebase_admin()

logger = logging.getLogger("auth")
logger.setLevel(logging.INFO)
logger.info("Auth router loaded")

SECRET_KEY = os.environ.get("SECRET_KEY")
ALGORITHM = os.environ.get("ALGORITHM") or os.environ.get("SECRET_ALGO")
if not SECRET_KEY or not ALGORITHM:
    raise RuntimeError("Missing required environment vars: SECRET_KEY and ALGORITHM must be set")

try:
    TOKEN_EXPIRES = int(os.environ.get("TOKEN_EXPIRES_MINUTES", "60"))
except ValueError:
    TOKEN_EXPIRES = 60

FRONTEND_ORIGIN_ENV = os.environ.get("FRONTEND_ORIGIN", "")

pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")  # note path

# -------------------------
# Pydantic models
# -------------------------
class UserCreate(BaseModel):
    name: Optional[str] = ""
    email: EmailStr
    password: str
    role: str
    organization: Optional[str] = None
    tech_stack: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    organization: Optional[str]
    tech_stack: Optional[str]
    is_active: bool
    class Config:
        orm_mode = True

class LoginPayload(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

# -------------------------
# helpers
# -------------------------
def get_pwd_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_pwd(plain_pwd: str, hashed_pwd: str) -> bool:
    return pwd_context.verify(plain_pwd, hashed_pwd)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta if expires_delta else timedelta(minutes=30))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: Optional[str] = payload.get("sub")
        if not email:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="could not verify credentials", headers={"WWW-Authenticate": "Bearer"})
        return email
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="could not verify credentials", headers={"WWW-Authenticate": "Bearer"})

# -------------------------
# Router
# -------------------------
router = APIRouter(prefix="/auth", tags=["auth"])

# Dependencies (use get_db from db.py)
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    email = verify_token(token)
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User does not exist", headers={"WWW-Authenticate": "Bearer"})
    return user

def get_current_active_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(status_code=404, detail="inactive user")
    return current_user

# Health (keep under auth for convenience)
@router.get("/health")
def health():
    frontend_origins: List[str] = [o.strip() for o in FRONTEND_ORIGIN_ENV.split(",") if o.strip()]
    return {"ok": True, "allowed_origins": frontend_origins}

# Signup
@router.post("/signup", response_model=UserResponse, status_code=201)
def signup_user(user: UserCreate, db: Session = Depends(get_db)):
    email = user.email.lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="user already exists, please login")

    hashed_password = get_pwd_hash(user.password)
    db_user = User(
        name=user.name or "",
        email=email,
        hashed_password=hashed_password,
        role=user.role,
        organization=user.organization or "",
        tech_stack=user.tech_stack or "",
        is_verified=True,
        firebase_uid=None,
        verified_at=datetime.utcnow(),
    )
    db.add(db_user)
    try:
        db.commit()
        db.refresh(db_user)
    except IntegrityError:
        db.rollback()
        logger.exception("DB integrity error creating user")
        raise HTTPException(status_code=500, detail="Failed to create user (integrity error)")
    return db_user

@router.post("/token", response_model=Token)
def login_for_access_token(payload: LoginPayload, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_pwd(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    access_token_expires = timedelta(minutes=TOKEN_EXPIRES)
    access_token = create_access_token(data={"sub": user.email}, expires_delta=access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/profile", response_model=UserResponse)
def get_profile(current_user: User = Depends(get_current_active_user)):
    return current_user

@router.get("/verify-token")
def verify_token_endpoint(current_user: User = Depends(get_current_active_user)):
    return {"valid": True, "user": {"id": current_user.id, "name": current_user.name, "email": current_user.email, "role": current_user.role}}

@router.post("/google-login")
def google_login(request: Request, db: Session = Depends(get_db)):
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing ID token")

    id_token = auth_header.split(" ", 1)[1].strip()
    try:
        decoded = firebase_auth.verify_id_token(id_token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid ID token: {e}")

    email = (decoded.get("email") or "").lower()
    uid = decoded.get("uid")
    name = decoded.get("name") or decoded.get("displayName") or ""

    if not email:
        raise HTTPException(status_code=400, detail="Email missing from provider token")

    user = None
    if uid:
        user = db.query(User).filter(User.firebase_uid == uid).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()

    if not user:
        random_pw = secrets.token_urlsafe(24)
        hashed_pw = get_pwd_hash(random_pw)
        user = User(
            name=name or "",
            email=email,
            hashed_password=hashed_pw,
            role="user",
            organization="",
            tech_stack="",
            is_verified=True,
            firebase_uid=uid,
            verified_at=datetime.utcnow(),
        )
        db.add(user)
        try:
            db.commit()
            db.refresh(user)
        except IntegrityError:
            db.rollback()
            user = db.query(User).filter(User.email == email).first()
            if not user:
                raise HTTPException(status_code=500, detail="Failed to create user")
    else:
        if not user.firebase_uid and uid:
            user.firebase_uid = uid
            user.is_verified = True
            user.verified_at = datetime.utcnow()
            db.commit()
            db.refresh(user)

    access_token_expires = timedelta(minutes=TOKEN_EXPIRES)
    access_token = create_access_token(data={"sub": user.email}, expires_delta=access_token_expires)
    return {"access_token": access_token, "token_type": "bearer", "user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role}}
