# DocTriage AI

> Real-time clinical document triage and red-flag alert system for emergency departments and hospital networks.

[![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript_5-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS_10-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python_3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma_ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![BullMQ](https://img.shields.io/badge/BullMQ-FF4500?style=for-the-badge&logo=redis&logoColor=white)](https://docs.bullmq.io/)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io/)
[![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white)](https://opencv.org/)

---

## Overview

In busy emergency departments, hundreds of patient documents arrive daily — lab results, scanned consults, radiology memos. Front-desk staff and intake nurses cannot always interpret critical lab panic ranges immediately, while emergency physicians cannot manually review every routine report without severe delays.

**DocTriage AI** automates this triage pipeline:
1. Intake staff uploads incoming documents (scanned PDF, image, DOCX, TXT).
2. The system OCRs and extracts clinical entities, normalizes lab values, and checks them against AHA/ACC panic thresholds.
3. If a life-threatening value is detected (e.g. Troponin > 0.04 ng/mL, Potassium > 6.0 mEq/L, or findings like Pneumothorax), it immediately fires a **STAT audio/visual siren** to attending doctors via WebSockets. Routine checkups are queued silently.

---

## System Architecture

```
                       [ Incoming Clinical Documents ]
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │    NestJS Web Gateway     │ :3000
                        │  - JWT + httpOnly Cookies │
                        │  - Rate Limiter Throttler│
                        │  - Multi-Tenant Isolation │
                        └─────────────┬─────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │     BullMQ Redis Queue    │
                        │  - 3x Exponential Retries │
                        │  - Dead-Letter Queue (DLQ)│
                        └─────────────┬─────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │    FastAPI AI Service     │ :8000
                        │  - Universal Ingestor     │
                        │  - Tesseract OCR Engine   │
                        │  - Strict Lab Extractor   │
                        │  - Negation Red-Flag NLP  │
                        └─────────────┬─────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │   Clinical Rule Engine    │
                        │  - Unit Normalizer        │
                        │  - AHA/ACC Panic Matrix   │
                        └─────────────┬─────────────┘
                                      │
                        ┌─────────────┴─────────────┐
                        ▼                           ▼
             ┌─────────────────────┐     ┌─────────────────────┐
             │ Neon PostgreSQL     │     │ Socket.io Server    │
             │ - Transactional Save│     │ - Hospital Rooms    │
             │ - Compound Indexes  │     │ - STAT Siren Event  │
             └─────────────────────┘     └──────────┬──────────┘
                                                    │
                                                    ▼
                                         ┌─────────────────────┐
                                         │ React Workstation   │ :5173
                                         │ - Live Triage Feed  │
                                         │ - Audio Siren Alert │
                                         └─────────────────────┘
```

---

## Core Capabilities

### 1. Fail-Closed Clinical Safety
* **Unreadable Scans**: If an image or PDF yields zero readable text, it fails closed (`status: FAILED`) and alerts staff for manual review. It never silently defaults to `ROUTINE`.
* **Disambiguated Lab Regex**: Bare abbreviations like `K`, `Na`, `Hb`, and `Cr` require explicit delimiters (`:`, `=`, `|`) or standard clinical concentration units. Non-lab prose like `"K 7 mm lesion"` or `"Hb 5 samples"` is strictly ignored, preventing false STAT alarms.

### 2. Multi-Tenant Hospital Isolation
* Hospitals are isolated using unique Join Codes (`FAC-XXXXXX`). Clinicians cannot view or query patient data from other facilities.
* WebSocket rooms are scoped strictly per hospital (`hospital_${id}`). If a document or socket handshake lacks a valid tenant ID, it fails closed.

### 3. Session & API Security
* **Zero LocalStorage Tokens**: Refresh tokens are stored strictly in `httpOnly, SameSite=Lax` cookies, preventing XSS token theft.
* **Timing-Attack Resistance**: Unregistered emails trigger a dummy bcrypt comparison (~50ms) to equalize response times and prevent account enumeration.
* **Rate Limiting**: Integrated `@nestjs/throttler` protects auth routes from brute-force attacks (10 req/min limit).

---

## Supported Lab Panic Thresholds

| Test | Unit | Normal Range | STAT Panic Trigger | Clinical Concern |
| :--- | :--- | :--- | :--- | :--- |
| **Troponin I / T** | ng/mL | < 0.04 | **> 0.04** | Myocardial Infarction / STEMI |
| **Potassium ($K^+$)** | mEq/L | 3.5 – 5.0 | **< 2.8 or > 6.0** | Cardiac Arrhythmia / Arrest |
| **Sodium ($Na^+$)** | mEq/L | 135 – 145 | **< 120 or > 160** | Severe Hyponatremia / Seizure |
| **Glucose** | mg/dL | 70 – 140 | **< 40 or > 450** | Severe Hypoglycemia / DKA |
| **Hemoglobin ($Hb$)** | g/dL | 12.0 – 17.5 | **< 7.0** | Critical Anemia / Hemorrhage |
| **Platelets** | $\times 10^3/\mu\text{L}$ | 150 – 450 | **< 20 or > 1000** | Spontaneous Bleeding / Thrombosis |
| **Lactate** | mmol/L | 0.5 – 2.0 | **> 4.0** | Sepsis / Severe Tissue Hypoxia |
| **INR** | ratio | 0.8 – 1.1 | **> 5.0** | Critical Bleeding Risk |

---

## Project Structure

```
doctraige-ai/
├── frontend/                   # React 18 + Vite workstation client
│   ├── src/
│   │   ├── components/         # Dashboard, AuthView, UploadModal, StatAlertBanner
│   │   ├── services/           # Axios client (withCredentials) & Socket.io client
│   │   └── types.ts            # Clinical TypeScript types
├── services/
│   ├── ai_service/             # FastAPI Python microservice
│   │   ├── nlp/                # Lab extraction & negation-aware red-flag regex
│   │   ├── ocr/                # Tesseract OCR & universal file ingestor
│   │   └── routes/             # POST /process-document endpoint
│   └── web-gateway/            # NestJS API gateway
│       ├── prisma/             # Schema, migrations & client
│       └── src/
│           ├── auth/           # JWT, httpOnly refresh cookies, login/signup
│           ├── intake/         # Multer uploads, BullMQ worker & DLQ processor
│           ├── rule-engine/    # AHA/ACC clinical evaluation matrix
│           └── triage-gateway/ # WebSocket server (scoped hospital rooms)
├── docker-compose.yml          # Container configuration
└── README.md
```

---

## Setup & Running Locally

### Prerequisites
* **Node.js**: v18+ and `npm`
* **Python**: 3.10+
* **Redis**: Running on `localhost:6379`
* **Tesseract OCR**: Installed on your system path
  * *Ubuntu/Debian*: `sudo apt-get install tesseract-ocr`
  * *macOS*: `brew install tesseract`
  * *Windows*: [UB-Mannheim Tesseract Installer](https://github.com/UB-Mannheim/tesseract/wiki)

---

### 1. Python AI Service

```bash
cd services/ai_service

# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies and start server
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
Runs at: `http://localhost:8000` (API docs at `/docs`).

---

### 2. NestJS Web Gateway

```bash
cd services/web-gateway

# Install dependencies
npm install

# Push schema to database
npx prisma db push

# Start development server
npm run start:dev
```
Runs at: `http://localhost:3000`.

---

### 3. React Frontend Workstation

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---
