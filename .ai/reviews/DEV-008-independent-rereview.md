---
task: DEV-008
type: independent-rereview
status: PASS
verdict: PASS
branch: agent/integration-dev-008
base_commit: c464d2aefb86b3b1a25806b71c9232529b15a4ca
reviewed_commit: dd8b86a3d9ad337e03cfe87e445050d1bf32e209
reviewed_range: c464d2aefb86b3b1a25806b71c9232529b15a4ca..dd8b86a3d9ad337e03cfe87e445050d1bf32e209
prior_reviewed_commit: b0650cb35ab36d1901d0fffa26730096209965e3
remediation_commit: 25ccea1c27c8ac04a203318cd33cc1bf0176bee5
reviewer: fresh-independent-codex-read-only
reviewed_at: 2026-11-07T15:18:53Z
blocking_findings: 0
non_blocking_findings: 1
architecture_gate: .ai/development/decisions/TD-001-production-health-data-processing-gate.md
---

# DEV-008 independent rereview

## Verdict

**PASS.** The original blocking finding B1 is remediated and the complete
current head is acceptable for the REVIEW gate. DEV-008 remains provider-
neutral, in-memory, synthetic-data-only work; TD-001 remains `OPEN`. This
review authorizes no provider, credential, network, production persistence,
deployment, or real health-data operation.

## Exact review scope

This fresh review inspected the complete diff from base
`c464d2aefb86b3b1a25806b71c9232529b15a4ca` through current head
`dd8b86a3d9ad337e03cfe87e445050d1bf32e209`, including the implementation,
tests, task metadata, developer handoff, integration handoff, remediation
handoff, original independent review, PD-001, PD-002, the relevant dependency
handoffs/reviews, and TD-001. No implementation, test, or workflow history was
modified by this reviewer; only this rereview and DEV-008 review metadata were
recorded.

## Original finding disposition

### B1 — RESOLVED: one replacement operation timestamp

`apps/backend/src/claims/claim-token-lifecycle.mjs:179-189` captures
`const now = requireTime(clock)` exactly once after the current owner-scoped
record is read. That same `now` is passed to `issuance()` and
`tokens.replace()`. Consequently, replacement `issuedAt`, `expiresAt`, and
the old token's `replacedAt` share one operation timestamp, with the exact
seven-day interval preserved.

The deterministic regression at
`apps/backend/test/claim-token-lifecycle.test.mjs:169-188` supplies distinct
successive values for initial issue and replacement, asserts replacement
`issuedAt` and old `replacedAt` equal the replacement value, asserts
`expiresAt - replacedAt === CLAIM_TOKEN_TTL_MS`, and asserts no extra clock
read remains. This directly fails against the prior implementation and
verifies the replacement boundary rather than relying on a constant clock.

## Security, correctness, and scope assessment

- **Token secrecy and digest-only persistence:** only the one-time `qrPayload`
  contains the raw 256-bit base64url secret; persistence, owner projections,
  audit records, errors, and tested observability-shaped fields contain no raw
  token, and stored lookup uses SHA-256 digest only.
- **Expiry and lifecycle:** issue and replacement use exactly seven 24-hour
  days; consumption rejects at `now >= expiresAt`; revoked, replaced,
  consumed, expired, malformed, unknown, and rate-limited attempts fail with
  the same content-free claim error.
- **Ownership and authorization:** trusted doctor/patient role guards are used;
  issuance uses trusted prescription ownership; direct controls, lists,
  revoke, and replace enforce the stored doctor owner and hide cross-owner
  records as `NOT_FOUND`.
- **Audit and rate limiting:** authenticated patient attempts receive
  server-controlled bounded audit records without raw token or digest fields;
  failed attempts are isolated per trusted patient and the rolling-window
  boundary is covered.
- **Replay, concurrency, and rollback:** consume audits and mutates lifecycle
  state inside the repository's synchronous rollback-capable atomic boundary;
  replay/race coverage permits one success, and injected commit failure restores
  token, index, and audit state so retry succeeds.
- **Replacement and scope:** replacement atomically invalidates the old token,
  creates a fresh secret/digest, and exposes only the intended delivery value.
  DEV-009 identity confirmation, DEV-010 association, durable adapters, UI,
  providers, credentials, deployment, and real health-data paths remain out of
  scope.
- **TD-001:** no provider, network, credential, production persistence,
  deployment, region, or real health-data path was introduced; TD-001 remains
  `OPEN`.

## N1 reassessment — remains non-blocking

The original N1 remains valid but non-blocking: `Promise.allSettled()` over the
synchronous in-memory service demonstrates serialized replay behavior, not an
interleaved durable-adapter race. The remediation handoff explicitly records
this JavaScript-turn serialization assumption and the future durable-adapter
atomicity obligation. No adapter or concurrency scope expansion is warranted
for DEV-008. It is retained as the sole remaining non-blocking finding.

## Validation evidence

- Focused `node --test test/claim-token-lifecycle.test.mjs` from
  `apps/backend` — passed.
- `npm run validate:node` — passed build, all workspace tests (backend 9 test
  files, PWA 2, contracts 2), lint, and foundation static check.
- `git diff --check c464d2aefb86b3b1a25806b71c9232529b15a4ca..HEAD` — passed.
- Validation used existing local dependencies only; no install, network,
  provider, credential, deployment, or real health-data operation was used.

## Counts and gate disposition

Blocking findings: **0**. Non-blocking findings: **1** (N1, accepted and
documented). DEV-008 may remain at the `REVIEW` status pending the repository's
next authorized workflow gate. Do not merge, push, or alter TD-001.
