---
task: DEV-010
type: independent-review
status: CHANGES_REQUIRED
reviewed_branch: agent/integration-dev-010
reviewed_commit: 7e98edfc8f71ea5f6cb97fc4ae5964b9118dc746
reviewed_at: 2026-11-08T12:01:04Z
blocking_findings: 2
non_blocking_findings: 4
architecture_gate_status: OPEN
---

# DEV-010 independent review

## Verdict

CHANGES_REQUIRED. The implementation and complete validation pass, but two
blocking integrity/compliance findings must be remediated and independently
re-reviewed before merge.

## Blocking findings

### DEV-010-B01 — association and audit identifiers are not unique

`apps/backend/src/claims/prescription-association.mjs:70` enforces uniqueness
only by `prescriptionId`. Repeated `patientAssociationId` or `auditEventId`
values can therefore produce distinct associations with indistinguishable
identifiers and audit events.

Required fix: maintain uniqueness indexes for both identifiers, reject
collisions before commit, include the indexes in atomic rollback, and add tests
proving collision rejection leaves token, association, and audit state
unchanged.

### DEV-010-B02 — failed final claims lose all audit evidence

`apps/backend/src/claims/claim-token-lifecycle.mjs:338` prepares the association
before recording the attempt, and the catch restores the entire
`attemptById` snapshot. A duplicate-association conflict or association commit
failure therefore leaves no minimized durable failed-attempt evidence. This
contradicts PD-002's requirement that every claim attempt and outcome be
auditable.

Required fix: preserve business rollback for token consumption and association,
but record exactly one minimized generic failed attempt after a final
transaction failure. The external error must remain generic. Add tests for
association conflict and commit failure proving unchanged business state plus
one auditable failed result.

## Non-blocking findings

- DEV-010-N01: the NEW_ACCOUNT/EXISTING_ACCOUNT loop exercises one identical
  authenticated-subject path; rename it or model genuinely distinct fixtures.
- DEV-010-N02: `Promise.allSettled` exercises the synchronous in-memory fake,
  not overlapping durable transactions; retain it but require true concurrent
  integration coverage for a future persistent adapter.
- DEV-010-N03: `inspectForTests` is unnecessarily required by the production
  repository contract; keep it as an optional fake-only capability.
- DEV-010-N04: add a direct cross-patient completion test proving generic
  failure, active token, and no association.

## Evidence

- Focused claim/identity/association tests: 29/29 passed.
- Backend suite: 89/89 passed.
- `git diff --check origin/main..HEAD`: passed.
- Static added-line scan: no secret or dangerous-construction finding.
- Direct collision proof produced duplicate `patientAssociationId` and
  `auditEventId`, confirming DEV-010-B01.

## Scope and TD-001

The implementation remains provider-neutral, local, in-memory, and synthetic.
No provider, credential, network, production persistence, deployment, or real
personal/health-data path was added. TD-001 remains `OPEN`.
