import logging
import re
from typing import Any, Dict, List

logger = logging.getLogger("NlpEngine")

# Negation cues. A cue only counts if it is in the SAME clause as the finding
# and within a few words of it (see _scope_before / _scope_after).
PRE_NEGATION_CUES = re.compile(
    r"\b(?:no evidence of|no signs? of|no e/o|negative for|without|denies|absence of|"
    r"free of|family history of|no)\b"
)
POST_NEGATION_CUES = re.compile(
    r"\b(?:ruled out|was excluded|is excluded|not seen|not identified|not present|"
    r"not appreciated|not demonstrated|not visualized|is absent|was absent|negative)\b"
)

# Anything that ends a clause: negation must not cross these.
_BREAK_WORDS = r"\b(?:but|however|although|though|except|yet|while|whereas)\b"
POST_BREAK = re.compile(r"[,:()]|" + _BREAK_WORDS)
# Before a finding, a verb like "has/shows" also starts a new clause:
# "patient without fever has pneumothorax" is NOT negated.
PRE_BREAK = re.compile(
    r"[,:()]|" + _BREAK_WORDS + r"|\b(?:has|have|had|shows?|showed|demonstrates?|presents?|presented)\b"
)

WORD_WINDOW = 6  # NegEx-style: cue must be within ~6 words of the finding

# "Cannot be ruled out" contains "ruled out" but means the OPPOSITE of negation.
# Missing a real emergency is the costly error, so uncertainty always flags.
UNCERTAIN = re.compile(
    r"(?i)\b(?:cannot|can\s?not|can't|unable to|not able to)\s+(?:be\s+)?(?:rule[d]?\s+out|exclude[d]?)"
    r"|\bnot\s+(?:been\s+)?(?:ruled\s+out|excluded)\b"
    r"|\b(?:rule\s*out|r/o|possible|probable|suspected|suspicious for|concerning for|may represent)\b"
)

# Sentence boundary regex that prevents false splits on decimals (e.g. 1.5 cm)
# and common clinical abbreviations (Dr., Pt., vs., e.g., i.e.)
SENTENCE_SPLIT_REGEX = re.compile(
    r'(?<!\d)(?<!\bDr)(?<!\bPt)(?<!\bMr)(?<!\bMs)(?<!\bvs)(?<!\be\.g)(?<!\bi\.e)\.(?:\s+(?=[A-Z0-9])|\s*$)|\n+|;'
)

# (pattern, case_sensitive)
RED_FLAG_CATEGORIES = {
    "Pneumothorax": [(r"\bpneumothorax\b", False), (r"\bpleural air\b", False)],
    "Intracranial Hemorrhage": [
        (r"\bintracranial hemorrhage\b", False), (r"\bbrain bleed\b", False),
        (r"\bsubarachnoid hemorrhage\b", False), (r"\bepidural hematoma\b", False),
        (r"\bsubdural hematoma\b", False),
    ],
    "Pulmonary Embolism": [
        (r"\bpulmonary embolism\b", False), (r"\bPE\b", True),
        (r"\bpulmonary artery thrombus\b", False),
    ],
    "Aortic Dissection": [
        (r"\baortic dissection\b", False), (r"\baortic tear\b", False),
        (r"\bthoracic aortic aneurysm\b", False),
    ],
    "Bowel Perforation": [
        (r"\bbowel perforation\b", False), (r"\bpneumoperitoneum\b", False),
        (r"\bfree air in abdomen\b", False),
    ],
    "Acute Infarct": [
        (r"\bacute infarct\b", False), (r"\bacute stroke\b", False),
        (r"\bmyocardial infarction\b", False), (r"\bSTEMI\b", True),
    ],
}


class MedicalNlpEngine:
    """Rule-based, negation-aware red-flag scanner (regex only, any Python version)."""

    @staticmethod
    def _scope_before(text_lower: str, start: int) -> str:
        clause = PRE_BREAK.split(text_lower[:start])[-1]
        return " ".join(clause.split()[-WORD_WINDOW:])

    @staticmethod
    def _scope_after(text_lower: str, end: int) -> str:
        clause = POST_BREAK.split(text_lower[end:])[0]
        return " ".join(clause.split()[:WORD_WINDOW])

    def is_negated(self, text_lower: str, start: int, end: int) -> bool:
        return bool(
            PRE_NEGATION_CUES.search(self._scope_before(text_lower, start))
            or POST_NEGATION_CUES.search(self._scope_after(text_lower, end))
        )

    def scan_for_red_flags(self, text: str) -> List[Dict[str, Any]]:
        if not text:
            return []

        results: List[Dict[str, Any]] = []
        sentences = [s.strip() for s in SENTENCE_SPLIT_REGEX.split(text) if len(s.strip()) >= 2]

        for sentence in sentences:
            lower = sentence.lower()
            uncertain = bool(UNCERTAIN.search(sentence))

            for category, patterns in RED_FLAG_CATEGORIES.items():
                hit = None
                for pattern, case_sensitive in patterns:
                    flags = 0 if case_sensitive else re.IGNORECASE
                    # Check EVERY occurrence: one negated mention must not hide another.
                    for m in re.finditer(pattern, sentence, flags):
                        if uncertain or not self.is_negated(lower, m.start(), m.end()):
                            hit = m
                            break
                    if hit:
                        break
                if hit:
                    results.append({
                        "phrase": sentence,
                        "category": category,
                        "status": "uncertain" if uncertain else "present",
                        "confidence": 0.85 if uncertain else 1.0,
                    })

        logger.info(f"NLP Engine scan complete. Flagged {len(results)} critical phrases.")
        return results


nlp_engine = MedicalNlpEngine()