const encoder = new TextEncoder();

function payloadFor(outcome) {
  return outcome === "malicious"
    ? { clinicalContent: { medications: [{ medicationName: "Example", dose: "1" }] }, confirmedAt: "forbidden" }
    : {
        clinicalContent: { medications: [{ medicationName: "Example medicine", dose: "1 tablet" }] },
        provenance: { source: "OCR_AI_EXTRACTION", scope: "SESSION_ONLY" },
        confidence: { overall: 0.85 },
      };
}

export async function extractProposal({ extractorData, signal }) {
  const state = new Int32Array(extractorData.stateBuffer);
  const attempt = Atomics.add(state, 0, 1);
  const outcome = extractorData.outcomes[Math.min(attempt, extractorData.outcomes.length - 1)];

  signal.addEventListener("abort", () => Atomics.store(state, 1, 1), { once: true });
  if (outcome === "failure") throw new Error("private provider failure detail");
  if (outcome === "never-settle") {
    await new Promise(() => {
      setInterval(() => Atomics.add(state, 2, 1), 1);
    });
  }
  return encoder.encode(JSON.stringify(payloadFor(outcome)));
}
