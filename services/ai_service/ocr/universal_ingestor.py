import os
import io
import logging
from typing import Tuple, List

import pymupdf as fitz
from PIL import Image, ImageSequence
try:
    import docx
except Exception:
    docx = None
from striprtf.striprtf import rtf_to_text

logger = logging.getLogger(__name__)

# A page is considered to have "sufficient" native text above this length.
# Pages with text above this threshold skip Tesseract OCR to save CPU time.
NATIVE_TEXT_MIN_CHARS = 20

SUPPORTED_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp"}


def ingest_document(file_path: str) -> Tuple[str, List[Image.Image]]:
    """
    Universally ingests any document file (.pdf, .jpg, .png, .tiff, .docx, .txt, .rtf)
    and returns:
      - native_text: all text that was already digitally extractable (no OCR involved)
      - images: a list of PIL Images that need OCR.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Document file not found at path: {file_path}")

    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        return _ingest_pdf(file_path)
    elif ext in SUPPORTED_IMAGE_EXTS:
        return _ingest_image(file_path)
    elif ext == ".docx":
        return _ingest_docx(file_path), []
    elif ext == ".txt":
        return _ingest_txt(file_path), []
    elif ext == ".rtf":
        return _ingest_rtf(file_path), []
    else:
        raise ValueError(f"Unsupported document file extension: {ext}")


def _ingest_image(file_path: str) -> Tuple[str, List[Image.Image]]:
    """
    Ingests standalone image file. Supports multi-page TIFF/TIF files by iterating all frames.
    """
    images: List[Image.Image] = []
    try:
        with Image.open(file_path) as img:
            for frame in ImageSequence.Iterator(img):
                images.append(frame.convert("RGB"))
    except Exception as e:
        logger.warning(f"PIL ImageSequence failed on {file_path}: {e}. Falling back to single image load.")
        with Image.open(file_path) as img:
            images.append(img.convert("RGB"))

    return "", images


def _ingest_pdf(file_path: str) -> Tuple[str, List[Image.Image]]:
    doc = fitz.open(file_path)
    native_text_parts: List[str] = []
    pages_to_ocr: List[Image.Image] = []

    for page_idx, page in enumerate(doc):
        text = page.get_text().strip()

        if len(text) >= NATIVE_TEXT_MIN_CHARS:
            native_text_parts.append(text)
        else:
            pix = page.get_pixmap(dpi=300)
            img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
            pages_to_ocr.append(img)

    return "\n\n".join(native_text_parts), pages_to_ocr


def _ingest_docx(file_path: str) -> str:
    """
    Extracts text from paragraphs and tables in DOCX files.
    Clinical reports frequently format lab values inside tables.
    """
    if docx is None:
        raise RuntimeError("python-docx is not installed. Please install it to parse DOCX files.")
    doc = docx.Document(file_path)
    lines: List[str] = []

    for para in doc.paragraphs:
        text = para.text.strip()
        if text:
            lines.append(text)

    for table in doc.tables:
        for row in table.rows:
            row_cells = [cell.text.strip() for cell in row.cells]
            # Deduplicate consecutive identical cells caused by merged table cells
            deduped_cells = []
            for cell_val in row_cells:
                if not deduped_cells or cell_val != deduped_cells[-1]:
                    deduped_cells.append(cell_val)
            row_text = "\t".join(filter(None, deduped_cells))
            if row_text:
                lines.append(row_text)

    return "\n".join(lines)


def _ingest_txt(file_path: str) -> str:
    """
    Safely reads text files supporting UTF-8, UTF-16 (PowerShell default),
    and legacy hospital encodings without corrupting text with null bytes.
    """
    with open(file_path, "rb") as f:
        raw_bytes = f.read()

    if not raw_bytes:
        return ""

    # Check for Byte Order Marks (BOM)
    if raw_bytes.startswith(b"\xff\xfe") or raw_bytes.startswith(b"\xfe\xff"):
        try:
            return raw_bytes.decode("utf-16").strip()
        except Exception:
            pass

    if raw_bytes.startswith(b"\xef\xbb\xbf"):
        try:
            return raw_bytes.decode("utf-8-sig").strip()
        except Exception:
            pass

    # Try encodings in order
    for enc in ["utf-8", "utf-16", "utf-16-le", "utf-16-be", "cp1252", "latin-1"]:
        try:
            decoded = raw_bytes.decode(enc)
            # If decoded contains null bytes, it was decoded with wrong single-byte encoding
            if "\x00" in decoded and enc in ["latin-1", "cp1252"]:
                continue
            return decoded.strip()
        except (UnicodeDecodeError, LookupError):
            continue

    return raw_bytes.decode("latin-1", errors="replace").strip()


def _ingest_rtf(file_path: str) -> str:
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        return rtf_to_text(f.read())
