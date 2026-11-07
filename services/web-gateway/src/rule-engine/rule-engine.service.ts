import { Injectable, Logger } from '@nestjs/common';
import { UrgencyTier } from '@prisma/client';

export interface ExtractedLabItem {
  test: string;
  value: number;
  unit?: string;
}

export interface RuleMatchDTO {
  ruleName: string;
  testName: string;
  foundValue: string;
  threshold: string;
  severity: UrgencyTier;
  description: string;
}

export interface RuleEvaluationResult {
  overallUrgency: UrgencyTier;
  matchedRules: RuleMatchDTO[];
  excludedByNegation: string[];
}

@Injectable()
export class RuleEngineService {
  private readonly logger = new Logger(RuleEngineService.name);

  /**
   Helper: Normalizes lab values to standard units before evaluation.
   e.g. Glucose 10 mmol/L -> 180 mg/dL | Hemoglobin 70 g/L -> 7.0 g/dL | Troponin 400 ng/L -> 0.4 ng/mL
  
   Troponin fix: ug/L (and mcg/L, same unit written differently) do NOT use
   the same /1000 factor as ng/L. 1 ug = 1000 ng, and 1 L = 1000 mL, so
   those two factors cancel out — 1 ug/L equals exactly 1 ng/mL (no
   scaling). Only ng/L -> ng/mL needs the /1000 division. The previous
   version applied /1000 to both, which silently shrank real ug/L troponin
   values 1000x — turning a STAT-level reading into an apparently normal one.
  */
  private normalizeLabValue(test: string, val: number, unit?: string): { normalizedValue: number; unit: string } {
    const u = (unit || '').toLowerCase().trim();
    const t = test.toLowerCase().trim();

    // 1. Glucose: mmol/L -> mg/dL (multiply by 18)
    if (t.includes('glucose') && u.includes('mmol')) {
      return { normalizedValue: val * 18, unit: 'mg/dL' };
    }

    // 2. Hemoglobin: g/L -> g/dL (divide by 10)
    if ((t.includes('hemoglobin') || t === 'hgb') && u === 'g/l') {
      return { normalizedValue: val / 10, unit: 'g/dL' };
    }

    // 3. Troponin: ng/L or pg/mL -> ng/mL (divide by 1000)
    if ((t.includes('troponin') || t.includes('trop')) && (u === 'ng/l' || u === 'pg/ml')) {
      return { normalizedValue: val / 1000, unit: 'ng/mL' };
    }

    // 3b. Troponin: ug/L or mcg/L -> ng/mL (1:1 — do NOT divide by 1000;
    // the ug->ng (x1000) and L->mL (/1000) factors cancel out).
    if ((t.includes('troponin') || t.includes('trop')) && (u === 'ug/l' || u === 'mcg/l')) {
      return { normalizedValue: val, unit: 'ng/mL' };
    }

    // 4. Platelets: absolute count -> standard x10^3/uL
    // e.g. 18000 /uL -> 18 x10^3/uL
    if ((t.includes('platelet') || t === 'plt') && (u === '/ul' || u === 'ul' || val > 1000)) {
      return { normalizedValue: val / 1000, unit: 'x10^3/uL' };
    }

    return { normalizedValue: val, unit: unit || '' };
  }

  /**
   * Top-Class Medical Rule Engine: Evaluates numeric labs & critical text phrases
   * against standardized hospital panic value ranges.
   */
  evaluateClinicalData(
    labs: ExtractedLabItem[] = [],
    freeTextPhrases: string[] = []
  ): RuleEvaluationResult {
    const matchedRules: RuleMatchDTO[] = [];
    // Negation now happens in ai_service; kept so existing callers/types don't change.
    const excludedByNegation: string[] = [];
    let highestUrgency: UrgencyTier = UrgencyTier.ROUTINE;

    const setUrgency = (tier: UrgencyTier) => {
      if (tier === UrgencyTier.STAT) {
        highestUrgency = UrgencyTier.STAT;
      } else if (tier === UrgencyTier.URGENT && highestUrgency !== UrgencyTier.STAT) {
        highestUrgency = UrgencyTier.URGENT;
      }
    };

    // =========================================================================
    // SECTION A: NUMERIC PANIC VALUE THRESHOLD MATCHING (Unit Normalized)
    // =========================================================================
    for (const lab of labs) {
      if (!lab.test || lab.value === undefined || lab.value === null) continue;

      const name = lab.test.toLowerCase().trim();
      const { normalizedValue: val, unit } = this.normalizeLabValue(lab.test, lab.value, lab.unit);

      // 1. METABOLIC & GLUCOSE PANEL
      if (name.includes('glucose') || name === 'glu' || name === 'bsl') {
        if (val < 40) {
          matchedRules.push({
            ruleName: 'Critical Low Glucose (Hypoglycemic Crisis)',
            testName: 'Glucose', foundValue: `${val.toFixed(1)} ${unit}`, threshold: '< 40 mg/dL',
            severity: UrgencyTier.STAT,
            description: 'Severe hypoglycemia. Risk of neuroglycopenia, seizure, and coma.',
          });
          setUrgency(UrgencyTier.STAT);
        } else if (val >= 40 && val < 60) {
          matchedRules.push({
            ruleName: 'Low Glucose (Hypoglycemia)',
            testName: 'Glucose', foundValue: `${val.toFixed(1)} ${unit}`, threshold: '40 - 60 mg/dL',
            severity: UrgencyTier.URGENT,
            description: 'Symptomatic hypoglycemia requiring immediate glucose administration.',
          });
          setUrgency(UrgencyTier.URGENT);
        } else if (val > 500) {
          matchedRules.push({
            ruleName: 'Critical High Glucose (Hyperglycemic Crisis)',
            testName: 'Glucose', foundValue: `${val.toFixed(1)} ${unit}`, threshold: '> 500 mg/dL',
            severity: UrgencyTier.STAT,
            description: 'Severe hyperglycemia. High risk of DKA or Hyperosmolar Hyperglycemic State.',
          });
          setUrgency(UrgencyTier.STAT);
        } else if (val >= 200 && val <= 500) {
          matchedRules.push({
            ruleName: 'Abnormal High Glucose',
            testName: 'Glucose', foundValue: `${val.toFixed(1)} ${unit}`, threshold: '200 - 500 mg/dL',
            severity: UrgencyTier.URGENT,
            description: 'Uncontrolled blood glucose requiring clinical follow-up.',
          });
          setUrgency(UrgencyTier.URGENT);
        }
      }

      // 2. ELECTROLYTES: POTASSIUM (K+)
      if (name.includes('potassium') || name === 'k' || name === 'k+') {
        if (val < 2.8) {
          matchedRules.push({
            ruleName: 'Critical Low Potassium (Hypokalemia)',
            testName: 'Potassium', foundValue: `${val.toFixed(1)} ${unit}`, threshold: '< 2.8 mEq/L',
            severity: UrgencyTier.STAT,
            description: 'Severe hypokalemia. High risk of lethal ventricular cardiac arrhythmias.',
          });
          setUrgency(UrgencyTier.STAT);
        } else if (val > 6.2) {
          matchedRules.push({
            ruleName: 'Critical High Potassium (Hyperkalemia)',
            testName: 'Potassium', foundValue: `${val.toFixed(1)} ${unit}`, threshold: '> 6.2 mEq/L',
            severity: UrgencyTier.STAT,
            description: 'Severe hyperkalemia. Risk of immediate cardiac standstill / fatal arrest.',
          });
          setUrgency(UrgencyTier.STAT);
        } else if (val >= 2.8 && val < 3.2) {
          matchedRules.push({
            ruleName: 'Low Potassium (Hypokalemia)',
            testName: 'Potassium', foundValue: `${val.toFixed(1)} ${unit}`, threshold: '2.8 - 3.2 mEq/L',
            severity: UrgencyTier.URGENT,
            description: 'Mild-moderate hypokalemia requiring same-day correction.',
          });
          setUrgency(UrgencyTier.URGENT);
        } else if (val > 5.5 && val <= 6.2) {
          matchedRules.push({
            ruleName: 'High Potassium (Hyperkalemia)',
            testName: 'Potassium', foundValue: `${val.toFixed(1)} ${unit}`, threshold: '5.5 - 6.2 mEq/L',
            severity: UrgencyTier.URGENT,
            description: 'Elevated potassium requiring prompt clinical review.',
          });
          setUrgency(UrgencyTier.URGENT);
        }
      }

      // 3. ELECTROLYTES: SODIUM (Na+)
      if (name.includes('sodium') || name === 'na' || name === 'na+') {
        if (val < 120) {
          matchedRules.push({
            ruleName: 'Critical Low Sodium (Hyponatremia)',
            testName: 'Sodium', foundValue: `${val.toFixed(1)} ${unit}`, threshold: '< 120 mEq/L',
            severity: UrgencyTier.STAT,
            description: 'Severe hyponatremia. Risk of cerebral edema, seizures, and respiratory arrest.',
          });
          setUrgency(UrgencyTier.STAT);
        } else if (val > 160) {
          matchedRules.push({
            ruleName: 'Critical High Sodium (Hypernatremia)',
            testName: 'Sodium', foundValue: `${val.toFixed(1)} ${unit}`, threshold: '> 160 mEq/L',
            severity: UrgencyTier.STAT,
            description: 'Severe hypernatremia. Extreme dehydration crisis.',
          });
          setUrgency(UrgencyTier.STAT);
        } else if (val >= 120 && val < 125) {
          matchedRules.push({
            ruleName: 'Low Sodium (Hyponatremia)',
            testName: 'Sodium', foundValue: `${val.toFixed(1)} ${unit}`, threshold: '120 - 125 mEq/L',
            severity: UrgencyTier.URGENT,
            description: 'Moderate hyponatremia requiring same-day correction.',
          });
          setUrgency(UrgencyTier.URGENT);
        } else if (val > 150 && val <= 160) {
          matchedRules.push({
            ruleName: 'High Sodium (Hypernatremia)',
            testName: 'Sodium', foundValue: `${val.toFixed(1)} ${unit}`, threshold: '150 - 160 mEq/L',
            severity: UrgencyTier.URGENT,
            description: 'Moderate hypernatremia requiring fluid management review.',
          });
          setUrgency(UrgencyTier.URGENT);
        }
      }

      // 4. COAGULATION PANEL: INR
      if (name.includes('inr')) {
        if (val > 5.0) {
          matchedRules.push({
            ruleName: 'Critical High INR (Panic Anticoagulation)',
            testName: 'INR', foundValue: `${val.toFixed(1)}`, threshold: '> 5.0',
            severity: UrgencyTier.STAT,
            description: 'Critical bleeding risk. Spontaneous hemorrhage threat.',
          });
          setUrgency(UrgencyTier.STAT);
        } else if (val >= 3.5 && val <= 5.0) {
          matchedRules.push({
            ruleName: 'Elevated Supratherapeutic INR',
            testName: 'INR', foundValue: `${val.toFixed(1)}`, threshold: '3.5 - 5.0',
            severity: UrgencyTier.URGENT,
            description: 'Supratherapeutic INR requiring anticoagulant dose reduction.',
          });
          setUrgency(UrgencyTier.URGENT);
        }
      }

      // 5. HEMATOLOGY: HEMOGLOBIN, PLATELETS
      if (name.includes('hemoglobin') || name === 'hgb') {
        if (val < 7.0) {
          matchedRules.push({
            ruleName: 'Critical Low Hemoglobin (Severe Anemia)',
            testName: 'Hemoglobin', foundValue: `${val.toFixed(1)} ${unit}`, threshold: '< 7.0 g/dL',
            severity: UrgencyTier.STAT,
            description: 'Critical blood loss or severe anemia. Blood transfusion evaluation required.',
          });
          setUrgency(UrgencyTier.STAT);
        } else if (val >= 7.0 && val < 8.5) {
          matchedRules.push({
            ruleName: 'Low Hemoglobin (Anemia)',
            testName: 'Hemoglobin', foundValue: `${val.toFixed(1)} ${unit}`, threshold: '7.0 - 8.5 g/dL',
            severity: UrgencyTier.URGENT,
            description: 'Moderate anemia requiring same-day clinical review.',
          });
          setUrgency(UrgencyTier.URGENT);
        }
      }

      if (name.includes('platelet') || name === 'plt') {
        if (val < 20) {
          matchedRules.push({
            ruleName: 'Critical Low Platelets (Thrombocytopenia)',
            testName: 'Platelets', foundValue: `${val.toFixed(0)} x10^3/uL`, threshold: '< 20 x10^3/uL',
            severity: UrgencyTier.STAT,
            description: 'Severe thrombocytopenia. High risk of spontaneous intracranial/internal bleed.',
          });
          setUrgency(UrgencyTier.STAT);
        } else if (val >= 20 && val < 50) {
          matchedRules.push({
            ruleName: 'Low Platelets (Thrombocytopenia)',
            testName: 'Platelets', foundValue: `${val.toFixed(0)} x10^3/uL`, threshold: '20 - 50 x10^3/uL',
            severity: UrgencyTier.URGENT,
            description: 'Moderate thrombocytopenia requiring same-day hematology review.',
          });
          setUrgency(UrgencyTier.URGENT);
        }
      }

      // 6. CARDIAC BIOMARKERS: TROPONIN & LACTATE
      if (name.includes('troponin') || name.includes('trop')) {
        if (val > 0.04) {
          matchedRules.push({
            ruleName: 'Elevated Cardiac Troponin (Myocardial Injury)',
            testName: 'Troponin', foundValue: `${val.toFixed(3)} ${unit}`, threshold: '> 0.04 ng/mL',
            severity: UrgencyTier.STAT,
            description: 'Indicates acute myocardial injury / Heart Attack (STEMI/NSTEMI).',
          });
          setUrgency(UrgencyTier.STAT);
        }
      }

      if (name.includes('lactate') || name === 'lactic acid') {
        if (val > 4.0) {
          matchedRules.push({
            ruleName: 'Critical High Lactate (Septic Shock Risk)',
            testName: 'Lactate', foundValue: `${val.toFixed(1)} ${unit}`, threshold: '> 4.0 mmol/L',
            severity: UrgencyTier.STAT,
            description: 'Severe lactic acidosis. High mortality indicator for Septic Shock / Tissue Hypoxia.',
          });
          setUrgency(UrgencyTier.STAT);
        } else if (val >= 2.0 && val <= 4.0) {
          matchedRules.push({
            ruleName: 'Elevated Lactate',
            testName: 'Lactate', foundValue: `${val.toFixed(1)} ${unit}`, threshold: '2.0 - 4.0 mmol/L',
            severity: UrgencyTier.URGENT,
            description: 'Elevated lactate requiring fluid resuscitation protocol.',
          });
          setUrgency(UrgencyTier.URGENT);
        }
      }

      // 7. RENAL FUNCTION: CREATININE
      if (name.includes('creatinine') || name === 'cr') {
        if (val > 5.0) {
          matchedRules.push({
            ruleName: 'Critical High Creatinine (Acute Renal Failure)',
            testName: 'Creatinine', foundValue: `${val.toFixed(1)} ${unit}`, threshold: '> 5.0 mg/dL',
            severity: UrgencyTier.STAT,
            description: 'Severe acute kidney injury. Immediate nephrology evaluation / dialysis check.',
          });
          setUrgency(UrgencyTier.STAT);
        } else if (val >= 2.5 && val <= 5.0) {
          matchedRules.push({
            ruleName: 'Elevated Creatinine',
            testName: 'Creatinine', foundValue: `${val.toFixed(1)} ${unit}`, threshold: '2.5 - 5.0 mg/dL',
            severity: UrgencyTier.URGENT,
            description: 'Significant renal dysfunction requiring medication nephrotoxicity review.',
          });
          setUrgency(UrgencyTier.URGENT);
        }
      }
    }

    // =========================================================================
    // SECTION B: RADIOLOGY & FREE-TEXT CRITICAL FINDING PHRASES
    // Negation is decided in ai_service (nlp_engine.py): every phrase it sends is a
    // present or uncertain finding, so there is no second negation pass here.
    // Keep these lists in sync with RED_FLAG_CATEGORIES in nlp_engine.py.
    // PE and STEMI are case-sensitive on purpose.
    // =========================================================================
    const criticalTextRedFlags: { patterns: RegExp[]; rule: string; desc: string }[] = [
      { patterns: [/\bpneumothorax\b/i, /\bpleural air\b/i], rule: 'Tension / Acute Pneumothorax Flagged', desc: 'Air in pleural space detected on imaging.' },
      { patterns: [/\bintracranial hemorrhage\b/i, /\bbrain bleed\b/i, /\bsubarachnoid hemorrhage\b/i, /\bepidural hematoma\b/i, /\bsubdural hematoma\b/i], rule: 'Acute Brain Bleed Flagged', desc: 'Intracranial / Subarachnoid hemorrhage detected.' },
      { patterns: [/\bpulmonary embolism\b/i, /\bPE\b/, /\bpulmonary artery thrombus\b/i], rule: 'Pulmonary Embolism (PE) Flagged', desc: 'Occlusive blood clot in pulmonary arteries detected.' },
      { patterns: [/\baortic dissection\b/i, /\baortic tear\b/i, /\bthoracic aortic aneurysm\b/i], rule: 'Aortic Dissection Flagged', desc: 'Life-threatening tear in aortic wall.' },
      { patterns: [/\bbowel perforation\b/i, /\bpneumoperitoneum\b/i, /\bfree air in abdomen\b/i], rule: 'Free Air / Bowel Perforation', desc: 'Pneumoperitoneum indicating GI perforation.' },
      { patterns: [/\bacute infarct\b/i, /\bacute stroke\b/i, /\bmyocardial infarction\b/i, /\bSTEMI\b/], rule: 'Acute Cerebral / Myocardial Infarction', desc: 'Acute ischemic infarct / STEMI detected.' },
    ];

    const seenRules = new Set<string>();
    for (const phrase of freeTextPhrases) {
      if (!phrase) continue;
      for (const flag of criticalTextRedFlags) {
        if (seenRules.has(flag.rule)) continue;
        const hit = flag.patterns.map((p) => phrase.match(p)).find((m) => m);
        if (!hit) continue;
        seenRules.add(flag.rule);
        matchedRules.push({
          ruleName: flag.rule,
          testName: 'Radiology / Clinical Text',
          foundValue: hit[0],
          threshold: 'Free-Text Red Flag Match',
          severity: UrgencyTier.STAT,
          description: flag.desc,
        });
        setUrgency(UrgencyTier.STAT);
      }
    }

    this.logger.log(
      `Rule Engine Execution Complete: Evaluated ${labs.length} labs, ${freeTextPhrases.length} phrases. ` +
      `Matched: ${matchedRules.length}. Final Tier: ${highestUrgency}`
    );

    return { overallUrgency: highestUrgency, matchedRules, excludedByNegation };
  }
}