import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../server";

describe("Compliance & PII Redaction Gateway Integration Tests", () => {
  describe("POST /api/redact - Sanitization & Egress Routing", () => {
    it("should successfully redact names and NPI identifiers and route to general feedback", async () => {
      const payload = {
        text: "Dr. Alexander Mercer (NPI: 1000000004) processed the patient.",
        confidenceThreshold: 0.5,
        enabledTypes: ["PERSON", "US_NPI"],
        redactionStyle: "standard"
      };

      const res = await request(app)
        .post("/api/redact")
        .send(payload)
        .expect("Content-Type", /json/)
        .expect(200);

      expect(res.body.originalText).toBe(payload.text);
      expect(res.body.redactedText).toContain("Dr. {{PERSON_1}}");
      expect(res.body.redactedText).toContain("NPI: {{US_NPI_1}}");
      expect(res.body.mapping).toHaveProperty("{{PERSON_1}}", "Alexander Mercer");
      expect(res.body.mapping).toHaveProperty("{{US_NPI_1}}", "1000000004");
      expect(res.body.overrideDetected).toBe(false);
      expect(res.body.sentiment).toBe("NEUTRAL");
      expect(res.body.destinationDB).toBe("General Feedback Database");
    });

    it("should redact using general style completely", async () => {
      const payload = {
        text: "Visa 4111-1111-1111-1111 transaction succeeded.",
        confidenceThreshold: 0.5,
        enabledTypes: ["VISA"],
        redactionStyle: "general"
      };

      const res = await request(app)
        .post("/api/redact")
        .send(payload)
        .expect(200);

      expect(res.body.redactedText).toBe("Visa [REDACTED] transaction succeeded.");
      expect(res.body.mapping).toHaveProperty("[REDACTED]", "4111-1111-1111-1111");
    });

    it("should trigger clinical crisis override when crisis terms are matched", async () => {
      const payload = {
        text: "I am feeling extremely overwhelmed and want to end my life tonight.",
        confidenceThreshold: 0.5,
        enabledTypes: ["PERSON"],
        redactionStyle: "standard"
      };

      const res = await request(app)
        .post("/api/redact")
        .send(payload)
        .expect(200);

      expect(res.body.overrideDetected).toBe(true);
      expect(res.body.redactedText).toContain("EMERGENCY_OVERRIDE");
      expect(res.body.destinationDB).toBe("Priority Crisis Intervention Escalation Channel");
    });
  });

  describe("POST /api/restore - De-Anonymization", () => {
    it("should successfully restore redacted placeholders using the mapping key", async () => {
      const payload = {
        redactedText: "Check with {{PERSON_1}} at {{EMAIL_ADDRESS_1}}.",
        mapping: {
          "{{PERSON_1}}": "Dr. Mercer",
          "{{EMAIL_ADDRESS_1}}": "mercer@provider.org"
        }
      };

      const res = await request(app)
        .post("/api/restore")
        .send(payload)
        .expect(200);

      expect(res.body.restoredText).toBe("Check with Dr. Mercer at mercer@provider.org.");
    });
  });

  describe("GET & POST /api/arbiter - Review Queue Loop", () => {
    it("should fetch active arbiter cases and resolve them successfully", async () => {
      // Fetch cases
      const listRes = await request(app)
        .get("/api/arbiter/cases")
        .expect(200);

      expect(Array.isArray(listRes.body)).toBe(true);
      expect(listRes.body.length).toBeGreaterThan(0);

      const targetCase = listRes.body[0];

      // Resolve case
      const resolvePayload = {
        id: targetCase.id,
        action: "redact",
        decisionBy: "Senior Audit Officer",
        notes: "Verified PII boundary hit"
      };

      const resolveRes = await request(app)
        .post("/api/arbiter/resolve")
        .send(resolvePayload)
        .expect(200);

      expect(resolveRes.body.success).toBe(true);
      expect(resolveRes.body.case.status).toBe("resolved_redact");
      expect(resolveRes.body.case.decisionBy).toBe("Senior Audit Officer");
    });
  });

  describe("POST /api/checksum/validate - Mathematical Laboratories", () => {
    it("should validate a valid Luhn sequence", async () => {
      const res = await request(app)
        .post("/api/checksum/validate")
        .send({ input: "4111111111111111", type: "LUHN" })
        .expect(200);

      expect(res.body.isValid).toBe(true);
      expect(res.body.steps[0]).toContain("Strip formatting");
    });

    it("should validate a valid NPI sequence", async () => {
      const res = await request(app)
        .post("/api/checksum/validate")
        .send({ input: "1000000004", type: "NPI" })
        .expect(200);

      expect(res.body.isValid).toBe(true);
      expect(res.body.steps[1]).toContain("10-digit NPI detected");
    });
  });

  describe("POST /api/compliance/summarize - Placeholder Preservation", () => {
    it("should dynamically output placeholder-safe summaries for clinical notes", async () => {
      const res = await request(app)
        .post("/api/compliance/summarize")
        .send({
          redactedText: "Dr. {{PERSON_1}} reviewed {{PERSON_2}} on {{DATE_1}}.",
          templateType: "clinical"
        })
        .expect(200);

      expect(res.body.responseText).toContain("Dr. **{{PERSON_1}}**");
      expect(res.body.responseText).toContain("referred to as **{{PERSON_2}}**");
      expect(res.body.responseText).toContain("Scheduled for **{{DATE_1}}**");
      expect(res.body.isSimulated).toBe(true);
    });
  });
});
