from fastapi import FastAPI
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from routes.process_document import router as process_document

app=FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(process_document,prefix="/api/v1")


@app.get("/health",tags=['Health'])
def healthCheck():
    return {
        "status":"active",
        "service":"AI engine Of DoctriageAI is Running",
        "Timestamp":datetime.now().isoformat()
    }