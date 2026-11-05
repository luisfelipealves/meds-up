import { parentPort, workerData } from "node:worker_threads";

if (parentPort !== null) {
  const abortController = new AbortController();
  parentPort.once("message", (message) => {
    if (message?.type === "ABORT") abortController.abort();
  });

  try {
    const extractorModule = await import(workerData.moduleUrl);
    if (typeof extractorModule.extractProposal !== "function") {
      throw new TypeError("Extractor module must export extractProposal");
    }
    const rawResponse = await extractorModule.extractProposal(Object.freeze({
      request: workerData.request,
      extractorData: workerData.extractorData,
      signal: abortController.signal,
    }));
    if (!(rawResponse instanceof Uint8Array)) {
      throw new TypeError("Extractor response must be mutable bytes");
    }
    parentPort.postMessage(
      Object.freeze({ type: "COMPLETED", rawResponse }),
      [rawResponse.buffer],
    );
  } catch {
    parentPort.postMessage(Object.freeze({ type: "FAILED" }));
  } finally {
    parentPort.close();
  }
}
