import os 
from config import settings
import logging
from fastapi import APIRouter, HTTPException, status
from schemas.data_schema import (
    ProcessDocumentRequest,
    ProcessDocumentResponse,
    RedFlagItemSchema,
    PatientInfoSchema,
    LabItemSchema,
)
from ocr.universal_ingestor import ingest_document
from ocr.ocr_engine import extract_text_from_images
from nlp.lab_extractor import extract_patient_info, extract_lab_values
from nlp.nlp_engine import nlp_engine

logger = logging.getLogger("DocumentRoutes")

router = APIRouter(
    prefix="/process-document",
    tags=["/Document Processing"]
)

@router.post("", response_model=ProcessDocumentResponse)
def process_document(request: ProcessDocumentRequest):
    """
    Main AI Processing Pipeline Endpoint with Path Traversal Security Validation.
    Fails closed if OCR fails or document contains 0 extractable text.
    """
    logger.info(f"Received AI processing request for Document ID: {request.document_id}")
    file_path = request.file_path

    # -------------------------------------------------------------------------
    # STEP 1: SECURITY PATH TRAVERSAL VALIDATION
    # -------------------------------------------------------------------------
    abs_file_path = os.path.abspath(file_path)

    # Check 1: File must exist on disk
    if not os.path.exists(abs_file_path):
        logger.error(f"File not found at path: {abs_file_path}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document file not found at path: {file_path}",
        )

    # Check 2: Path Traversal Check (Must be inside allowed uploads directories)
    valid_dirs = [os.path.abspath(settings.SHARED_UPLOADS_DIR)]
    if hasattr(settings, "ROOT_UPLOADS_DIR") and os.path.exists(settings.ROOT_UPLOADS_DIR):
        valid_dirs.append(os.path.abspath(settings.ROOT_UPLOADS_DIR))

    is_within_uploads = False
    for allowed_dir in valid_dirs:
        try:
            if os.path.commonpath([allowed_dir, abs_file_path]) == allowed_dir:
                is_within_uploads = True
                break
        except ValueError:
            continue

    if not is_within_uploads:
        logger.error(f"Security Violation: File path traversal attempt: {file_path}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Security Violation: File path must be within shared uploads directory.",
        )

    try:
        # 1. Universal Document Ingestion & Page Rendering
        native_text, page_images = ingest_document(abs_file_path)
        logger.info(f"Ingestion complete. Native text chars: {len(native_text)}, Page images: {len(page_images)}")

        # 2. OCR Text Extraction (if page images exist)
        ocr_text = ""
        if page_images:
            ocr_text = extract_text_from_images(page_images)

        # -------------------------------------------------------------------------
        # FAIL-CLOSED SAFETY CHECK:
        # If the document had pages requiring OCR, but yielded 0 text and native text is also empty,
        # fail-closed! Do NOT return false success or routine.
        # -------------------------------------------------------------------------
        if page_images and not ocr_text.strip() and not native_text.strip():
            logger.error(f"Fail-closed: Document {request.document_id} required OCR on {len(page_images)} page(s) but yielded no extractable text.")
            return ProcessDocumentResponse(
                document_id=request.document_id,
                status="FAILED",
                error_message="OCR failure: Scanned document contains unreadable images or OCR engine failed. Manual clinical review required.",
                patient_info=PatientInfoSchema(),
                extracted_labs=[],
                red_flag_phrases=[],
                raw_text="",
            )

        # Combine Native & OCR Text Streams
        full_raw_text = (native_text + "\n\n" + ocr_text).strip()

        if not full_raw_text:
            logger.error(f"Fail-closed: Document {request.document_id} contains 0 extractable text across all streams.")
            return ProcessDocumentResponse(
                document_id=request.document_id,
                status="FAILED",
                error_message="Extraction failure: No readable text found in document. Manual clinical triage required.",
                patient_info=PatientInfoSchema(),
                extracted_labs=[],
                red_flag_phrases=[],
                raw_text="",
            )

        # 3. Extract Demographics & Lab Values (lab_extractor.py)
        raw_patient = extract_patient_info(full_raw_text)
        patient_info = PatientInfoSchema(
            name=raw_patient.get("name"),
            mrn=raw_patient.get("mrn"),
            dob=raw_patient.get("dob"),
        )

        raw_labs = extract_lab_values(full_raw_text)
        extracted_labs = [
            LabItemSchema(
                test=lab["test"],
                value=float(lab["value"]),
                unit=lab.get("unit", ""),
            )
            for lab in raw_labs
        ]

        # 4. Red-Flag NLP Engine (nlp_engine.py)
        flagged_objs = nlp_engine.scan_for_red_flags(full_raw_text)
        red_flag_phrases = [flag["phrase"] for flag in flagged_objs]
        red_flags_list = [
            RedFlagItemSchema(
                phrase=flag["phrase"],
                category=flag["category"],
                confidence=float(flag.get("confidence", 0.85 if flag.get("status") == "uncertain" else 1.0)),
                status=flag.get("status", "present"),
            )
            for flag in flagged_objs
        ]

        logger.info(
            f"Processing Complete for Doc ID: {request.document_id}! "
            f"Labs: {len(extracted_labs)}, Flags: {len(red_flags_list)}",
        )

        return ProcessDocumentResponse(
            document_id=request.document_id,
            status="SUCCESS",
            patient_info=patient_info,
            extracted_labs=extracted_labs,
            red_flag_phrases=red_flag_phrases,
            red_flags=red_flags_list,
            raw_text=full_raw_text,
        )

    except Exception as e:
        logger.error(f"Error processing document {request.document_id}: {str(e)}", exc_info=True)
        return ProcessDocumentResponse(
            document_id=request.document_id,
            status="FAILED",
            error_message=str(e),
            patient_info=PatientInfoSchema(),
            extracted_labs=[],
            red_flag_phrases=[],
            raw_text="",
        )
