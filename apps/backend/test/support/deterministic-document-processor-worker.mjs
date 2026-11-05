function delayedSettlement(signal, delayMs, state, terminalOutcome, settle) {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      Atomics.store(state, 0, 1);
      setTimeout(() => {
        Atomics.store(state, 2, terminalOutcome);
        settle(resolve, reject);
      }, delayMs);
    };
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function processDocument({ signal, processorData }) {
  const { outcome, delayMs, stateBuffer } = processorData;
  const state = new Int32Array(stateBuffer);
  Atomics.add(state, 1, 1);

  if (outcome === "complete") {
    Atomics.store(state, 2, 1);
    return Promise.resolve();
  }
  if (outcome === "fail") {
    Atomics.store(state, 2, 2);
    return Promise.reject(new Error("deterministic processor failure with private details"));
  }
  if (outcome === "wait-for-abort") {
    return delayedSettlement(signal, 0, state, 2, (_resolve, reject) => {
      reject(new Error("deterministic processor aborted"));
    });
  }
  if (outcome === "complete-after-abort") {
    return delayedSettlement(signal, delayMs, state, 1, (resolve) => resolve());
  }
  if (outcome === "fail-after-abort") {
    return delayedSettlement(signal, delayMs, state, 2, (_resolve, reject) => {
      reject(new Error("deterministic late processor failure"));
    });
  }

  if (signal.aborted) Atomics.store(state, 0, 1);
  else signal.addEventListener("abort", () => { Atomics.store(state, 0, 1); }, { once: true });
  setInterval(() => { Atomics.add(state, 1, 1); }, 1);
  return new Promise(() => {});
}
