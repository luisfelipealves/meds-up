const SUPPORTED_OUTCOMES = new Set([
  "complete",
  "fail",
  "wait-for-abort",
  "ignore-abort",
  "complete-after-abort",
  "fail-after-abort",
]);

export function createDeterministicDocumentProcessor({ outcome = "complete", delayMs = 2 } = {}) {
  if (!SUPPORTED_OUTCOMES.has(outcome)) {
    throw new TypeError("Unsupported deterministic processor outcome");
  }

  const entries = [];
  const stateBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 3);
  const state = new Int32Array(stateBuffer);

  return Object.freeze({
    moduleUrl: new URL("./deterministic-document-processor-worker.mjs", import.meta.url),
    processorData: Object.freeze({ outcome, delayMs, stateBuffer }),
    recordLifecycle(entry) {
      entries.push(entry);
    },
    operations() {
      return entries.map((entry) => Object.freeze({ ...entry }));
    },
    state() {
      return Object.freeze({
        abortObserved: Atomics.load(state, 0) === 1,
        activityCount: Atomics.load(state, 1),
        terminalOutcome: ["NONE", "COMPLETED", "FAILED"][Atomics.load(state, 2)],
      });
    },
  });
}
