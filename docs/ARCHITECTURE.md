# System Architecture & Technical Specifications

## 1. Directory Structure

The repository is structured as a single monorepo microservice containing:
```
pii-redaction-gateway/
├── docs/                      # Business, Product, Technical, and User documentation
├── dist/                      # Compiled production assets (Express backend & static client)
├── src/                       # React TypeScript client source
│   ├── App.tsx                # Primary application interface and styling
│   ├── main.tsx               # Client entry point
│   ├── index.css              # Custom styling definitions
│   └── types.ts               # Shared TypeScript schemas
├── server.ts                  # Main Express Server & Local Compliance Pipeline
├── render.yaml                # Render Blueprint infrastructure schema
├── package.json               # Package dependencies and compile scripts
└── tsconfig.json              # TypeScript engine configurations
```

---

## 2. Pipeline Architecture & Data Flow

The application executes an offline compliance routing pipeline:

1. **Ingress Assessment**:
   The raw client prompt enters the `POST /api/redact` endpoint.
   
2. **Crisis Filter**:
   The input string is scanned for crisis-related phrases (e.g., self-harm indicators). If found, standard processing is aborted instantly; the message is sent directly to a priority crisis route.

3. **Deterministic Scan Layer**:
   Regexes sweep the text looking for structured codes. Matches are audited against active mathematical check routines (Luhn, NPI, IBAN, ABA routing).

4. **Contextual Recognition Layer (Smart NER)**:
   The text is split into tokens. Capitalized word sequences, titles (Dr., Mr.), location clues (Road, Street), and organization suffixes are analyzed to assign type categories (PERSON, DATE, LOCATION, ORGANIZATION) and initial confidence scores.

5. **Overlap Resolution**:
   Entity positions are resolved using a "Longest Wins" algorithm. Smaller nested matches inside a larger matched phrase are discarded to avoid nested bracket structures.

6. **Ambiguity Filtration**:
   Matches scoring between `0.40` and `0.72` are tagged as ambiguous and queued for manual human-in-the-loop audit (Arbiter Queue), while high-confidence matches are redacted instantly.

7. **Egress Routing**:
   A local rule-based sentiment model classifies the text as positive, negative, or neutral and appends appropriate destination database names and URLs to the payload.

---

## 3. High-Compliance Mapping (Security Sandbox)
The mapping between sequential placeholders (e.g. `{{PERSON_1}}`) and original values is created dynamically for each message. 
- Original values are **never stored** in the database.
- The mapping object is returned back to the client boundary or client session in a secure scope, keeping the server completely stateless and preventing any data leak vectors.
