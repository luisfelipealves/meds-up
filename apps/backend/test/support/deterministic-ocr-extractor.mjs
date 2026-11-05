const encoder = new TextEncoder();

export function createDeterministicOcrExtractor({ outcomes = ["success"] } = {}) {
  const responses = [];
  let attempts = 0;
  return Object.freeze({
    async extract() {
      const outcome = outcomes[Math.min(attempts, outcomes.length - 1)];
      attempts += 1;
      if (outcome === "failure") throw new Error("private provider failure detail");
      const payload = outcome === "malicious"
        ? { clinicalContent: { medications: [{ medicationName: "Example", dose: "1" }] }, confirmedAt: "forbidden" }
        : {
            clinicalContent: { medications: [{ medicationName: "Example medicine", dose: "1 tablet" }] },
            provenance: { source: "OCR_AI_EXTRACTION", scope: "SESSION_ONLY" },
            confidence: { overall: 0.85 },
          };
      const raw = encoder.encode(JSON.stringify(payload));
      responses.push(raw);
      return raw;
    },
    responses() { return responses; },
    attempts() { return attempts; },
  });
}
