# firebase_admin_init.py
import os
import json
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth

# Load environment variables from .env
load_dotenv()

def init_firebase_admin():
    """Initialize Firebase Admin SDK using FIREBASE_SERVICE_ACCOUNT from environment."""
    # Prevent re-initializing Firebase app if already loaded
    if firebase_admin._apps:
        return

    # Read the service account JSON string from environment
    svc_json = os.getenv("FIREBASE_SERVICE_ACCOUNT")
    if not svc_json:
        raise RuntimeError("No Firebase credentials found in FIREBASE_SERVICE_ACCOUNT environment variable.")

    try:
        # Parse JSON string to dictionary
        service_account_info = json.loads(svc_json)

        # Fix escaped newlines in private_key (common when stored in .env)
        if "private_key" in service_account_info:
            service_account_info["private_key"] = service_account_info["private_key"].replace("\\n", "\n")

        # Initialize Firebase Admin SDK
        cred = credentials.Certificate(service_account_info)
        firebase_admin.initialize_app(cred)
        print("✅ Firebase Admin initialized successfully")

    except json.JSONDecodeError as e:
        raise RuntimeError(f"Invalid FIREBASE_SERVICE_ACCOUNT JSON: {e}")
    except Exception as e:
        raise RuntimeError(f"Failed to initialize Firebase Admin: {e}")
