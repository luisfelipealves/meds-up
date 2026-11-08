---
task: DEV-010
status: READY_FOR_REREVIEW
remediation: DEV-010-B01+DEV-010-B02+DEV-010-B03+DEV-010-N03+DEV-010-N04
branch: agent/integration-dev-010
worktree: /home/felipe/projetos/meds-up-worktrees/integration-dev-010
remediation_commit: ecb79e833957739be092de4bcf19242fa9011b0a
remediated_at: 2026-11-08T12:17:19Z
independent_review: .ai/reviews/DEV-010-independent-review.md
---

# DEV-010 review remediation

## Blocking findings

### DEV-010-B01 — unique association and audit identifiers

The in-memory association repository now maintains indexes for
`patientAssociationId` and `auditEventId` alongside the prescription index.
Uniqueness is checked at prepare and commit. Commit failure and explicit
rollback remove only records whose indexed value is the exact transaction-owned
object, so rollback cannot delete pre-existing records. Collision tests prove
the active token and pre-existing association/audit snapshot remain unchanged.

### DEV-010-B02 — durable minimized failure evidence

A final-claim transaction failure restores token state and rolls back the
prepared association before writing exactly one minimized `FAILED` claim
attempt. The public identity-completion boundary still returns only the generic
`CLAIM_IDENTITY_FAILED` result. `FAILED` participates in the existing per-patient
failed-attempt window; retries retain unique attempt IDs and can subsequently
complete without duplicating associations.

### DEV-010-B03 — collision-safe claim-attempt reservation

The claim-token repository now exposes a provider-neutral, atomic
`reserveAttemptId` boundary. The lifecycle service validates and reserves a
generated attempt ID before preparing or mutating token/association state,
retries collisions at most eight times, and fails closed before business
mutation when no unique ID can be reserved. Transaction rollback restores the
reservation so exactly one minimized `FAILED` audit can consume it afterward.
Pre-existing audits remain untouched. A secondary rollback or audit error is
attached to, but never replaces, the original transaction error; the public
association boundary continues to return only `CLAIM_IDENTITY_FAILED`.

## Non-blocking findings included

- DEV-010-N03: `inspectForTests` is no longer part of the required production
  association-repository contract; it remains available on the in-memory fake.
- DEV-010-N04: a direct cross-patient completion test proves generic failure,
  an active token, and no association.

## Strict TDD evidence

- RED B01 patient-association ID collision: targeted test failed with
  `Missing expected rejection`; GREEN: 1/1 passed after adding the association
  ID index and guarded cleanup.
- RED B01 audit-event ID collision: targeted test failed with
  `Missing expected rejection`; GREEN: both collision tests passed 2/2 after
  adding the audit ID index and guarded cleanup.
- RED B02 duplicate-association failure audit: targeted test observed `0 !== 1`
  failed attempts; GREEN: targeted test passed after post-rollback `FAILED`
  audit persistence.
- RED B02 association commit failure audit: targeted test observed `[]` instead
  of `["FAILED"]`; GREEN: duplicate-conflict and commit-failure tests passed 2/2.
- RED B03 duplicate-association collision: targeted test observed only
  `["INVALID_TOKEN"]` instead of `["INVALID_TOKEN", "FAILED"]`; GREEN preserved
  the existing audit and added one distinct minimized `FAILED` record.
- RED B03 association-commit collision: targeted test observed only
  `["INVALID_TOKEN"]` instead of `["INVALID_TOKEN", "FAILED"]`; GREEN preserved
  rollback and allowed the same confirmed handoff to retry successfully.
- B03 bounded-exhaustion regression passed: repeated collisions fail closed
  with unchanged token, association, and audit state.

## Validation evidence

- Focused claim lifecycle, masked identity, and prescription association tests:
  PASSED, 36/36.
- `npm run validate:node`: PASSED — backend 96/96, PWA 2/2, contracts 17/17;
  build, lint, and foundation static check passed.
- Explicit syntax checks and `git diff --check`: PASSED before the
  production/test commit.
- Production/test remediation commit:
  `ecb79e833957739be092de4bcf19242fa9011b0a`.

## Known issues and boundary

No known issue remains in B01, B02, B03, N03, or N04. N01 and N02 remain unchanged
and non-blocking. TD-001 remains `OPEN`. No merge, push, provider, credential,
network, production persistence, deployment, or real personal/health-data path
was introduced. Independent re-review is still required.
