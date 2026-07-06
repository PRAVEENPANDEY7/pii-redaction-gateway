export interface PIIEntity {
  type: string;
  text: string;
  startIndex: number;
  endIndex: number;
  score: number;
  checksumVerified?: boolean;
  contextApplied?: boolean;
}

export interface RedactResponse {
  originalText: string;
  redactedText: string;
  mapping: Record<string, string>;
  entities: PIIEntity[];
  overrideDetected: boolean;
  overrideResponse: string;
  sentiment?: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  destinationDB?: string;
  destinationURL?: string;
}

export interface SummarizeResponse {
  responseText: string;
  isSimulated: boolean;
  templateType: string;
}

export interface ArbiterCase {
  id: string;
  timestamp: string;
  originalText: string;
  redactedText: string;
  flaggedWord: string;
  detectedType: string;
  score: number;
  status: "pending" | "resolved_redact" | "resolved_exclude";
  decisionBy?: string;
  notes?: string;
}

export interface ChecksumValidationResult {
  isValid: boolean;
  steps: string[];
}
