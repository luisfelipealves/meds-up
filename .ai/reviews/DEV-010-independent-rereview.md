---
task: DEV-010
type: independent-rereview
status: CHANGES_REQUIRED
reviewed_branch: agent/integration-dev-010
reviewed_commit: e7502546014f19c4a2ba403878008083bcb093d9
reviewed_at: 2026-11-08T12:10:33Z
blocking_findings: 1
non_blocking_findings: 3
architecture_gate_status: OPEN
---

# DEV-010 independent rereview

## Verdict

CHANGES_REQUIRED. DEV-010-B01, N03, and N04 are resolved. DEV-010-B02 works
when generated attempt IDs are unique, but one collision path still blocks the
auditable-failure guarantee.

## Blocking finding

### DEV-010-B03 — failed-attempt audit can collide and mask the transaction error

`apps/backend/src/claims/claim-token-lifecycle.mjs:373` writes the post-rollback
`FAILED` event with the same caller-supplied `attemptId`. If that identifier
already exists, `audit()` throws after business rollback, leaves no new failed
attempt, and masks the original transaction error with an ID conflict.

Required fix: reserve or safely allocate a unique claim-attempt identifier
before preparing or mutating business state, retry allocation on collision,
and prevent audit persistence failures from silently replacing the business
error. Add duplicate-ID tests for association conflict and commit failure that
prove full business rollback, preservation of the existing audit, exactly one
new `FAILED` record under a distinct ID, generic external failure, and unchanged
retry/rate-limit behavior.

## Resolved findings

- B01: unique prescription, patient-association, and audit-event indexes are
  checked at prepare and commit; guarded rollback preserves prior records.
- B02 nominal path: transaction failures roll back token and association before
  one minimized `FAILED` attempt; retries and rate-limit behavior pass.
- N03: `inspectForTests` is no longer mandatory in the production association
  repository contract.
- N04: direct cross-patient completion coverage proves generic failure and no
  state mutation.

## Remaining non-blocking findings

- N01: NEW_ACCOUNT and EXISTING_ACCOUNT still execute identical fixtures.
- N02: concurrency coverage remains synchronous/in-memory; require true
  overlapping transactions for a future durable adapter.
- N05: `consumeAtomically` is required when constructing the identity service,
  even for callers that do not use `completeConfirmed`; consider lazy validation
  or explicit contract versioning.

## Evidence

Focused tests passed 33/33 and `git diff --check` passed. A direct duplicate
`claimAttemptId` probe reproduced the missing new `FAILED` event and masked
conflict while preserving the active token.

TD-001 remains `OPEN`; no provider, credential, network, production persistence,
deployment, or real personal/health-data path is present.
