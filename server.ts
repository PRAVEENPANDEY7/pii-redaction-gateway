import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

dotenv.config();

export const app = express();
const PORT = 3000;

app.use(express.json());

// Run in secure offline/local compliance mode
console.log("Compliance Gateway server running in secure offline/local compliance mode.");

// Memory database for Arbiter human review queue cases
interface ArbiterCase {
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

const arbiterCases: ArbiterCase[] = [
  {
    id: "case-1",
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    originalText: "Dr. March recommended completing the CBT exercise by May 15th.",
    redactedText: "Dr. {{PERSON_1}} recommended completing the CBT exercise by {{DATE_1}}.",
    flaggedWord: "March",
    detectedType: "PERSON",
    score: 0.62,
    status: "pending"
  },
  {
    id: "case-2",
    timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    originalText: "I sent a payment of 500 dollars to Penny Lane on Friday.",
    redactedText: "I sent a payment of 500 dollars to {{PERSON_2}} Lane on Friday.",
    flaggedWord: "Penny",
    detectedType: "PERSON",
    score: 0.58,
    status: "pending"
  },
  {
    id: "case-3",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    originalText: "The clinical notes indicate patient has a severe allergy to Cedar.",
    redactedText: "The clinical notes indicate patient has a severe allergy to {{PERSON_3}}.",
    flaggedWord: "Cedar",
    detectedType: "PERSON",
    score: 0.45,
    status: "pending"
  }
];

// Heuristics for checksum and regular expression validation
const REGEX_PATTERNS = {
  SSN: /\b(?!000|666|9\d{2})([0-8]\d{2}|7([0-6]\d))([- ]?)(?!00)\d\d\3(?!0000)\d{4}\b/g,
  NPI: /(?<!\d)\d{10}(?!\d)|80840\d{10}(?!\d)/g,
  MASTERCARD: /\b(?:5[1-5][0-9]{2}|222[1-9]|22[3-9][0-9]|2[3-6][0-9]{2}|27[0-9]|2720)[- ]?[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}\b/g,
  VISA: /\b4[0-9]{3}[- ]?[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}\b/g,
  AMEX: /\b3[47][0-9]{13}\b|\b3[47][0-9]{2}[- ]?[0-9]{6}[- ]?[0-9]{5}\b/g,
  DISCOVER: /\b6(?:011|5[0-9]{2})[- ]?[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}\b/g,
  ABA_ROUTING: /(?<!\d)\d{9}(?!\d)/g,
  NHS: /\b\d{3}[- ]?\d{3}[- ]?\d{4}\b/g, // UK NHS Patient identifier
  CHI: /\b\d{10}\b/g, // Scottish Community Health Index
  UK_NIN: /\b[A-Z]{2}\s*\d{2}\s*\d{2}\s*\d{2}\s*[A-Z]?\b/gi, // UK National Insurance
  CAN_SIN: /\b\d{3}[- ]?\d{3}[- ]?\d{3}\b/g, // Canadian SIN
  IBAN: /[A-Z]{2}[0-9]{2}[A-Z0-9]{12,30}/gi,
  FR_CNI: /\b\d{12}[ ]?[0-9A-Z]{1}\b/gi, // French CNI
  US_PASSPORT: /\b[A-Z0-9<]{9}[0-9]{1}[A-Z]{3}[0-9]{7}[A-Z]{1}[0-9]{7}[A-Z0-9<]{14}[0-9]{2}\b/gi,
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  PHONE: /\b(?:\+?1[- ]?)?\(?[2-9]\d{2}\)?[- ]?\d{3}[- ]?\d{4}\b/g,
};

// Checksum functions
function validateLuhn(digitsStr: string): boolean {
  const digits = digitsStr.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 19) return false;
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (alternate) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function validateNPI(npiStr: string): boolean {
  const digits = npiStr.replace(/\D/g, "");
  if (digits.length !== 10 && digits.length !== 15) return false;
  
  let fullDigits = digits;
  if (digits.length === 10) {
    fullDigits = "80840" + digits; // prepend implicit US card issuer ID (+24 checksum offset)
  }
  
  let sum = 0;
  let alternate = false;
  for (let i = fullDigits.length - 1; i >= 0; i--) {
    let d = parseInt(fullDigits[i], 10);
    if (alternate) {
      d *= 2;
      if (d > 9) {
        d = (d % 10) + Math.floor(d / 10);
      }
    }
    sum += d;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function validateIBAN(iban: string): boolean {
  let clean = iban.replace(/[\s-]/g, "").toUpperCase();
  if (clean.length < 4 || clean.length > 34) return false;
  
  let rearranged = clean.slice(4) + clean.slice(0, 4);
  let numeric = "";
  for (let i = 0; i < rearranged.length; i++) {
    let code = rearranged.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      numeric += (code - 55).toString();
    } else if (code >= 48 && code <= 57) {
      numeric += rearranged[i];
    } else {
      return false;
    }
  }
  
  let remainder = 0;
  for (let i = 0; i < numeric.length; i++) {
    remainder = (remainder * 10 + parseInt(numeric[i], 10)) % 97;
  }
  return remainder === 1;
}

function validateABARouting(routingStr: string): boolean {
  const digits = routingStr.replace(/\D/g, "");
  if (digits.length !== 9) return false;
  
  let sum = 0;
  // Weighting factors: 3, 7, 1, 3, 7, 1, 3, 7, 1
  const weights = [3, 7, 1, 3, 7, 1, 3, 7, 1];
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * weights[i];
  }
  return sum % 10 === 0;
}

// Context Words scan helper
// Returns true if any trigger keyword is found within 3-4 words of the text
function checkContextKeywords(text: string, matchedIndex: number, length: number, keywords: string[]): boolean {
  const windowRadius = 40; // look 40 characters left and right
  const start = Math.max(0, matchedIndex - windowRadius);
  const end = Math.min(text.length, matchedIndex + length + windowRadius);
  const snippet = text.slice(start, end).toLowerCase();
  
  return keywords.some(kw => snippet.includes(kw.toLowerCase()));
}

// Dynamic Simulated Named-Entity Recognition + Regex matching engine
interface DetectedSpan {
  type: string;
  text: string;
  startIndex: number;
  endIndex: number;
  score: number;
  checksumVerified?: boolean;
  contextApplied?: boolean;
}

function runPIIGatewayAnalysis(text: string, confidenceThreshold: number, enabledTypes: string[]): DetectedSpan[] {
  const detected: DetectedSpan[] = [];

  // Helper to add if enabled
  const addDetection = (span: DetectedSpan) => {
    if (enabledTypes.includes(span.type) && span.score >= confidenceThreshold) {
      detected.push(span);
    }
  };

  // 1. Regular expression sweeps
  const sweepRegex = (type: string, regex: RegExp, scoreBase: number, validator?: (val: string) => boolean, keywords?: string[]) => {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const matchedText = match[0];
      const startIndex = match.index;
      const endIndex = startIndex + matchedText.length;
      
      let checksumVerified = undefined;
      let finalScore = scoreBase;
      let contextApplied = false;

      if (validator) {
        checksumVerified = validator(matchedText);
        if (!checksumVerified) {
          // Drastically decrease score if checksum validation fails
          finalScore = Math.max(0.1, finalScore - 0.7);
        } else {
          // Perfect verification boosts score
          finalScore = Math.min(1.0, finalScore + 0.15);
        }
      }

      if (keywords) {
        const hasKeyword = checkContextKeywords(text, startIndex, matchedText.length, keywords);
        if (hasKeyword) {
          contextApplied = true;
          finalScore = Math.min(1.0, finalScore + 0.2);
        }
      }

      addDetection({
        type,
        text: matchedText,
        startIndex,
        endIndex,
        score: finalScore,
        checksumVerified,
        contextApplied
      });
    }
  };

  // Run sweeps
  sweepRegex("SSN", REGEX_PATTERNS.SSN, 0.85);
  sweepRegex("US_NPI", REGEX_PATTERNS.NPI, 0.80, validateNPI, ["npi", "provider", "healthcare", "identification"]);
  sweepRegex("MASTERCARD", REGEX_PATTERNS.MASTERCARD, 0.85, validateLuhn, ["mastercard", "card", "billing", "payment"]);
  sweepRegex("VISA", REGEX_PATTERNS.VISA, 0.85, validateLuhn, ["visa", "card", "billing", "payment"]);
  sweepRegex("AMEX", REGEX_PATTERNS.AMEX, 0.85, validateLuhn, ["amex", "card", "billing", "payment", "express"]);
  sweepRegex("DISCOVER", REGEX_PATTERNS.DISCOVER, 0.85, validateLuhn, ["discover", "card", "billing", "payment"]);
  sweepRegex("ABA_ROUTING", REGEX_PATTERNS.ABA_ROUTING, 0.75, validateABARouting, ["routing", "aba", "transit", "bank"]);
  sweepRegex("NHS", REGEX_PATTERNS.NHS, 0.80, undefined, ["nhs", "health", "uk", "patient"]);
  sweepRegex("CHI", REGEX_PATTERNS.CHI, 0.75, undefined, ["chi", "scotland", "patient"]);
  sweepRegex("UK_NIN", REGEX_PATTERNS.UK_NIN, 0.85, undefined, ["nin", "insurance", "national", "uk"]);
  sweepRegex("CAN_SIN", REGEX_PATTERNS.CAN_SIN, 0.80, validateLuhn, ["sin", "social", "canada"]);
  sweepRegex("IBAN", REGEX_PATTERNS.IBAN, 0.85, validateIBAN, ["iban", "bank", "account", "transfer"]);
  sweepRegex("FR_CNI", REGEX_PATTERNS.FR_CNI, 0.80, undefined, ["cni", "france", "identity"]);
  sweepRegex("US_PASSPORT", REGEX_PATTERNS.US_PASSPORT, 0.90, undefined, ["passport", "travel", "us"]);
  sweepRegex("EMAIL_ADDRESS", REGEX_PATTERNS.EMAIL, 0.95);
  sweepRegex("PHONE_NUMBER", REGEX_PATTERNS.PHONE, 0.85, undefined, ["phone", "tel", "call", "mobile", "contact"]);

  // 2. Simulated Named Entity Recognition (NER) for PERSON, DATE, LOCATION, ORGANIZATION
  // We use intelligent word list scanning, capitalized word pairs, titles (Dr., Mr., Mrs.) and common context clues
  const words = text.split(/(\s+|[,.?!;:()])/);
  let charIndex = 0;

  const titleRegex = /\b(dr\.|mr\.|mrs\.|ms\.|prof\.|attending|patient|physician)\b/i;
  const locationClues = /\b(street|road|st\.|ave\.|rd\.|lane|ln\.|city|state|zip|address|hospital|clinic|center|ny|ca|tx|fl)\b/i;
  const organizationClues = /\b(inc|corp|co|llc|hospital|clinic|university|bank|association)\b/i;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const len = word.length;
    
    // Check capitalization context for PERSON names
    if (len > 2 && /^[A-Z][a-z]+$/.test(word)) {
      // Lookbehind for Dr., Mr., etc. or check if neighboring capitalized words exist
      const surroundingTextLeft = text.slice(Math.max(0, charIndex - 25), charIndex);
      const isTitlePreceded = titleRegex.test(surroundingTextLeft);
      
      const surroundingTextRight = text.slice(charIndex + len, Math.min(text.length, charIndex + len + 25));
      const hasCapitalizedPartner = /^[A-Z][a-z]+$/.test(words[i+2] || "");

      if (isTitlePreceded) {
        // High confidence PERSON
        addDetection({
          type: "PERSON",
          text: word,
          startIndex: charIndex,
          endIndex: charIndex + len,
          score: 0.92,
          contextApplied: true
        });
      } else if (hasCapitalizedPartner && words[i+2]) {
        // Combine into single PERSON entity
        const partner = words[i+2];
        const combined = `${word} ${partner}`;
        addDetection({
          type: "PERSON",
          text: combined,
          startIndex: charIndex,
          endIndex: charIndex + len + words[i+1].length + partner.length,
          score: 0.85,
          contextApplied: true
        });
        // Skip next word pair in main loop
        charIndex += word.length;
        continue;
      } else {
        // Ambiguous lowercase person or proper noun (adds to Arbiter Queue if confidence is around threshold!)
        const isCommonMonth = /^(january|february|march|april|may|june|july|august|september|october|november|december)$/i.test(word);
        if (!isCommonMonth) {
          addDetection({
            type: "PERSON",
            text: word,
            startIndex: charIndex,
            endIndex: charIndex + len,
            score: 0.55 // lower score for single capitalized words, matches grey case!
          });
        }
      }
    }

    // DATE simulation (e.g. MM/DD/YYYY or Month DD, YYYY or YYYY-MM-DD)
    const dateMatch = /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4})|(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}(?:st|nd|rd|th)?,? \d{4})\b/i.exec(word);
    if (dateMatch) {
      addDetection({
        type: "DATE",
        text: word,
        startIndex: charIndex,
        endIndex: charIndex + len,
        score: 0.95
      });
    }

    // LOCATION simulation
    const surroundingText = text.slice(Math.max(0, charIndex - 40), Math.min(text.length, charIndex + len + 40));
    if (locationClues.test(surroundingText) && /^[A-Z]/.test(word) && len > 2) {
      const isCommonTitle = /^(dr|mr|mrs|ms|prof)$/i.test(word);
      if (!isCommonTitle) {
        addDetection({
          type: "LOCATION",
          text: word,
          startIndex: charIndex,
          endIndex: charIndex + len,
          score: 0.70,
          contextApplied: true
        });
      }
    }

    charIndex += word.length;
  }

  // Resolve overlapping entities using the "Longest wins" rule
  detected.sort((a, b) => {
    // Primary sort: starting index ascending
    if (a.startIndex !== b.startIndex) return a.startIndex - b.startIndex;
    // Secondary sort: length descending (longest wins)
    return (b.endIndex - b.startIndex) - (a.endIndex - a.startIndex);
  });

  const resolved: DetectedSpan[] = [];
  let lastEnd = -1;
  for (const span of detected) {
    if (span.startIndex >= lastEnd) {
      resolved.push(span);
      lastEnd = span.endIndex;
    }
  }

  return resolved;
}

async function analyzeSentiment(text: string): Promise<"POSITIVE" | "NEGATIVE" | "NEUTRAL"> {
  const lowerText = text.toLowerCase();

  // Rule-based Sentiment Analysis
  const positiveWords = ["love", "great", "excellent", "perfect", "good", "happy", "thanks", "awesome", "recommend", "best", "satisfied", "helpful"];
  const negativeWords = ["hate", "bad", "terrible", "issue", "fail", "broken", "angry", "worst", "error", "waiting", "charge", "refund", "poor", "unhappy", "frustrated", "slow", "delay", "waiting"];
  
  let posCount = 0;
  let negCount = 0;
  
  positiveWords.forEach(word => {
    if (lowerText.includes(word)) posCount++;
  });
  negativeWords.forEach(word => {
    if (lowerText.includes(word)) negCount++;
  });

  if (negCount > posCount) return "NEGATIVE";
  if (posCount > negCount) return "POSITIVE";
  return "NEUTRAL";
}

// REST API endpoints

// Endpoint: REDACT (Sanitize Pipeline)
app.post("/api/redact", async (req, res) => {
  const { text, confidenceThreshold = 0.5, enabledTypes = [], redactionStyle = "standard" } = req.body;

  if (typeof text !== "string") {
    return res.status(400).json({ error: "Input text must be a string." });
  }

  // 1. Check for clinical triage override statements
  const crisisTerms = [
    "suicide", "suicidal", "kill myself", "end my life", "harm myself", 
    "self-harm", "cutting myself", "overdose", "clinical emergency"
  ];
  const lowerText = text.toLowerCase();
  const hasCrisis = crisisTerms.some(term => lowerText.includes(term));

  if (hasCrisis) {
    return res.json({
      originalText: text,
      redactedText: "EMERGENCY_OVERRIDE: Crisis indicator detected. Terminating transaction for immediate clinical routing.",
      mapping: {},
      entities: [],
      overrideDetected: true,
      overrideResponse: "EMERGENCY_OVERRIDE: Crisis indicator detected. Terminating transaction for immediate clinical routing.",
      sentiment: "NEGATIVE",
      destinationDB: "Priority Crisis Intervention Escalation Channel",
      destinationURL: "DB_CRISIS_EMERGENCY_URL"
    });
  }

  // 2. Perform scanning and analysis
  const detections = runPIIGatewayAnalysis(text, confidenceThreshold, enabledTypes);

  // Sort detections in descending order of starting index to reconstruct the redacted text in a single pass
  const sortedDetections = [...detections].sort((a, b) => b.startIndex - a.startIndex);

  const mapping: Record<string, string> = {};
  const counter: Record<string, number> = {};
  let redactedText = text;

  for (const det of sortedDetections) {
    const originalValue = det.text;
    const type = det.type;
    
    counter[type] = (counter[type] || 0) + 1;
    
    let replacement = "";
    if (redactionStyle === "general") {
      replacement = "[REDACTED]";
    } else {
      replacement = `{{${type}_${counter[type]}}}`;
    }
    
    mapping[replacement] = originalValue;

    // Splice replacement
    redactedText = 
      redactedText.slice(0, det.startIndex) + 
      replacement + 
      redactedText.slice(det.endIndex);
  }

  // 3. Populate Ambiguous Cases automatically into the Arbiter Queue
  // Anything detected with score between 0.4 and 0.7 gets flagged as pending review
  const ambiguousSpans = detections.filter(d => d.score >= 0.4 && d.score <= 0.72);
  for (const amb of ambiguousSpans) {
    // Avoid double-adding
    const alreadyExists = arbiterCases.some(c => c.originalText.includes(amb.text) && c.flaggedWord === amb.text);
    if (!alreadyExists) {
      arbiterCases.unshift({
        id: `case-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        originalText: text,
        redactedText: redactedText,
        flaggedWord: amb.text,
        detectedType: amb.type,
        score: parseFloat(amb.score.toFixed(2)),
        status: "pending"
      });
    }
  }

  // 4. Perform Sentiment-Based Routing
  const sentiment = await analyzeSentiment(text);
  let destinationDB = "General Feedback Database";
  let destinationURL = "DB_GENERAL_FEEDBACK_URL";

  if (sentiment === "NEGATIVE") {
    destinationDB = "Priority Support Database";
    destinationURL = "DB_PRIORITY_SUPPORT_URL";
  } else if (sentiment === "POSITIVE") {
    destinationDB = "Marketing Database";
    destinationURL = "DB_MARKETING_URL";
  }

  res.json({
    originalText: text,
    redactedText,
    mapping,
    entities: detections,
    overrideDetected: false,
    overrideResponse: "",
    sentiment,
    destinationDB,
    destinationURL
  });
});

// Endpoint: DE-ANONYMIZE RESTORE
app.post("/api/restore", (req, res) => {
  const { redactedText, mapping } = req.body;

  if (typeof redactedText !== "string" || !mapping) {
    return res.status(400).json({ error: "Missing redactedText or mapping payload." });
  }

  // Prevent substring clobbering: sort placeholders by length descending
  const sortedPlaceholders = Object.keys(mapping).sort((a, b) => b.length - a.length);
  
  let restoredText = redactedText;
  for (const placeholder of sortedPlaceholders) {
    restoredText = restoredText.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), mapping[placeholder]);
  }

  res.json({ restoredText });
});

// Endpoint: GET ARBITER REVIEW QUEUE
app.get("/api/arbiter/cases", (req, res) => {
  res.json(arbiterCases);
});

// Endpoint: RESOLVE ARBITER CASE
app.post("/api/arbiter/resolve", (req, res) => {
  const { id, action, decisionBy = "Advising Officer", notes = "" } = req.body;
  const matchCase = arbiterCases.find(c => c.id === id);
  if (!matchCase) {
    return res.status(404).json({ error: "Case not found." });
  }

  matchCase.status = action === "redact" ? "resolved_redact" : "resolved_exclude";
  matchCase.decisionBy = decisionBy;
  matchCase.notes = notes;

  res.json({ success: true, case: matchCase });
});

// Endpoint: COMPUTE Luhn/IBAN CHECKSUMS (Interactive Explainer)
app.post("/api/checksum/validate", (req, res) => {
  const { input, type } = req.body;
  if (!input) {
    return res.status(400).json({ error: "Missing input." });
  }

  let isValid = false;
  let steps: string[] = [];

  if (type === "NPI") {
    isValid = validateNPI(input);
    const digits = input.replace(/\D/g, "");
    steps.push(`Step 1: Extracted digits: "${digits}"`);
    if (digits.length === 10) {
      steps.push(`Step 2: Standalone 10-digit NPI detected. Prepending standard health card issuer prefix "80840"`);
      const full = "80840" + digits;
      steps.push(`Step 3: Expanded digits: "${full}" (implicit offset: +24)`);
    } else {
      steps.push(`Step 2: 15-digit NPI card-number sequence matched.`);
    }
    steps.push(`Step 4: Executing double-alternate Luhn Modulo 10.`);
    steps.push(`Step 5: Status: ${isValid ? "VALID" : "INVALID"}`);
  } else if (type === "IBAN") {
    isValid = validateIBAN(input);
    const clean = input.replace(/[\s-]/g, "").toUpperCase();
    steps.push(`Step 1: Standardized IBAN: "${clean}"`);
    if (clean.length >= 4) {
      const rearranged = clean.slice(4) + clean.slice(0, 4);
      steps.push(`Step 2: Transferred first 4 chars to the end: "${rearranged}"`);
      steps.push(`Step 3: Substituting alphabetic characters with numeric equivalents (A=10, ..., Z=35)`);
      steps.push(`Step 4: Computed remainder on division by 97 (mod 97).`);
    }
    steps.push(`Step 5: Status: ${isValid ? "VALID (mod 97 equals 1)" : "INVALID"}`);
  } else if (type === "LUHN") {
    isValid = validateLuhn(input);
    steps.push(`Step 1: Strip formatting characters: "${input.replace(/\D/g, "")}"`);
    steps.push(`Step 2: Reverse digits and double every second value from right-to-left.`);
    steps.push(`Step 3: If doubled value > 9, subtract 9.`);
    steps.push(`Step 4: Sum all values and evaluate modulo 10.`);
    steps.push(`Step 5: Status: ${isValid ? "VALID (sum % 10 equals 0)" : "INVALID"}`);
  }

  res.json({ isValid, steps });
});

// Endpoint: COMPLIANCE-PRESERVING SUMMARIZATION (SECURE LOCAL AGENT)
app.post("/api/compliance/summarize", async (req, res) => {
  const { redactedText, templateType } = req.body;

  if (!redactedText || typeof redactedText !== "string") {
    return res.status(400).json({ error: "Missing redacted text payload." });
  }

  let finalResponseText = "";

  // Generate a placeholder-aligned summary dynamically based on detected tokens in the redacted input
  if (templateType === "clinical") {
    const personMatches = Array.from(redactedText.matchAll(/\{\{PERSON_(\d+)\}\}/g)).map(m => m[0]);
    const dateMatches = Array.from(redactedText.matchAll(/\{\{DATE_(\d+)\}\}/g)).map(m => m[0]);
    
    // Dr. Alexander Mercer (PERSON_1) and Pat Patient (PERSON_2)
    const providerPlaceholder = personMatches[0] || "{{PERSON_1}}";
    const patientPlaceholder = personMatches[1] || "{{PERSON_2}}";
    const datePlaceholder = dateMatches[0] || "{{DATE_1}}";

    finalResponseText = `### Clinical Summary
- The patient (referred to as **${patientPlaceholder}**) completed a clinical CBT evaluation session regarding ongoing panic symptoms triggered by a workplace incident.
- Dr. **${providerPlaceholder}** completed the CBT models and structured homework activities.

### Diagnosis & Plan
- **Primary Concerns**: Panic symptoms, intrusive thoughts, and situational avoidance patterns.
- **Treatment Steps**: CBT model analysis; graded exposure assignments.
- **Next Follow-up**: Scheduled for **${datePlaceholder}** under Provider **${providerPlaceholder}** with **${patientPlaceholder}**.`;
  } else {
    const orgMatches = Array.from(redactedText.matchAll(/\{\{ORGANIZATION_(\d+)\}\}/g)).map(m => m[0]);
    const routingMatches = Array.from(redactedText.matchAll(/\{\{ABA_ROUTING_(\d+)\}\}/g)).map(m => m[0]);
    const personMatches = Array.from(redactedText.matchAll(/\{\{PERSON_(\d+)\}\}/g)).map(m => m[0]);
    const emailMatches = Array.from(redactedText.matchAll(/\{\{EMAIL_ADDRESS_(\d+)\}\}/g)).map(m => m[0]);

    const org = orgMatches[0] || "{{ORGANIZATION_1}}";
    const routing = routingMatches[0] || "{{ABA_ROUTING_1}}";
    const person = personMatches[0] || "{{PERSON_1}}";
    const email = emailMatches[0] || "{{EMAIL_ADDRESS_1}}";

    finalResponseText = `{
  "billing_event_detected": true,
  "account_identifier": "${org}",
  "event_summary": "Customer attempted a transfer of USD 5000 using routing number ${routing} associated with ${person}. The transaction failed due to limit limits (ERR_LIMIT_EXCEEDED). Customer email is mapped as ${email}.",
  "recommended_action": "Support should reach out to ${person} at ${email} to coordinate transaction limit increases."
}`;
  }

  res.json({
    responseText: finalResponseText,
    isSimulated: true,
    templateType
  });
});

// Configure Vite or production static server middleware
const setupServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Compliance Gateway server actively running on http://localhost:${PORT}`);
  });
};

if (!process.env.VITEST) {
  setupServer();
}
