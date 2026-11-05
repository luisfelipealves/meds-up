import { parentPort, workerData } from "node:worker_threads";

if (parentPort !== null) {
  const abortController = new AbortController();
  parentPort.once("message", (message) => {
    if (message?.type === "ABORT") abortController.abort();
  });

  try {
    const processorModule = await import(workerData.moduleUrl);
    if (typeof processorModule.processDocument !== "function") {
      throw new TypeError("Processor module must export processDocument");
    }
    await processorModule.processDocument(Object.freeze({
      ...workerData.request,
      processorData: workerData.processorData,
      signal: abortController.signal,
    }));
    parentPort.postMessage(Object.freeze({ type: "COMPLETED" }));
  } catch {
    parentPort.postMessage(Object.freeze({ type: "FAILED" }));
  } finally {
    parentPort.close();
  }
}