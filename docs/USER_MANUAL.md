# Compliance & PII Redaction Gateway - User Manual

## 1. Introduction
Welcome to the PII Redaction & Compliance Gateway. This application serves as a real-time compliance boundary, protecting your backend datastores from sensitive data ingestion while enabling precise routing and human auditing.

---

## 2. Core Modules & Usage Instructions

### 2.1 The PII Sandbox
The Sandbox is where you can test redaction and de-anonymization workflows in real time.
1. **Input text**: Paste raw text in the Ingress Prompt area (or click **Clinical**, **Financial**, or **Crisis** templates to load pre-configured examples).
2. **Adjust Thresholds**: Use the slider to set a confidence threshold (e.g., `0.5`).
3. **Configure Entities**: Select or deselect checkbox items to specify which PII categories (e.g., SSN, Visa, Person, Email) should be detected.
4. **Choose Style**:
   - **Standard**: Generates sequential placeholders (e.g., `{{PERSON_1}}`) that support safe reverse de-anonymization.
   - **General**: Erases values completely and outputs a flat `[REDACTED]` string.
5. **Run Analysis**: Click **Evaluate Ingress Stream**.

### 2.2 Secure AI Summarization & De-Anonymization
Once redacted:
1. Click **Send Sanitized Prompt to Secure AI** to request a compliance-safe summary.
2. The local compliance engine will return a summarized version utilizing the identical placeholders.
3. Click **De-anonymize & Restore** to reverse the placeholders back to their original values securely using the secure boundary mapping.

### 2.3 Arbiter Queue (Human-in-the-Loop)
Any detected entity with a boundary/ambiguous confidence score between `0.40` and `0.72` (e.g., proper nouns like "March" that might be a person's name or a month) is flagged and queued here:
1. Go to the **Arbiter Queue** tab.
2. Select a pending case from the list.
3. Review the flagged word and its surrounding text.
4. Click **Confirm Redaction** to enforce masking, or **Exclude from Redaction** to allow the text through raw.
5. Provide optional notes and click **Submit Resolution**.

### 2.4 Checksum Laboratory
Use this tab to interactively audit numeric formats:
1. Select the check type: **NPI**, **Luhn**, or **IBAN**.
2. Enter the value you wish to test.
3. Review the step-by-step mathematical breakdown showing exactly how the checksum evaluates to VALID or INVALID.

---

## 3. Compliance Masterclass
The **Masterclass** tab contains learning pathways, interactive scenarios, and quizzes designed to educate compliance and support staff on data security, HIPAA compliance, and proper sanitization pipelines.
