---
task: DEV-010
type: independent-final-rereview
status: PASS
reviewed_branch: agent/integration-dev-010
reviewed_commit: ee7c8f0bdd1bbe5a6f9e8b0b218e4323f4db9d98
reviewed_at: 2026-11-08T12:21:02Z
blocking_findings: 0
non_blocking_findings: 4
architecture_gate_status: OPEN
---

# DEV-010 independent final rereview

## Verdict

PASS with zero blocking findings. DEV-010-B01, B02, and B03 are resolved.

## Remediation assessment

- Independent indexes enforce unique prescription, patient-association, and
  audit-event identifiers at prepare and commit; identity-guarded rollback
  preserves pre-existing records.
- Transaction failures restore token and association state and persist exactly
  one minimized `FAILED` attempt that participates in rate limiting.
- Claim-attempt identifiers are reserved before business preparation or
  mutation. Collisions retry at most eight times; exhaustion fails closed
  without business-state mutation.
- Snapshot/restore includes reservations, and rollback restores the reservation
  for the subsequent minimized failed audit.
- Secondary rollback/audit failures are attached to the original transaction
  error instead of replacing it. The public boundary remains the generic
  `CLAIM_IDENTITY_FAILED` result.
- Normal, invalid, expired, revoked, repeated, rate-limited, before-commit,
  retry, and in-memory concurrent paths remain passing.

## Validation evidence

- Focused lifecycle, identity, and association tests: 36/36 passed.
- Backend suite: 96/96 passed.
- `npm run validate:node`: backend 96/96, PWA 2/2, contracts 17/17,
  build, lint, and foundation static check passed.
- Complete Node, Android, and Wear validation passed on the unchanged reviewed
  code.
- Syntax checks, `git diff --check`, and independent collision/rollback probes
  passed.

## Non-blocking observations

- N01: NEW_ACCOUNT and EXISTING_ACCOUNT currently converge on the same trusted
  authenticated-subject path; add distinct fixtures when their behavior differs.
- N02: the in-memory concurrency test is synchronous; a future persistent
  adapter requires overlapping-transaction integration coverage.
- N05: `consumeAtomically` is required at identity-service construction even
  for callers that do not use final completion; consider lazy validation or
  contract versioning.
- N06: external token repositories must implement `reserveAttemptId` and
  `consumeAtomically`; document migration and atomic guarantees when a durable
  adapter is introduced.

## TD-001

TD-001 remains `OPEN`. The reviewed scope is provider-neutral, local,
in-memory, and synthetic; it adds no provider, credentials, network,
production persistence, deployment, or real personal/health-data path.
