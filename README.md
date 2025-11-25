# 📊 InsightLogs — AI-Powered Log Analysis Platform

![License](https://img.shields.io/badge/license-MIT-green.svg)
![React](https://img.shields.io/badge/React-Vite-informational.svg)
![Python](https://img.shields.io/badge/Python-FastAPI-orange.svg)
![LLM](https://img.shields.io/badge/LLM-Powered-blue)

![DB](https://img.shields.io/badge/Database-Postgres%2FSQLite-brightgreen.svg)

---

## 🎥 Demo Video

<p align="center">
  <a href="https://drive.google.com/file/d/1vVcQ6OZMY48QUBMMy5UmJU62w1KlgJxN/view?usp=sharing">
    <img src="./frontend/public/landingpage.png" alt="InsightLogs Demo" >
  </a>
</p>

> Click the thumbnail above to watch the demo video of **InsightLogs**.



## Some App Visuals

<p align="center">
  
  <img src="./frontend/public/dashboard.png" alt="dashboard" width="45%" />
  <img src="./frontend/public/logsexplorer.png" alt="logsexplorer" width="45%" />
  <img src="./frontend/public/analysis.png" alt="analysis" width="45%" />
  <img src="./frontend/public/profile.png" alt="profile" width="45%" />
</p>


---

## 🏠 Live Link

🔗 [InsightLogs](https://InsightLogs.onrender.com)

---

## 🚀 Overview

InsightLogs lets you upload application logs, explore & filter them, and run LLM-powered AI analysis (summaries, root-cause, recommended fixes) — with both Email+JWT auth and Firebase one-click sign-in. Personalized dashboards, per-user uploads, and downloadable analysis artifacts.

---

## ✨ Key features (user-facing)

- **Email + password** authentication with JWT sessions (server-issued token).  
- **Firebase sign-in** (continue with your email / Google) — frontend exchanges Firebase ID token for server JWT.  
- **Personalized dashboards**: metrics, logs-over-time chart, errors, active uploads, recent reports, and last-upload quick actions.  
- **Uploads**: upload `.txt`, `.log`, `.json`, `.zip`; preview parsed lines and metadata before analysis.  
- **Logs Explorer**: search, filter by level (ERROR/WARN/INFO/DEBUG), filter by upload, limit and inspect rows. Delete uploads.  
- **Profile**: view & update permitted fields (name, role, org, tech stack, phone). Email is read-only.  
- **AI Analysis**: run Gemini / other LLM on recent upload — get summary, detected issues, severity, occurrences and recommended fixes; copy steps or download JSON.  
- **Per-file operations**: re-run analysis, download analysis JSON, delete upload.

---

## 🧭 UX flow

1. Sign in (Email + Password) or continue with Firebase.  
2. Land on your Dashboard — see totals, errors, active uploads, and last upload.  
3. Go to **Uploads** → upload file → preview parse.  
4. Use **Logs Explorer** to search/filter log lines. Delete uploads you don’t need.  
5. Open **AI Analysis** → click **Start analysis** to queue/run LLM analysis → view/download results.  
6. Update profile in **Profile** (email is read-only).

---

## 🧱 Architecture Overview

InsightLogs follows a **modular client–server architecture** designed for fast performance, secure data handling, and powerful AI-driven insights.  
The system combines robust authentication, real-time dashboards, and automated log intelligence using **Google Gemini LLM**.

---

### 🖥️ Frontend (React + Vite)

- Built with **React.js** + **Vite** for a fast and modern UI  
- Styled using **Tailwind CSS**  
- Protected routes using custom **Auth Guards (ProtectedRoute)**  
- Authentication options:
  - **Email + Password (JWT-based login)**
  - **Firebase Google Login**
- Interactive dashboards and charts using **Recharts**
- Organized modular structure with pages, components, layouts & shared UI

---

### ⚙️ Backend (FastAPI + Python)

- **FastAPI** backend with clean route modularization  
- **JWT authentication** for secure sessions  
- **Firebase Admin SDK** for secure Google Sign-In token validation  
- Complete **Log Processing Pipeline**:
  - Uploading log files  
  - Parsing, indexing, and storing logs  
  - Exposing logs via structured API with filters  
- **AI-powered Log Analysis** using **Google Gemini**:
  - Async job queue for analysis tasks  
  - Poll-based job status tracking  
  - Summaries, detected issues, error severity & recommended fixes  
- SQLite-based lightweight datastore  

---

### 🗄️ Database (SQLite + SQLAlchemy)

- Stores:
  - Users  
  - Upload metadata  
  - Parsed log rows  
  - AI analysis jobs  
- Lightweight, fast, easy to deploy anywhere  
- Clean schema for portability  

---

### ☁️ Deployment

- Frontend + backend deployable separately  
- `.env` files support secure configuration of:
  - Firebase keys  
  - Gemini API key  
  - API base URLs  
- Compatible with:
  - **Render**
  - **Vercel**
  - **Netlify**
  - **Railway**
  - Docker-based deployments  

---

## 🛠️ Tech Stack

| Layer            | Technologies                                                 |
| ---------------- | ------------------------------------------------------------ |
| **Frontend**     | React.js, Vite, Tailwind CSS, Recharts                       |
| **Backend**      | FastAPI (Python), Firebase Admin SDK                         |
| **Database**     | SQLite + SQLAlchemy                                          |
| **Authentication** | JWT (Email/Password), Firebase Google Login                |
| **AI Engine**    | Google Gemini LLM for log intelligence                       |
| **File System**  | Log Uploading, Parsing, Processing                           |
| **Deployment**   | Render / Vercel / Railway / Netlify compatible               |


---

## 📁 Folder structure 

```
InsightLogs/
├── backend/
│   ├── ai_integration.py
│   ├── app_resources.py
│   ├── auth.py
│   ├── db.py
│   ├── firebase_admin_init.py
│   ├── main.py
│   ├── models.py
│   ├── auth_users.db
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── authenticationpages/   # login, signup, google auth
│   │   ├── pages/                 # dashboard, logs, uploads, AI analysis, profile
│   │   ├── components/            # layout + landing components
│   │   ├── firebasework/          # firebase auth + config
│   │   ├── layouts/               # admin layout
│   │   ├── shared/                # reusable UI elements (card, etc.)
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── .env.local
│
└── README.md
```
----

## ⚡ Setup Instructions

Follow the steps below to run **InsightLogs** on your local machine.

---

# 🛠 Backend Setup (FastAPI + Python)

### 1️⃣ Navigate to the Backend Folder
```bash
cd backend
```
### 2️⃣ Create & Activate Virtual Environment

**Windows**
```bash
python -m venv venv
venv\Scripts\activate
```
**macOS / Linux**
```bash
python3 -m venv venv
source venv/bin/activate
```
---

### 3️⃣ Install Dependencies

```bash
pip install -r requirements.txt
```
---

### 4️⃣ Create `.env` File for both backend and frontend 
Backend .env example:
```
# === FastAPI Application Settings ===
APP_NAME=InsightLogs
APP_ENV=development

# === JWT Auth ===
JWT_SECRET_KEY=your_jwt_secret_key_here
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=43200   # 30 days

# === CORS Settings ===
CORS_ORIGINS=http://localhost:5173

# === Firebase Admin (Service Account Credentials) ===
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOURKEY\n-----END PRIVATE KEY-----\n"

# === Database ===
DATABASE_URL=sqlite:///./auth_users.db

# === AI / Gemini API Keys ===
GOOGLE_API_KEY=your_gemini_api_key_here


```
Frontend .env example:
```
# === Backend Base URL ===
VITE_API_BASE=http://localhost:8000

# === Firebase Web Config ===
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id

# === Optional: Firebase Measurement ID ===
VITE_FIREBASE_MEASUREMENT_ID=optional

# === Optional Upload Preview Settings ===
VITE_MAX_LOG_SIZE_MB=10

```

---
## 🔐 Optional: OTP & Email Verification

InsightLogs can be extended with **Forget Password OTP verification** or **Email Verification** using external providers.

Most **free services require a personal domain** for sending real emails, and SMS OTP usually needs a **paid service**.

### Supported Options
- **Twilio (SMS OTP)** – reliable, but paid beyond trial.
- **SendGrid / Mailgun / Postmark (Email Verification)** – require domain verification.
- **Mailtrap** – free but only for testing (no real user delivery).

### How It Would Work
- For **Email Verification**: send a verification link or code after signup.
- For **Forget Password**: send OTP via SMS or email, then allow password reset.
- Requires adding small API routes + provider SDK keys.

---
## 🧑‍💻 Contributing

Contributions are welcome!
If you’d like to improve the project:
Feel free to Contact

---

## 📜 License

This project is licensed under the **MIT License** 

---

## 🤝 Connect

Created with ❤️ by Irika
---
📧 Email: [ishaniirika5@gmail.com](mailto:ishaniirika5@gmail.com)
🌍 GitHub: [irikaishani]](https://github.com/irikaishani)








