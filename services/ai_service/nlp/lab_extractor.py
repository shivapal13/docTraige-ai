import re
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger("LabExtractor")

# Whitelist of valid clinical units (prevents word bleed like "Impression")
VALID_UNITS_REGEX = r'(?:[\|\-\t\s]*\b(mg/dL|mmol/L|mEq/L|g/dL|g/L|x10\^?3/uL|10\^?3/uL|x10\^?6/uL|10\^?6/uL|k/uL|thou/uL|uL|%|ng/mL|ng/L|ug/L|ug/mL|mcg/L|mcg/mL|pg/mL)\b)?'

# Negative lookahead for prose dimensions, counts, medication dosages, or time units
# Note: mg(?![a-zA-Z/]) rejects bare pill doses like "5 mg" while preserving concentration units like "mg/dL"
NON_LAB_TRAIL = r'(?!\s*(?:mm\b|cm\b|samples?\b|patients?\b|cases?\b|days?\b|hours?\b|hrs?\b|mins?\b|minutes?\b|secs?\b|weeks?\b|months?\b|years?\b|y/o\b|yo\b|tablets?\b|caps?\b|doses?\b|mg(?![a-zA-Z/])|mcg(?![a-zA-Z/])|kg(?![a-zA-Z/])|lbs?\b))'

DELIM = r'(?:\s*\([^\)]+\))?[:=\|\-\t\s]+([<>]?\s*\d+(?:[\.,]\d+)?)(?!\d)' + NON_LAB_TRAIL

def _build_strict_bare_pattern(bare_names: List[str], full_names: List[str], specific_units: Optional[str] = None) -> str:
    """
    Constructs a disambiguated regex pattern for bare abbreviations (e.g. K, Na, Hb, Cr).
    Full names or ion tokens (e.g. Potassium, K+, Sodium, Na+, Hemoglobin, Hgb) can match
    with standard punctuation or whitespace delimiters.
    Bare 1-2 letter abbreviations (e.g. K, Na, Hb, Cr) REQUIRE either:
    1. An explicit punctuation/table delimiter (:, =, |, \t)
    2. OR, if separated only by whitespace, a mandatory clinical unit.
    Both modes reject non-lab dimension/counting nouns (mm, samples, patients, cases, etc.).
    """
    units_pattern = specific_units if specific_units else r'mg/dL|mmol/L|mEq/L|g/dL|g/L|x10\^?3/uL|10\^?3/uL|x10\^?6/uL|10\^?6/uL|k/uL|thou/uL|uL|%|ng/mL|ng/L|ug/L|ug/mL|mcg/L|mcg/mL|pg/mL'
    
    # Branch 1: Full name or distinct ion symbol (e.g., Potassium, K+, Sodium, Na+)
    p_full = r'(?:' + '|'.join(full_names) + r')' + DELIM + r'(?:[\|\-\t\s]*\b(' + units_pattern + r')\b)?'
    
    # Branch 2: Bare abbreviation with explicit table/punctuation delimiter (:, =, |, \t)
    p_bare_delim = r'(?:' + '|'.join(bare_names) + r')(?:\s*\([^\)]+\))?\s*[:=\|\t]+\s*([<>]?\s*\d+(?:[\.,]\d+)?)(?!\d)' + NON_LAB_TRAIL + r'(?:[\|\-\t\s]*\b(' + units_pattern + r')\b)?'
    
    # Branch 3: Bare abbreviation with whitespace only -> MANDATORY clinical unit
    p_bare_ws = r'(?:' + '|'.join(bare_names) + r')(?:\s*\([^\)]+\))?\s+([<>]?\s*\d+(?:[\.,]\d+)?)(?!\d)[\|\-\t\s]+\b(' + units_pattern + r')\b'
    
    return f'(?:{p_full}|{p_bare_delim}|{p_bare_ws})'

def extract_patient_info(text: str) -> Dict[str, Optional[str]]:
    """
    Extracts patient demographics (Name, MRN, DOB) accurately.
    Prevents false positives from headers like 'PATIENT CLINICAL REPORT'.
    """
    info = {"name": None, "mrn": None, "dob": None}
    if not text:
        return info

    # 1. MRN Regex Pattern
    mrn_match = re.search(r'\b(?:mrn|patient\s*id|id\s*num)[:#\s]+([a-zA-Z0-9-]+)\b', text, re.IGNORECASE)
    if mrn_match:
        info["mrn"] = mrn_match.group(1).strip()

    # 2. Patient Name Regex Pattern
    name_match = re.search(
        r'\b(?:patient\s*name|patient|name)\s*[:=]\s*([A-Za-z\s,\.\'-]{2,35}?)(?=\s*\b(?:DOB|MRN|Date|ID|Gender|Age|Sex)\b|[\n\r]|$)',
        text,
        re.IGNORECASE
    )
    if name_match:
        candidate_name = name_match.group(1).strip()
        candidate_name = candidate_name.strip(" ,.-")
        
        disallowed = {"REPORT", "PATIENT", "CLINICAL", "LABORATORY", "UNKNOWN", "EMERGENCY", "DISCHARGE", "NOTE"}
        words = set(candidate_name.upper().split())
        
        if not words.intersection(disallowed) and len(candidate_name) >= 2:
            info["name"] = candidate_name

    # 3. DOB Regex Pattern
    dob_match = re.search(r'\b(?:dob|date\s*of\s*birth)[:\s=]+(\d{2,4}[-/\.]\d{1,2}[-/\.]\d{1,4})\b', text, re.IGNORECASE)
    if dob_match:
        info["dob"] = dob_match.group(1).strip()

    return info


def extract_lab_values(text: str) -> List[Dict[str, Any]]:
    """
    Scans clinical text for lab tests and exact numeric values with unit validation.
    Handles table dividers, European decimal commas, operator signs (<, >),
    and prevents boundary matching bugs on terms like K+ and Na+.
    """
    if not text:
        return []

    extracted_labs: List[Dict[str, Any]] = []

    lab_patterns = {
        "Glucose": r'\b(?:glucose|glu|bsl|fasting\s+blood\s+sugar)\b' + DELIM + VALID_UNITS_REGEX,
        "Potassium": _build_strict_bare_pattern([r'\bk(?!\w)'], [r'\bpotassium\b', r'\bk\+(?!\w)'], r'mmol/L|mEq/L'),
        "Sodium": _build_strict_bare_pattern([r'\bna(?!\w)'], [r'\bsodium\b', r'\bna\+(?!\w)'], r'mmol/L|mEq/L'),
        "INR": r'(?:\bprothrombin\s+inr\b|\bpt[-/]inr\b|\binr\b)' + DELIM + VALID_UNITS_REGEX,
        "Hemoglobin": _build_strict_bare_pattern([r'\bhb\b'], [r'\bhemoglobin\b', r'\bhgb\b'], r'g/dL|g/L|%'),
        "Platelets": _build_strict_bare_pattern([r'\bplt\b'], [r'\bplatelets?\b'], r'x10\^?3/uL|10\^?3/uL|k/uL|thou/uL|uL'),
        "Troponin": r'(?:\btroponin\s*(?:i|t)?\b|\btrop\s*[it]?\b|\bhs-ctn[it]\b)' + DELIM + VALID_UNITS_REGEX,
        "Lactate": r'\b(?:lactate|lactic\s+acid)\b' + DELIM + VALID_UNITS_REGEX,
        "Creatinine": _build_strict_bare_pattern([r'\bcr\b'], [r'\bcreatinine\b', r'\bcreat\b'], r'mg/dL|umol/L'),
    }

    seen_tests = set()

    for test_name, pattern in lab_patterns.items():
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            active_groups = [g for g in match.groups() if g is not None]
            if not active_groups:
                continue

            val_raw = active_groups[0]
            raw_unit = active_groups[1].strip() if len(active_groups) > 1 and active_groups[1] else ""

            try:
                cleaned_val_str = val_raw.replace("<", "").replace(">", "").replace(",", ".").strip()
                val = float(cleaned_val_str)
                if test_name not in seen_tests:
                    extracted_labs.append({
                        "test": test_name,
                        "value": val,
                        "unit": raw_unit
                    })
                    seen_tests.add(test_name)
            except ValueError:
                continue

    return extracted_labs