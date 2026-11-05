const SUPPORTED_OUTCOMES = new Set(["success", "failure", "malicious", "never-settle"]);

export function createDeterministicOcrExtractor({ outcomes = ["success"] } = {}) {
  if (!Array.isArray(outcomes) || outcomes.length === 0 || outcomes.some((outcome) => !SUPPORTED_OUTCOMES.has(outcome))) {
    throw new TypeError("Unsupported deterministic extractor outcome");
  }
  const responses = [];
  const lifecycle = [];
  const stateBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 3);
  const state = new Int32Array(stateBuffer);
  return Object.freeze({
    moduleUrl: new URL("./deterministic-ocr-extractor-worker.mjs", import.meta.url),
    extractorData: Object.freeze({ outcomes: Object.freeze([...outcomes]), stateBuffer }),
    recordRawResponse(raw) { responses.push(raw); },
    recordLifecycle(entry) { lifecycle.push(entry); },
    responses() { return responses; },
    operations() { return lifecycle.map((entry) => Object.freeze({ ...entry })); },
    attempts() { return Atomics.load(state, 0); },
    state() {
      return Object.freeze({
        abortObserved: Atomics.load(state, 1) === 1,
        activityCount: Atomics.load(state, 2),
      });
    },
  });
}
