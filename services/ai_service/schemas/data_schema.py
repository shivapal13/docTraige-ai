# services/ai-engine/app/schemas.py
from pydantic import BaseModel, Field
from typing import List, Optional


class ProcessDocumentRequest(BaseModel):
    document_id: str = Field(..., description="Unique UUID of the document in NestJS")
    file_path: str = Field(..., description="Path to the uploaded file in shared_uploads/")


class PatientInfoSchema(BaseModel):
    name: Optional[str] = Field(None, description="Extracted patient full name")
    mrn: Optional[str] = Field(None, description="Medical Record Number")
    dob: Optional[str] = Field(None, description="Date of Birth (YYYY-MM-DD or MM/DD/YYYY)")


class LabItemSchema(BaseModel):
    test: str = Field(..., description="Name of lab test (e.g. Glucose, INR, Potassium)")
    value: float = Field(..., description="Numeric value extracted")
    unit: Optional[str] = Field("", description="Unit of measurement (e.g. mg/dL, mEq/L)")


class RedFlagItemSchema(BaseModel):
    phrase: str = Field(..., description="The clinical sentence flagged")
    category: str = Field(..., description="Emergency Category (e.g. Pneumothorax, Acute Infarct)")
    confidence: float = Field(0.95, description="Confidence score")
    status: Optional[str] = Field("present", description="Status of finding: present or uncertain")

class ProcessDocumentResponse(BaseModel):
    document_id: str
    status: str = Field("SUCCESS", description="Processing status: SUCCESS or FAILED")
    error_message: Optional[str] = None
    patient_info: PatientInfoSchema
    extracted_labs: List[LabItemSchema] = []
    red_flag_phrases: List[str] = []
    red_flags: List[RedFlagItemSchema] = []
    raw_text: str = Field("", description="Full raw text")