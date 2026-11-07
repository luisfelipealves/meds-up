---
task: DEV-007
type: independent-rereview
status: PASS
base_commit: d6362ae2304e1c20951d8569b2bf4a9f87c105b6
prior_reviewed_head: 2438120ae1c4a8cd0d0090af5c1c327594502731
blocking_review_commit: 96ff7593ce994f41d363eca868e028ba1ee31862
remediation_commit_actual: a7cc726ef3102f7203059ecdfbefe6f34f301a4a
reviewed_head: 26816b5ec37b3dc9421e5d446b84d621e70a43f7
reviewed_at: 2026-11-07T13:57:44Z
reviewer: independent-codex-read-only
blocking_findings: 0
non_blocking_findings: 0
---

# DEV-007 independent re-review

## Verdict

`PASS`. The two prior blocking findings are resolved. DEV-007 may advance to
the human-testing gate, with task status `HUMAN_TESTING`; it remains unmerged,
unpushed, and TD-001 remains `OPEN`.

## Exact identities and scope

The worktree was clean on branch `agent/integration-dev-007`. Verified:

- base: `d6362ae2304e1c20951d8569b2bf4a9f87c105b6`;
- prior reviewed head: `2438120ae1c4a8cd0d0090af5c1c327594502731`;
- blocking review commit: `96ff7593ce994f41d363eca868e028ba1ee31862`;
- actual remediation implementation commit: `a7cc726ef3102f7203059ecdfbefe6f34f301a4a`;
- workflow handoff/current HEAD: `26816b5ec37b3dc9421e5d446b84d621e70a43f7`.

The complete `d6362ae..26816b5` diff and focused remediation diff were
inspected. The remediation implementation is the parent of the reviewed HEAD;
the reviewed HEAD adds workflow evidence only. No production or test
implementation was changed during this review.

## Finding disposition

### B1 — RESOLVED: atomic confirmation and retryability

Confirmation now requires a marked synchronous `confirmAtomically` capability.
The service supplies a side-effect-free `prepare` operation; preparation
validates the timestamp, generated IDs, prescription/version/audit records, and
all linkage before mutation. The in-memory repository returns commit/rollback
operations from `prepareConfirmation`; commit persists the prescription,
immutable version, audit, status-event container, idempotency result, and
session-consumption marker together, while rollback restores all maps, used IDs,
and `serverVersion` from a snapshot. The boundary coordinates active-session
authorization, persistence, and session consumption, so a failed preparation or
commit leaves the session retryable and creates no partial prescription.

Same-key replay returns the stored result and rejects a changed fingerprint;
different-key concurrent confirmation attempts are serialized by the
synchronous in-memory boundary and yield one winner/one conflict. The focused
failure, retry, rollback, and concurrent-attempt tests pass. A custom synthetic
probe confirmed rollback after a commit-side throw and rejection of an async
boundary. The explicit port is a trusted capability contract: an adapter that
violates its stated prepare/commit/rollback and real-transaction obligations is
not made safe by the service. The handoff correctly preserves the future
durable-adapter obligation to use one transaction covering session consumption
and prescription/version/audit persistence, rather than two ordered calls.

### B2 — RESOLVED: generated IDs and complete audit records

Every generated prescription, audit, correlation, event, and subsequent
clinical/status ID is checked for the opaque-ID shape, duplicate values, and
collision with previously used generated IDs before mutation. The closed
`PrescriptionAuditRecord` runtime validator checks API/schema version, event and
outcome, actor, server timestamp, audit/correlation/prescription IDs, version,
previous-version, and resource linkage. Its JSON Schema is closed and covered
by runtime/schema parity tests; cross-field linkage is intentionally enforced by
the runtime validator. Confirmation and clinical-change audit records link the
correct prescription/version/resource values. Status audits retain the current
clinical version and link the status transition resource version without
pretending that a status change created a clinical version.

Malformed clocks/IDs, duplicate IDs, linkage failures, and failure-before-commit
cases are covered by deterministic synthetic tests. Validation precedes status
mutation, including the `serverVersion` increment, and the confirmation
rollback restores `serverVersion` and all records if commit fails.

## Acceptance and security assessment

- Unconfirmed proposals, source documents, raw OCR/AI, provenance, confidence,
  or session-only data are not persisted or exposed as prescription content;
  only corrected explicit `CONFIRMED` clinical content is stored.
- Confirmed content is cloned and immutable; clinical changes append a new
  version and audit linkage, with optimistic resource-version checks.
- Trusted doctor role/subject and owner-scoped repository operations enforce
  ownership/existence hiding for confirmation, reads, changes, suspension, and
  cancellation. Patient, cross-doctor, and forged-owner attempts fail closed.
- Idempotency fingerprints cover the meaningful command content; replay is
  safe and key reuse with different content conflicts.
- Status transitions are allow-listed, terminal cancellation is enforced,
  status events are append-only and resource-versioned, and server versions
  increase only on successful status transitions.
- Suspension/cancellation is represented for downstream synchronization;
  reminder-history behavior remains outside this task.
- No proposal-document/raw-OCR persistence, provider/API/network call,
  credential, deployment, real document, real health data, or unrelated task
  path was added. TD-001 remains `OPEN` and was not altered.

## Resolved workflow metadata observation

The user-supplied/handoff remediation identity
`a7cc7261c31f1bfae96c08e6783664c079b7bbfa` is not an object in this repository.
The actual remediation commit is
`a7cc726ef3102f7203059ecdfbefe6f34f301a4a`, the parent of reviewed HEAD. This
This was a documentation identity typo only; the actual implementation and
focused diff were present and reviewed. Before persisting this review, the
coordinator corrected the task, remediation handoff, and integration handoff to
the actual hash. No non-blocking finding remains.

## Validation evidence

Passed in this review:

- `npm test -w @medsup/backend -- --test-name-pattern='prescription|confirmation'`;
- `npm test -w @medsup/contracts -- --test-name-pattern='audit|schema|published'`;
- full `npm test` (backend, PWA, contracts);
- `node --check` for the confirmation service and contracts runtime;
- deterministic custom rollback/async-boundary probes; and
- `git diff --check d6362ae..26816b5`.

Coordinator evidence recorded in the integration/remediation handoffs reports
the complete writable backend/contracts/PWA, lint, build, Make, and
Android/Wear `validate.sh` matrix passing at the remediation/current workflow
head. This review does not claim to have independently rerun that full matrix.

## Gate disposition

Blocking findings: **0**. Non-blocking findings: **0** after the remediation
hash metadata correction. Set DEV-007 to `HUMAN_TESTING`; the later
human-testing handoff must be created by the coordinator/human gate owner. Do
not merge, push, mark the task `DONE`, alter TD-001, or start other DEV tasks.
