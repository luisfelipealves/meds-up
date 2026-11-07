---
task: DEV-008
type: independent-review
status: CHANGES_REQUIRED
verdict: FAIL
branch: agent/integration-dev-008
base_commit: c464d2aefb86b3b1a25806b71c9232529b15a4ca
reviewed_commit: b0650cb35ab36d1901d0fffa26730096209965e3
reviewed_range: c464d2aefb86b3b1a25806b71c9232529b15a4ca..HEAD
reviewer: independent-codex-read-only
reviewed_at: 2026-11-07
blocking_findings: 1
non_blocking_findings: 1
architecture_gate: .ai/development/decisions/TD-001-production-health-data-processing-gate.md
---

# DEV-008 independent review

## Verdict

**FAIL — changes required.** One blocking correctness finding remains. DEV-008
must not advance beyond `REVIEW` until the replacement expiry boundary is fixed
and independently re-reviewed. TD-001 remains `OPEN`; this review authorizes no
provider, credential, deployment, production persistence, network, or real
health-data operation.

## Scope reviewed

Read and compared `.ai/README.md`, DEV-008's task/developer/integration
artifacts, PD-001, PD-002, TD-001, the relevant DEV-002/003/004/007 handoffs
and completed review artifacts, then inspected the complete actual diff from
`c464d2aefb86b3b1a25806b71c9232529b15a4ca` through
`b0650cb35ab36d1901d0fffa26730096209965e3`.

The diff is limited to the DEV-008 claim lifecycle module and tests, the
backend export, and DEV-008 workflow records. No implementation was modified
during this review.

## Requirements that pass

- Default token generation uses `randomBytes(32)` and unpadded base64url,
  yielding a 256-bit opaque payload. The QR delivery object contains no URL or
  clinical/personal fields.
- Persistence and owner control projections contain the SHA-256 digest and
  bounded lifecycle metadata, not the raw token. Attempts, errors, and the
  reviewed source contain no raw-token or digest fields in the tested paths.
- Expiration uses `now >= expiresAt`; issue-time expiry is exactly seven
  24-hour days. Expired, revoked, replaced, consumed, malformed, unknown, and
  rate-limited attempts return the same content-free external failure.
- Doctor operations use the trusted DEV-003 role assertion and stored owner
  predicates. Issuance additionally calls the injected trusted prescription
  ownership authority; cross-owner reads, lists, revoke, and replace fail
  closed with `NOT_FOUND`.
- Consume transitions audit and lifecycle mutation within one synchronous
  rollback-capable in-memory repository boundary. Failed commit restoration,
  replay, rate-limit isolation/boundaries, digest-only persistence, and the
  tested two-attempt race all behave as asserted.
- Replacement invalidates the old token and creates a fresh opaque secret;
  the repository preserves old/new lifecycle linkage without exposing secrets.
- No filesystem, HTTP/network, provider, credential, deployment, real health
  data, or production persistence path was added. The implementation respects
  TD-001's provider-neutral boundary and documents durable-adapter obligations.

## Blocking findings

### B1 — Replacement expiry is not anchored to one operation timestamp

`apps/backend/src/claims/claim-token-lifecycle.mjs:179-189`

`replace()` calls `requireTime(clock)` once when constructing `prepared.record`
and calls it again for the repository's `now` value. Therefore, if the clock
advances between those calls, the returned replacement expires at
`firstNow + 7 days`, while its replacement timestamp is `secondNow`. The
replacement lifetime is then shorter than seven days relative to the atomic
replacement operation (and a backward/adjusted injected clock can produce the
opposite mismatch). This violates the task's exact seven-day replacement
lifetime requirement and is observable with a deterministic clock sequence;
the current tests only use a constant clock.

Capture one validated `now` before preparing the replacement and use that same
value for both `issuedAt`/`expiresAt` and the atomic repository replacement
timestamp. Add a focused test whose clock returns different values on
successive calls and assert that replacement expiry is exactly seven days from
the single operation timestamp. Re-run the focused and full suites, then
request independent rereview of the remediation head.

## Non-blocking finding

### N1 — The concurrency test does not exercise an interleaved repository

`apps/backend/test/claim-token-lifecycle.test.mjs:118-133`

`Promise.allSettled()` invokes both service calls, but the current service and
in-memory repository perform all state changes synchronously before returning
their promises. The test proves serialized replay behavior, not an actual
interleaving or an adapter-level race. This is acceptable for the deliberately
provider-neutral in-memory implementation, but add a repository/adapter
contract test with a controlled interleaving or document the synchronous
serialization assumption explicitly before a durable adapter is introduced.

## Validation evidence

- `node --test apps/backend/test/claim-token-lifecycle.test.mjs` — passed, 9/9.
- `npm test` — passed: backend 9 suites, PWA 2 suites, contracts 2 suites,
  with all tests passing.
- `npm run lint` — passed.
- `npm run build` — passed.
- `git diff --check c464d2aefb86b3b1a25806b71c9232529b15a4ca..HEAD` — passed.
- A deterministic clock probe reproduced B1: the replacement expiry was
  `1000ms` earlier than seven days from the replacement repository timestamp.
- Offline `npm ci --ignore-scripts` was required because the clean worktree
  initially had no installed workspace dependencies; no network or provider
  access was used.

## Rereview requirement

Remediate B1 in the implementation and add the deterministic clock-boundary
test. Preserve the single raw-secret delivery boundary, owner predicates,
content-free failures, atomic consume/replacement semantics, audit behavior,
and TD-001 status. A fresh independent review must inspect the complete
remediation head and rerun focused/full validation before DEV-008 can advance.
