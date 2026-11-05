import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ROLES } from "@medsup/contracts";
import { createOcrProposalAdapter, createOcrProposalReviewSession, OCR_PROPOSAL_ERROR_CODES } from "../src/proposals/ocr-proposal-adapter.mjs";
import { createDeterministicIdentityHarness } from "./support/deterministic-identity-harness.mjs";
import { createDeterministicOcrExtractor } from "./support/deterministic-ocr-extractor.mjs";
import { createStructuredLogger } from "../src/observability/structured-logger.mjs";

const REVIEW_SESSION_ID = "review_session_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const DOCTOR_A = Object.freeze({ subjectId: "doctor-owner-0001", role: ROLES.DOCTOR, credential: Object.freeze({ login: "a@example.invalid", secret: "test-a" }) });
const DOCTOR_B = Object.freeze({ subjectId: "doctor-owner-0002", role: ROLES.DOCTOR, credential: Object.freeze({ login: "b@example.invalid", secret: "test-b" }) });

async function fixture({ outcomes, expiresAt = 2_000, clockValue = 1_000, extractor, logger } = {}) {
  const identity = createDeterministicIdentityHarness({ DOCTOR_A, DOCTOR_B });
  const doctorA = await identity.authenticate(DOCTOR_A.credential);
  const doctorB = await identity.authenticate(DOCTOR_B.credential);
  const deterministic = extractor ?? createDeterministicOcrExtractor({ outcomes });
  let now = clockValue;
  const adapter = createOcrProposalAdapter({
    extractor: deterministic,
    providerControls: { retentionDisabled: true, trainingDisabled: true },
  });
  const session = createOcrProposalReviewSession({
    subject: doctorA,
    reviewSessionId: REVIEW_SESSION_ID,
    expiresAt,
    assertAuthenticatedSubject: identity.assertAuthenticatedSubject,
    authorizeReviewSession(candidate, id) {
      if (candidate.subjectId !== DOCTOR_A.subjectId || id !== REVIEW_SESSION_ID) throw new Error("private authorization detail");
    },
    adapter,
    clock: () => now,
    logger,
  });
  return { session, doctorA, doctorB, extractor: deterministic, setNow(value) { now = value; } };
}

test("deterministic extraction returns only a session-bound untrusted proposal and discards raw bytes before settlement", async () => {
  const { session, doctorA, extractor } = await fixture();
  const proposal = await session.extract(doctorA, { mediaType: "image/png" });
  assert.equal(proposal.lifecycle, "SESSION_ONLY_UNTRUSTED");
  assert.equal(proposal.reviewSessionId, REVIEW_SESSION_ID);
  assert.deepEqual(proposal.provenance, { source: "OCR_AI_EXTRACTION", scope: "SESSION_ONLY" });
  assert.deepEqual(proposal.confidence, { overall: 0.85 });
  assert.equal(extractor.responses()[0].every((byte) => byte === 0), true);
  assert.deepEqual(session.getProposal(doctorA), proposal);
  assert.deepEqual(Object.keys(session).sort(), ["abandon", "complete", "extract", "getProposal", "reload"].sort());
});

test("adapter refuses configuration unless retention and training are explicitly disabled", () => {
  const extractor = createDeterministicOcrExtractor();
  for (const providerControls of [undefined, {}, { retentionDisabled: true }, { retentionDisabled: true, trainingDisabled: false }]) {
    assert.throws(() => createOcrProposalAdapter({ extractor, providerControls }), TypeError);
  }
});

test("invalid or malicious raw responses are discarded and never delivered", async () => {
  const { session, doctorA, extractor } = await fixture({ outcomes: ["malicious"] });
  await assert.rejects(session.extract(doctorA, {}), { code: OCR_PROPOSAL_ERROR_CODES.INVALID_RESPONSE });
  assert.equal(extractor.responses()[0].every((byte) => byte === 0), true);
  assert.equal(session.getProposal(doctorA), null);
});

test("provider failure is content-free and retry-safe", async () => {
  const { session, doctorA, extractor } = await fixture({ outcomes: ["failure", "success"] });
  await assert.rejects(session.extract(doctorA, {}), (error) => error.code === OCR_PROPOSAL_ERROR_CODES.EXTRACTION_FAILED && !error.message.includes("private"));
  assert.equal(session.getProposal(doctorA), null);
  assert.equal((await session.extract(doctorA, {})).lifecycle, "SESSION_ONLY_UNTRUSTED");
  assert.equal(extractor.attempts(), 2);
});

test("expiry during processing and after delivery discards proposal without recovery", async () => {
  let release;
  const extractor = {
    responses: [],
    async extract() {
      await new Promise((resolve) => { release = resolve; });
      const raw = new TextEncoder().encode(JSON.stringify({ clinicalContent: { medications: [{ medicationName: "Example", dose: "1" }] }, provenance: { source: "OCR_AI_EXTRACTION", scope: "SESSION_ONLY" }, confidence: { overall: 0.5 } }));
      this.responses.push(raw);
      return raw;
    },
  };
  const first = await fixture({ extractor, expiresAt: 2_000 });
  const pending = first.session.extract(first.doctorA, {});
  first.setNow(2_000);
  release();
  await assert.rejects(pending, { code: OCR_PROPOSAL_ERROR_CODES.SESSION_ENDED });
  assert.equal(extractor.responses[0].every((byte) => byte === 0), true);

  const second = await fixture();
  await second.session.extract(second.doctorA, {});
  second.setNow(2_000);
  assert.throws(() => second.session.getProposal(second.doctorA), { code: OCR_PROPOSAL_ERROR_CODES.SESSION_ENDED });
});

test("abandonment, completion, and reload discard proposal permanently", async () => {
  for (const action of ["abandon", "complete", "reload"]) {
    const { session, doctorA } = await fixture();
    await session.extract(doctorA, {});
    session[action](doctorA);
    assert.throws(() => session.getProposal(doctorA), { code: OCR_PROPOSAL_ERROR_CODES.SESSION_ENDED });
    await assert.rejects(session.extract(doctorA, {}), { code: OCR_PROPOSAL_ERROR_CODES.SESSION_ENDED });
  }
});

test("cross-owner access is denied without revealing session content", async () => {
  const { session, doctorA, doctorB } = await fixture();
  await session.extract(doctorA, {});
  assert.throws(() => session.getProposal(doctorB), (error) => error.code === OCR_PROPOSAL_ERROR_CODES.NOT_FOUND && !error.message.includes(REVIEW_SESSION_ID));
  await assert.rejects(session.extract(doctorB, {}), { code: OCR_PROPOSAL_ERROR_CODES.NOT_FOUND });
});

test("implementation has no provider, network, credential, persistence, or reminder path", async () => {
  const source = await readFile(new URL("../src/proposals/ocr-proposal-adapter.mjs", import.meta.url), "utf8");
  for (const forbidden of ["node:fs", "node:http", "node:https", "fetch(", "process.env", "localStorage", "sessionStorage", "indexedDB", "createReminder", "confirmPrescription", "openai", "supabase", "vercel"]) {
    assert.equal(source.toLowerCase().includes(forbidden.toLowerCase()), false, `forbidden source path: ${forbidden}`);
  }
});

test("observability is closed and content-free across success and discard", async () => {
  const entries = [];
  const logger = createStructuredLogger({ sink: (entry) => entries.push(entry), clock: () => 1_000 });
  const { session, doctorA } = await fixture({ logger });
  await session.extract(doctorA, {});
  session.abandon(doctorA);
  assert.deepEqual(entries.map(({ timestamp, ...entry }) => entry), [
    { event: "ocr.proposal.completed", action: "EXTRACT_PROPOSAL", outcome: "COMPLETED" },
    { event: "ocr.proposal.discarded", action: "DISCARD_PROPOSAL", outcome: "COMPLETED" },
  ]);
  const serialized = JSON.stringify(entries);
  for (const forbidden of [REVIEW_SESSION_ID, DOCTOR_A.subjectId, "Example medicine", "1 tablet"]) assert.equal(serialized.includes(forbidden), false);
});
