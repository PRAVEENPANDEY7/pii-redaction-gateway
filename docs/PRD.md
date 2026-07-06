# Product Requirements Document (PRD)
## PII Redaction & Compliance Gateway

### 1. Product Overview
The PII Redaction & Compliance Gateway is an interactive, browser-based dashboard and API proxy service that allows administrators to sandbox, audit, and manage PII sanitization. The product acts as an interceptor between raw customer feedback portals and backend analytics storage.

### 2. User Personas
- **Compliance Officer (Arbiter)**: Inspects the review queue, evaluates flagged boundary cases, and logs compliance-compliance decisions.
- **Security Administrator**: Configures active detection filters, confidence thresholds, and redaction styles.
- **Frontend / Full Stack Engineer**: Integrates the compliance APIs into client-facing forms and support flows.

### 3. Functional Requirements

#### 3.1 PII Detection and Masking Engine
- **Requirement**: The system must detect and mask 15+ standard PII/PHI types including:
  - SSN, US NPI, VISA, MASTERCARD, AMEX, DISCOVER, ABA Routing, NHS, CHI, UK NIN, CAN SIN, IBAN, French CNI, US Passport, Email, and Phone.
- **Confidence Slider**: Support configuring a confidence threshold (0.0 to 1.0). Only detections scoring at or above the threshold are redacted.
- **Redaction Styles**:
  - **Standard**: Sequential type-indexed placeholders (e.g., `{{PERSON_1}}`, `{{EMAIL_ADDRESS_1}}`) enabling reversible mapping.
  - **General**: Absolute scrubbing replacing all occurrences with `[REDACTED]`.

#### 3.2 Secure De-Anonymization (Restore)
- **Requirement**: The system must allow users to supply a redacted string along with its original mapping dictionary to reconstruct the original message.

#### 3.3 Sentiment-Based Payload Egress Router
- **Requirement**: The system must evaluate the sentiment of incoming messages and dynamically route them:
  - **Positive Sentiment**: Route to the Marketing Database.
  - **Negative Sentiment**: Route to the Priority Support Database.
  - **Neutral Sentiment**: Route to the General Feedback Database.
- **Crisis Override**: Immediate override if phrases indicating self-harm, suicidal ideation, or severe clinical emergency are detected. The payload must bypass standard storage and route directly to a designated Crisis Intervention Escalation Channel.

#### 3.4 Compliance Arbiter Loop (Human-in-the-Loop Queue)
- **Requirement**: Flag any entity detected with a boundary confidence score (between 0.40 and 0.72) and queue it for human review.
- **Actions**:
  - **Redact**: Keep the redaction placeholder active.
  - **Exclude**: Revert the redaction to display the original value (e.g., if a regular month name like "March" was misclassified as a name).

#### 3.5 Interactive Checksum Laboratory
- **Requirement**: Provide step-by-step visual calculations for:
  - Luhn Modulo 10 (Credit Cards, SIN).
  - NPI Checksums.
  - IBAN Division Modulo 97.

### 4. Non-Functional Requirements
- **Performance**: PII sanitization and heuristics must execute locally in `< 50ms` on standard hardware.
- **Privacy & Security**: The gateway must operate completely locally/offline. No text, tokens, or mapping keys should ever be transmitted to external Google APIs or third-party web services.
- **Deployment Compatibility**: Must support Render Blueprint specifications for single-click Docker/Node deployment.
