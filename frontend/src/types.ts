export type UrgencyTier = 'STAT' | 'URGENT' | 'ROUTINE';
export type DocumentStatus = 'QUEUED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
export type UserRole = 'DOCTOR' | 'NURSE' | 'ADMIN';

export interface Hospital {
  id: string;
  name: string;
  slug: string;
  joinCode?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive?: boolean;
  lastLoginAt?: string | null;
  hospitalId?: string | null;
  hospitalName?: string | null;
  hospital?: Hospital | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  message: string;
}

export interface RuleMatch {
  id: string;
  ruleName: string;
  testName: string;
  foundValue: string;
  threshold: string;
  severity: UrgencyTier;
  description: string;
  createdAt: string;
}

export interface LabValue {
  test: string;
  value: number;
  unit: string;
}

export interface FlaggedPhrase {
  phrase: string;
  category?: string;
  confidence?: number;
  status?: 'present' | 'uncertain';
}

export interface ExtractionResult {
  id: string;
  patientName: string | null;
  mrn: string | null;
  dob: string | null;
  documentType: string | null;
  rawText: string;
  extractedLabValues: LabValue[] | null;
  flaggedPhrases: string[] | FlaggedPhrase[] | null;
  createdAt: string;
}

export interface DocumentItem {
  id: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  status: DocumentStatus;
  urgency: UrgencyTier;
  hospitalId?: string | null;
  createdAt: string;
  updatedAt: string;
  extractionResult?: ExtractionResult | null;
  ruleMatches?: RuleMatch[];
}

export interface StatAlertPayload {
  timestamp: string;
  document: {
    id: string;
    filename: string;
    patientName: string;
    mrn: string;
    urgency: string;
    matchedRules?: RuleMatch[];
  };
  message: string;
}
