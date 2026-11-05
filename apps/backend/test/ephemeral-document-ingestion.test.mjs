import assert from "node:assert/strict";
import test from "node:test";

import { ROLES } from "@medsup/contracts";
import {
  DOCUMENT_ERROR_CODES,
  createEphemeralDocumentGateway,
} from "../src/ingestion/ephemeral-document-gateway.mjs";
import { createStructuredLogger } from "../src/observability/structured-logger.mjs";
import { createDeterministicDocumentProcessor } from "./support/deterministic-document-processor.mjs";
import { createDeterministicIdentityHarness } from "./support/deterministic-identity-harness.mjs";

const DOCTOR_A = Object.freeze({
  subjectId: "doctor-owner-0001",
  role: ROLES.DOCTOR,
  credential: Object.freeze({ login: "doctor-a@example.invalid", secret: "doctor-a-test-secret" }),
});
const DOCTOR_B = Object.freeze({
  subjectId: "doctor-owner-0002",
  role: ROLES.DOCTOR,
  credential: Object.freeze({ login: "doctor-b@example.invalid", secret: "doctor-b-test-secret" }),
});
const PATIENT = Object.freeze({
  subjectId: "patient-owner-0001",
  role: ROLES.PATIENT,
  credential: Object.freeze({ login: "patient@example.invalid", secret: "patient-test-secret" }),
});
const REVIEW_SESSION_ID = "review_session_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const bytes = (...values) => Uint8Array.from(values);
const concat = (...arrays) => Uint8Array.from(arrays.flatMap((array) => [...array]));
function crc32(input) {
  let crc = 0xffffffff;
  for (const value of input) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data = bytes()) {
  const typeBytes = new TextEncoder().encode(type);
  const crc = crc32(concat(typeBytes, data));
  return concat(
    bytes((data.length >>> 24) & 0xff, (data.length >>> 16) & 0xff, (data.length >>> 8) & 0xff, data.length & 0xff),
    typeBytes,
    data,
    bytes((crc >>> 24) & 0xff, (crc >>> 16) & 0xff, (crc >>> 8) & 0xff, crc & 0xff),
  );
}
const png = ({ width = 1, height = 1 } = {}) => concat(
  bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
  pngChunk("IHDR", bytes(
    (width >>> 24) & 0xff, (width >>> 16) & 0xff, (width >>> 8) & 0xff, width & 0xff,
    (height >>> 24) & 0xff, (height >>> 16) & 0xff, (height >>> 8) & 0xff, height & 0xff,
    0x08, 0x02, 0x00, 0x00, 0x00,
  )),
  pngChunk("IDAT", bytes(0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01)),
  pngChunk("IEND"),
);
const jpeg = () => bytes(
  0xff, 0xd8,
  0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
  0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x01, 0x00, 0x01,
  0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
  0xff, 0xd9,
);
const pdf = (pages = 1) => new TextEncoder().encode(
  `%PDF-1.7\n${Array.from({ length: pages }, (_, index) => `${index + 1} 0 obj << /Type /Page >> endobj`).join("\n")}\n%%EOF`,
);

async function fixture({ processor, timeoutMs = 100, limits, logger, authorizeReviewSession } = {}) {
  const authority = createDeterministicIdentityHarness({ DOCTOR_A, DOCTOR_B, PATIENT });
  const doctorA = await authority.authenticate(DOCTOR_A.credential);
  const doctorB = await authority.authenticate(DOCTOR_B.credential);
  const patient = await authority.authenticate(PATIENT.credential);
  const authorizations = [];
  const configuredProcessor = processor ?? createDeterministicDocumentProcessor();
  const gateway = createEphemeralDocumentGateway({
    assertAuthenticatedSubject: authority.assertAuthenticatedSubject,
    authorizeReviewSession: authorizeReviewSession ?? ((subject, reviewSessionId) => {
      authorizations.push({ subjectId: subject.subjectId, reviewSessionId });
      if (reviewSessionId !== REVIEW_SESSION_ID || subject.subjectId !== DOCTOR_A.subjectId) {
        const error = new Error("The resource was not found.");
        error.code = "NOT_FOUND";
        throw error;
      }
      return Object.freeze({ id: reviewSessionId, status: "ACTIVE" });
    }),
    processor: configuredProcessor,
    timeoutMs,
    limits,
    logger,
  });
  return { gateway, doctorA, doctorB, patient, processor: configuredProcessor, authorizations };
}

async function submit(gateway, subject, input, declaredMimeType) {
  return gateway.submit({ subject, reviewSessionId: REVIEW_SESSION_ID, input, declaredMimeType });
}

for (const [declaredMimeType, input] of [
  ["application/pdf", pdf()],
  ["image/jpeg", jpeg()],
  ["image/png", png()],
]) {
  test(`accepts a valid ${declaredMimeType} into a session-bound provider-neutral handoff`, async () => {
    const { gateway, doctorA, processor, authorizations } = await fixture();
    assert.deepEqual(await submit(gateway, doctorA, input, declaredMimeType), {
      reviewSessionId: REVIEW_SESSION_ID,
      status: "PROCESSED",
    });
    assert.deepEqual(authorizations, [{ subjectId: DOCTOR_A.subjectId, reviewSessionId: REVIEW_SESSION_ID }]);
    assert.deepEqual(processor.operations(), [{
      ownerDoctorId: DOCTOR_A.subjectId,
      reviewSessionId: REVIEW_SESSION_ID,
      mimeType: declaredMimeType,
      byteLength: input.byteLength,
      outcome: "COMPLETED",
      discarded: true,
    }]);
  });
}

test("rejects unauthenticated, non-doctor, and cross-doctor submissions before handoff", async () => {
  const { gateway, doctorA, doctorB, patient, processor } = await fixture();
  await assert.rejects(submit(gateway, doctorB, png(), "image/png"), { code: "NOT_FOUND", message: "The resource was not found." });
  await assert.rejects(submit(gateway, { subjectId: doctorA.subjectId, role: ROLES.DOCTOR }, png(), "image/png"), { code: "INVALID_AUTHENTICATED_SUBJECT" });
  await assert.rejects(submit(gateway, patient, png(), "image/png"), { code: "ROLE_FORBIDDEN" });
  assert.deepEqual(processor.operations(), []);
});

test("normalizes arbitrary authorization failures to content-free errors", async () => {
  const sentinel = "CLINICAL_AUTHORIZATION_DETAIL_MUST_NOT_ESCAPE";
  const { gateway, doctorA, processor } = await fixture({
    authorizeReviewSession() {
      throw new Error(sentinel);
    },
  });
  await assert.rejects(
    submit(gateway, doctorA, png(), "image/png"),
    (error) => error.code === "NOT_FOUND"
      && error.message === "The resource was not found."
      && !error.message.includes(sentinel),
  );
  assert.deepEqual(processor.operations(), []);
});

test("rejects unsupported, mismatched, truncated, polyglot-like, and oversized files with content-free errors", async () => {
  const { gateway, doctorA, processor } = await fixture({ limits: { maxBytes: 1024, maxPdfPages: 2, maxImagePixels: 4 } });
  const invalidCrcPng = png();
  invalidCrcPng[invalidCrcPng.length - 1] ^= 1;
  const missingImageDataPng = concat(
    bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
    pngChunk("IHDR", bytes(0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0)),
    pngChunk("IEND"),
  );
  const cases = [
    [bytes(1, 2, 3), "text/plain", DOCUMENT_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE],
    [png(), "image/jpeg", DOCUMENT_ERROR_CODES.INVALID_DOCUMENT],
    [bytes(0x89, 0x50, 0x4e, 0x47), "image/png", DOCUMENT_ERROR_CODES.INVALID_DOCUMENT],
    [new TextEncoder().encode("%PDF-1.7\n/Type /Page\n%%EOF\n<script>"), "application/pdf", DOCUMENT_ERROR_CODES.INVALID_DOCUMENT],
    [pdf(3), "application/pdf", DOCUMENT_ERROR_CODES.DOCUMENT_LIMIT_EXCEEDED],
    [png({ width: 3, height: 3 }), "image/png", DOCUMENT_ERROR_CODES.DOCUMENT_LIMIT_EXCEEDED],
    [invalidCrcPng, "image/png", DOCUMENT_ERROR_CODES.INVALID_DOCUMENT],
    [missingImageDataPng, "image/png", DOCUMENT_ERROR_CODES.INVALID_DOCUMENT],
    [concat(png(), bytes(0)), "image/png", DOCUMENT_ERROR_CODES.INVALID_DOCUMENT],
    [new Uint8Array(1025), "image/png", DOCUMENT_ERROR_CODES.DOCUMENT_LIMIT_EXCEEDED],
  ];
  for (const [input, declaredMimeType, code] of cases) {
    await assert.rejects(
      submit(gateway, doctorA, input, declaredMimeType),
      (error) => error.code === code && error.message === "The source document was rejected.",
    );
  }
  assert.deepEqual(processor.operations(), []);
});

test("discards the private working copy after processor completion and failure without mutating caller bytes", async () => {
  for (const outcome of ["complete", "fail"]) {
    const processor = createDeterministicDocumentProcessor({ outcome });
    const { gateway, doctorA } = await fixture({ processor });
    const callerInput = png();
    const original = callerInput.slice();
    if (outcome === "complete") await submit(gateway, doctorA, callerInput, "image/png");
    else await assert.rejects(submit(gateway, doctorA, callerInput, "image/png"), { code: DOCUMENT_ERROR_CODES.PROCESSING_FAILED, message: "The source document could not be processed." });
    assert.deepEqual(callerInput, original);
    assert.equal(processor.retainedInput().every((value) => value === 0), true);
    assert.equal(processor.operations()[0].discarded, true);
  }
});

test("timeout aborts the processor, discards input, and returns no processing reference", async () => {
  const processor = createDeterministicDocumentProcessor({ outcome: "wait-for-abort" });
  const { gateway, doctorA } = await fixture({ processor, timeoutMs: 5 });
  await assert.rejects(submit(gateway, doctorA, png(), "image/png"), {
    code: DOCUMENT_ERROR_CODES.PROCESSING_TIMEOUT,
    message: "The source document processing time expired.",
  });
  assert.equal(processor.retainedInput().every((value) => value === 0), true);
  assert.deepEqual(processor.operations().map(({ outcome, discarded }) => ({ outcome, discarded })), [{ outcome: "ABORTED", discarded: true }]);
});

test("timeout waits for delayed processor settlement before reporting discard", async () => {
  let retainedInput;
  let abortObserved = false;
  let release;
  const processor = Object.freeze({
    process({ input, signal }) {
      retainedInput = input;
      signal.addEventListener("abort", () => { abortObserved = true; }, { once: true });
      return new Promise((resolve) => { release = resolve; });
    },
  });
  const { gateway, doctorA } = await fixture({ processor, timeoutMs: 5 });
  let settled = false;
  const submission = submit(gateway, doctorA, png(), "image/png");
  submission.then(() => { settled = true; }, () => { settled = true; });
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(abortObserved, true);
  assert.equal(settled, false);
  assert.equal(retainedInput.some((value) => value !== 0), true);

  release(Object.freeze({ late: true }));
  await assert.rejects(submission, {
    code: DOCUMENT_ERROR_CODES.PROCESSING_TIMEOUT,
    message: "The source document processing time expired.",
  });
  assert.equal(retainedInput.every((value) => value === 0), true);
});

test("logs and errors are allow-listed metadata only and never contain source bytes, names, IDs, or processor references", async () => {
  const entries = [];
  const sentinel = "CLINICAL_SENTINEL_DO_NOT_LOG";
  const logger = createStructuredLogger({
    sink: (entry) => entries.push(entry),
    clock: () => Date.parse("2026-11-05T09:47:39Z"),
  });
  const { gateway, doctorA } = await fixture({ logger });
  const input = new TextEncoder().encode(`%PDF-1.7\n/Type /Page\n${sentinel}\n%%EOF`);
  await submit(gateway, doctorA, input, "application/pdf");
  const serialized = JSON.stringify(entries);
  assert.deepEqual(entries, [{
    timestamp: "2026-11-05T09:47:39.000Z",
    event: "document.ingestion.completed",
    action: "INGEST_DOCUMENT",
    outcome: "COMPLETED",
    mediaType: "PDF",
  }]);
  for (const forbidden of [sentinel, REVIEW_SESSION_ID, DOCTOR_A.subjectId, "provider", "reference", "filename", "%PDF"]) {
    assert.equal(serialized.toLowerCase().includes(forbidden.toLowerCase()), false);
  }
});

test("rejection, failure, and timeout audit events contain only bounded non-clinical categories", async () => {
  const entries = [];
  const logger = createStructuredLogger({ sink: (entry) => entries.push(entry), clock: () => 0 });
  const failedFixture = await fixture({
    logger,
    processor: createDeterministicDocumentProcessor({ outcome: "fail" }),
  });
  await assert.rejects(submit(failedFixture.gateway, failedFixture.doctorA, png(), "image/png"));
  await assert.rejects(submit(failedFixture.gateway, failedFixture.doctorB, png(), "image/png"));
  await assert.rejects(submit(failedFixture.gateway, failedFixture.doctorA, bytes(1, 2, 3), "image/png"));

  const timeoutFixture = await fixture({
    logger,
    processor: createDeterministicDocumentProcessor({ outcome: "wait-for-abort" }),
    timeoutMs: 5,
  });
  await assert.rejects(submit(timeoutFixture.gateway, timeoutFixture.doctorA, png(), "image/png"));

  assert.deepEqual(entries.map(({ timestamp, ...entry }) => entry), [
    { event: "document.ingestion.failed", action: "INGEST_DOCUMENT", outcome: "FAILED", mediaType: "PNG", failureCategory: "PROCESSING_FAILED" },
    { event: "document.ingestion.rejected", action: "INGEST_DOCUMENT", outcome: "REJECTED", mediaType: "PNG", failureCategory: "AUTHORIZATION_REJECTED" },
    { event: "document.ingestion.rejected", action: "INGEST_DOCUMENT", outcome: "REJECTED", mediaType: "PNG", failureCategory: "INVALID_DOCUMENT" },
    { event: "document.ingestion.failed", action: "INGEST_DOCUMENT", outcome: "TIMED_OUT", mediaType: "PNG", failureCategory: "PROCESSING_TIMEOUT" },
  ]);
});

test("implementation has no filesystem, network, URL, durable queue, cache, or storage path", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../src/ingestion/ephemeral-document-gateway.mjs", import.meta.url), "utf8"));
  for (const forbidden of ["node:fs", "node:http", "node:https", "fetch(", "writeFile", "createWriteStream", "database", "bucket", "queue", "cache", "url:"]) {
    assert.equal(source.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  }
});
