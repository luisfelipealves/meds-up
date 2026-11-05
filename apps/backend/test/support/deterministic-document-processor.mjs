export function createDeterministicDocumentProcessor({ outcome = "complete" } = {}) {
  if (!["complete", "fail", "wait-for-abort"].includes(outcome)) {
    throw new TypeError("Unsupported deterministic processor outcome");
  }

  const entries = [];
  let retainedInput = new Uint8Array();

  return Object.freeze({
    process({ input, mimeType, signal, context }) {
      retainedInput = input;
      const entry = {
        input,
        ownerDoctorId: context.ownerDoctorId,
        reviewSessionId: context.reviewSessionId,
        mimeType,
        byteLength: input.byteLength,
        outcome: "STARTED",
      };
      entries.push(entry);

      if (outcome === "complete") {
        entry.outcome = "COMPLETED";
        return Promise.resolve(Object.freeze({ accepted: true }));
      }
      if (outcome === "fail") {
        entry.outcome = "FAILED";
        return Promise.reject(new Error("deterministic processor failure with private details"));
      }
      return new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => {
          entry.outcome = "ABORTED";
          reject(new Error("deterministic processor aborted"));
        }, { once: true });
      });
    },

    retainedInput() {
      return retainedInput;
    },

    operations() {
      return entries.map(({ input, ...entry }) => Object.freeze({
        ...entry,
        discarded: input.every((value) => value === 0),
      }));
    },
  });
}
