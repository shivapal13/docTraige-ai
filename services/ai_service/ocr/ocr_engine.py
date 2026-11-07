try:
    import pytesseract
except Exception:
    pytesseract = None

from PIL import Image
import numpy as np
import logging

logger = logging.getLogger("OcrEngine")

def preprocess_image_for_ocr(pil_img: Image.Image) -> Image.Image:
    """
    Applies image preprocessing (Grayscale + Contrast Enhancement) 
    to improve Tesseract OCR accuracy on noisy faxes.
    """
    try:
        import cv2

        # Convert PIL Image to OpenCV BGR numpy array
        open_cv_image = np.array(pil_img)
        gray = cv2.cvtColor(open_cv_image, cv2.COLOR_RGB2GRAY)

        # Apply Otsu Thresholding for crisp black text on white background
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Convert back to PIL Image
        return Image.fromarray(thresh)
    except Exception as e:
        logger.warning(f"OpenCV image preprocessing skipped: {e}")
        return pil_img

def extract_text_from_images(images: list[Image.Image]) -> str:
    """
    Runs Tesseract OCR across a list of page images and returns combined text.
    Fails closed if OCR engine is missing.
    """
    if not images:
        return ""

    if pytesseract is None:
        raise RuntimeError("pytesseract package is not installed or failed to import. OCR cannot proceed.")

    ocr_text_results = []
    ocr_errors = []

    for idx, item in enumerate(images):
        try:
            # Unpack item if passed as tuple
            pil_image = item[0] if isinstance(item, tuple) else item

            if not isinstance(pil_image, Image.Image):
                continue

            # Preprocess page image
            cleaned_img = preprocess_image_for_ocr(pil_image)

            # Run Tesseract OCR (PSM 6 = Assume a single uniform block of text)
            text = pytesseract.image_to_string(cleaned_img, config="--psm 6")
            if text.strip():
                ocr_text_results.append(f"--- OCR Page {idx + 1} ---\n{text.strip()}")
        except Exception as e:
            logger.error(f"Tesseract OCR failed on page {idx + 1}: {e}")
            ocr_errors.append(str(e))

    # If all page OCR attempts threw errors and 0 text was extracted, fail closed
    if ocr_errors and not ocr_text_results:
        raise RuntimeError(f"OCR execution failed: {'; '.join(ocr_errors[:2])}")

    return "\n\n".join(ocr_text_results)
