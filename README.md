# DocTriage AI 🩺
### Autonomous Clinical Decision Support & Real-Time STAT Red-Flag Interceptor

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![NestJS](https://img.shields.io/badge/NestJS-10.0+-E0234E.svg?logo=nestjs&logoColor=white)](https://nestjs.com)
[![React](https://img.shields.io/badge/React-18.0+-61DAFB.svg?logo=react&logoColor=black)](https://reactjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon%20DB-336791.svg?logo=postgresql&logoColor=white)](https://neon.tech)
[![Redis](https://img.shields.io/badge/Redis-BullMQ-DC382D.svg?logo=redis&logoColor=white)](https://redis.io)

DocTriage AI is a high-throughput, clinical-grade triage system that ingests multi-format medical reports (PDFs, scans, DOCX, TIFF, text), extracts vital demographics and lab values, scans for life-threatening clinical red flags, and instantly alerts attending physicians to critical panic-range cases via real-time WebSocket sirens.

---

## 🏥 The Clinical Problem

In modern emergency departments and hospital intake wards:
* **Overwhelming Volume**: Thousands of lab reports and clinical consult notes arrive daily.
* **Staff Knowledge Gap**: Triage desk staff and junior intake coordinators often lack the medical training to interpret complex laboratory panic values (e.g., distinguishing hs-cTnT cardiac markers from routine chemistry).
* **Doctor Alert Fatigue**: Emergency physicians do not have the time to manually read through thousands of routine check-up files to locate the 2 or 3 critical emergencies.

**DocTriage AI** solves this bottleneck by acting as an autonomous digital interceptor — processing documents in sub-second latency, sorting routine checkups into the background, and immediately triggering audiovisual sirens for critical STAT emergencies.

---

## ⚡ Key Features

* **Multi-Format Universal Ingestion**: Ingests native & scanned PDFs, multi-page TIFF, PNG/JPEG, Word (`.docx`), and RTF reports.
* **Fail-Closed Clinical Safety**: Corrupted images or failed OCR attempts fail-closed (`FAILED`) rather than returning a false-negative `ROUTINE` classification, guaranteeing physician oversight.
* **Disambiguated Lab Extraction**: Disambiguates single/two-letter abbreviations (`K`, `Na`, `Hb`, `Cr`) to eliminate false-positive panic alarms from prose phrases (e.g., *“K 7 mm lesion”* or *“Hb 5 samples”*).
* **AHA / ACC Rule Engine**: Evaluates labs against standardized medical panic thresholds (Troponin, Potassium, Sodium, Lactate, Hemoglobin, INR, Platelets).
* **Deterministic Red-Flag NLP**: Negation-aware scanner (*NegEx-style*) detecting critical findings like *Pneumothorax, Intracranial Hemorrhage, Pulmonary Embolism, Aortic Dissection, and STEMI*.
* **Cryptographic Multi-Tenancy**: Facilities are isolated by unique cryptographic Join Codes (`FAC-XXXXXX`). Zero cross-tenant data leakage.
* **Dual-Token Session Security**: Multi-device independent refresh tokens stored in `httpOnly` secure cookies, protected by constant-time bcrypt verification and API rate-limiting (`@nestjs/throttler`).
* **Resilient Distributed Queue**: BullMQ Redis queue with exponential retries and Dead-Letter Queue (DLQ) automated incident escalation.

---

## 🏗️ Architecture

```
                 [ Hospital Intake / Junior Staff ]
                                  │ (Uploads PDF, Scans, DOCX)
                                  ▼
                    ┌──────────────────────────┐
                    │   NestJS Web Gateway     │ :3000
                    │  - Multi-Tenant Auth     │
                    │  - Rate Limiting / CORS  │
                    │  - Fail-Closed Tenancy   │
                    └─────────────┬────────────┘
                                  │ (Enqueues Job)
                                  ▼
                    ┌──────────────────────────┐
                    │   BullMQ Redis Queue     │
                    │  - Retries with backoff  │
                    │  - DLQ Incident Monitor  │
                    └─────────────┬────────────┘
                                  │ (Dispatches File)
                                  ▼
                    ┌──────────────────────────┐
                    │   FastAPI AI Service     │ :8000
                    │  - Universal Ingestion   │
                    │  - Tesseract OCR Engine  │
                    │  - Strict Lab Extractor  │
                    │  - Negation Red-Flag NLP │
                    └─────────────┬────────────┘
                                  │ (Returns Clinical JSON)
                                  ▼
                    ┌──────────────────────────┐
                    │   Clinical Rule Engine   │
                    │  - Panic Value Matrix    │
                    │  - Unit Normalizer       │
                    └─────────────┬────────────┘
                                  │ (Atomic DB Save)
                                  ▼
       ┌──────────────────────────┴──────────────────────────┐
       ▼                                                     ▼
┌──────────────┐                                   ┌──────────────────┐
│  PostgreSQL  │                                   │ Socket.io Server │
│  (Neon DB)   │                                   │ (Hospital Rooms) │
└──────────────┘                                   └─────────┬────────┘
                                                             │ (STAT Siren)
                                                             ▼
                                                ┌──────────────────────────┐
                                                │ React Clinical Dashboard │ :5173
                                                │ - Live Workstation       │
                                                │ - STAT Emergency Banner  │
                                                │ - Audio Siren System     │
                                                └──────────────────────────┘
```

---

## 🛠️ Tech Stack

* **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Vite
* **Gateway**: NestJS, Prisma ORM, BullMQ, Socket.io, `@nestjs/throttler`, `cookie-parser`
* **AI Microservice**: Python 3.10+, FastAPI, PyMuPDF, pytesseract, python-docx, OpenCV, NumPy
* **Databases & Cache**: PostgreSQL (Neon Serverless), Redis (BullMQ queue)

---

## 🚀 Getting Started

### Prerequisites
* Node.js v18+ & npm
* Python 3.10+
* Redis server running locally (or via Docker)
* Tesseract OCR installed on the system path

### 1. AI Microservice Setup
```bash
cd services/ai_service
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. Web Gateway Setup
```bash
cd services/web-gateway
npm install
npx prisma generate
npm run start:dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Open **`http://localhost:5173`** in your browser to access the Clinical Workstation.

---

## 🔒 Security & Safety Controls

* **Zero LocalStorage Token Storage**: Refresh tokens are stored strictly in `httpOnly, Secure, SameSite=Lax` cookies.
* **Brute-Force Protection**: Authentication endpoints throttled to 10 requests per minute.
* **Path Traversal Protection**: AI service validates file boundaries against authorized uploads directories.
* **Constant-Time Login**: Timing attack equalization protects against email enumeration.

---

## 📄 License
This project is licensed under the MIT License.
