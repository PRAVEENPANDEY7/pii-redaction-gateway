# PII Redaction & Compliance Gateway

An interactive, production-grade microservice and compliance simulator designed to detect, redact, and route sensitive user inputs (PII/PHI) securely and offline. Built with a Node/Express backend and a Vite/React frontend, the gateway operates entirely locally with no external cloud API dependencies.

---

## 🚀 Key Features

### 1. Multi-Pattern Deterministic Sweeper
Deterministic regex-based scanning for 15+ sensitive data patterns:
- **Financial Details**: Visa, Mastercard, Amex, Discover, IBAN, and ABA Routing.
- **Identities**: Social Security Numbers (SSN), US National Provider Identifiers (NPI), NHS numbers, Community Health Index (CHI), UK National Insurance numbers (NIN), Canadian Social Insurance numbers (SIN), French CNI, and US Passports.
- **Contact Details**: Email addresses and phone numbers.

### 2. Mathematical Checksum Auditing
Every matched numeric pattern is audited against rigorous mathematical verification checks:
- **Luhn Modulo 10** verification for credit cards and Canadian SINs.
- **National Provider Identifier (NPI)** double-alternate Luhn check (with standard `80840` offset).
- **IBAN Modulo 97** division check.

### 3. Smart Context-Aware NER (Named Entity Recognition)
Detects unstructured identifiers (e.g. names, dates, locations, and custom Health IDs) using word tokenization, lookbehind titles (Dr., Mr., etc.), location context, and capitalization markers.

### 4. Overlap Conflict Resolution ("Longest Wins")
To prevent fragmented redaction blocks when regex patterns and NER matches overlap (e.g., matching a name and an NPI digits block in the same phrase), the gateway resolves boundary contentions using the **"Longest Match Wins"** rule.

### 5. Sentiment-Based Egress Routing & Crisis Bypass
- **Smart Egress**: Sanitized payloads are automatically classified (Positive, Negative, Neutral) and assigned database destinations (Marketing DB, Priority Support DB, or General Feedback DB).
- **Crisis Override**: An instant bypass scanner identifies clinical emergencies or crisis keywords (e.g., self-harm indicators) and terminates standard egress, routing the transaction directly to crisis escalation channels.

### 6. Arbiter Review Queue (Human-in-the-Loop)
Any matched patterns falling within a boundary confidence score range (`0.40` to `0.72`) are flagged as ambiguous. These cases are pushed to the **Arbiter Review Loop** where security officers can manually override (Exclude) or validate (Redact) the matches.

### 7. Interactive Checksum Laboratory
A hands-on testing sandbox demonstrating the step-by-step mathematical progression of Luhn, NPI, and IBAN validation checks on arbitrary inputs.

---

## 📁 Repository Structure

```
pii-redaction-gateway/
├── docs/                      # Requirements docs (BRD, PRD, TRD), User Manual & Architecture Guide
├── dist/                      # Compiled production frontend & backend distribution
├── src/                       # React client application source code
│   ├── App.tsx                # Main UI dashboard containing all sections and styling
│   └── index.css              # Custom global styles
├── tests/                     # Vitest and Supertest integration tests
│   └── api.test.ts            # Integration test suite for API endpoints
├── server.ts                  # Express Backend Server (Sanitization & Routing APIs)
├── render.yaml                # Render Blueprint infrastructure configuration
├── package.json               # Package dependencies and runner scripts
└── tsconfig.json              # TypeScript compilation setup
```

---

## 🛠️ Installation & Local Setup

### Prerequisites
- Node.js (version 18+ recommended)
- npm

### 1. Install Dependencies
```bash
npm install
```

### 2. Run in Development Mode
Starts the local development server (frontend hot reloading + tsx runner for backend):
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:3000`.

### 3. Run Integration Tests
Executes the API test suite using Vitest and Supertest:
```bash
npm test
```

---

## 🛰️ API Endpoints

### 1. Redact Payload
- **Endpoint**: `POST /api/redact`
- **Payload**:
  ```json
  {
    "text": "Send payment of 2000 to Dr. Alexander Mercer NPI 1000000004.",
    "confidenceThreshold": 0.5,
    "enabledTypes": ["PERSON", "US_NPI"],
    "redactionStyle": "standard"
  }
  ```
- **Response**: Returns the `redactedText` containing placeholders and a secure, session-level `mapping` key to restore original values.

### 2. Restore Payload (De-Anonymize)
- **Endpoint**: `POST /api/restore`
- **Payload**: Provide `redactedText` along with its secure `mapping` dictionary to reconstruct the raw text.

### 3. Summarize Compliance Note
- **Endpoint**: `POST /api/compliance/summarize`
- **Payload**: Generates a placeholder-safe structured summary from redacted text.

---

## ☁️ Deployment

Deploy this project instantly to **Render** via the included infrastructure Blueprint:

1. Create a new repository on GitHub and push this code.
2. Go to your **Render Dashboard** and click **New > Blueprint**.
3. Connect the repository. Render will read the `render.yaml` configuration and provision the service automatically.
