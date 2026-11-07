---
task: DEV-007
type: independent-review
status: CHANGES_REQUIRED
base_commit: d6362ae2304e1c20951d8569b2bf4a9f87c105b6
reviewed_head: 2438120ae1c4a8cd0d0090af5c1c327594502731
reviewed_at: 2026-11-07T13:42:10Z
reviewer: independent-codex-read-only
blocking_findings: 2
non_blocking_findings: 0
---

# DEV-007 independent review

## Verdict

`CHANGES_REQUIRED`. The integrated implementation has two blocking defects in
confirmation transaction semantics and audit-record validation. The task remains
`INTEGRATED`; it must not advance to the reserved human gate until remediation
and an independent re-review of the resulting exact head.

## Reviewed scope and context

The exact reviewed range is
`d6362ae2304e1c20951d8569b2bf4a9f87c105b6..2438120ae1c4a8cd0d0090af5c1c327594502731`.
HEAD and base identities were verified with `git rev-parse`; the worktree was
clean before review. I read `.ai/README.md`, DEV-007, PD-001, PD-008, TD-001,
TECH-PLAN-PD-001, the relevant DEV-004 and DEV-006 handoffs/reviews, and the
DEV-007 developer and integration handoffs. I inspected the complete actual
base-to-target diff, including implementation, tests, contracts, schema, and
workflow changes.

## Findings

### BLOCKING B1 — Review-session completion is not atomic with persistent confirmation

Location: `apps/backend/src/prescriptions/prescription-confirmation.mjs:117-136`,
especially the call to `completeReviewSession` at lines 123-126 before
`confirmedRepository.confirm` at lines 128-135.

The service consumes the active ephemeral review session first and only then
attempts to create the confirmed prescription. If repository confirmation,
generated-ID validation, timestamp creation, or any later persistence step
throws, the caller receives failure but the session has already been completed.
The caller cannot retry the same explicit confirmation, while no persistent
prescription exists. This violates PD-001/PD-008's requirement that only a
successful explicit confirmation create the reminder source and the DEV-007
acceptance requirement that an unconfirmed proposal cannot be lost or converted
through a partial transaction.

Evidence: a deterministic synthetic harness with a repository whose `confirm`
throws produced `{error:"synthetic repository failure", sessionStillActive:false}`.
The existing tests cover successful completion and a synchronous in-memory
repository, but do not inject repository failure after session completion or
assert retryability/no session consumption on persistence failure. The API also
rejects an async completion result only after invoking it, so an accidentally
async completion boundary can already mutate session state before the rejection
is observed.

Required remediation: make session consumption and prescription persistence one
atomic boundary with a commit/rollback or prepare/commit contract, and prove
repository failure, invalid generated data, concurrent different-key attempts,
and retry behavior with adversarial deterministic tests. The durable adapter
boundary must preserve the same transaction invariant.

### BLOCKING B2 — Generated audit identifiers and audit records are not validated

Location: `apps/backend/src/prescriptions/prescription-confirmation.mjs:96-102`
and `:226-240`, with persistence at `:305-311`, `:358-362`, and `:408-412`.

`ids()` accepts arbitrary values from `createId`, and `audit()` constructs an
audit-shaped object without calling `validateAuditReference`. The prescription,
version, and status-event paths validate some generated IDs, but audit IDs and
security-correlation IDs are not checked. Audit records also add prescription
linkage fields beyond the published `AuditReference` contract without a separate
validated audit-record contract. A deterministic generator returning
`auditReferenceId: "bad"` was accepted and returned; calling the existing
`validateAuditReference` on that result failed. Thus malformed audit identifiers
and records can be persisted and exposed, undermining immutable audit linkage,
actor/time reliability, and schema/runtime parity.

Required remediation: validate every generated identifier before session commit
and persistence, validate the complete audit record shape (including its
prescription/version linkage) against an explicit runtime and JSON-Schema
contract, reject duplicate/colliding generated IDs as appropriate, and add
malformed-ID, malformed-clock, linkage, and schema-parity tests. This must be
fixed within the same atomic confirmation boundary as B1 so invalid audit data
cannot consume a session.

## Acceptance assessment

- No unconfirmed proposal is directly passed into the repository and the
  successful-path tests show only corrected clinical content is stored. This is
  insufficient for the failed-confirmation path because B1 can consume the
  ephemeral session without creating the confirmed source.
- Immutable version snapshots, owner-scoped reads/mutations, expected resource
  version checks, status transition allow-listing, and cloned returned history
  are present and passed the focused tests.
- Ownership/existence hiding is generally preserved for the service methods and
  payload owner checks. No cross-doctor data disclosure was found in the
  reviewed implementation.
- Idempotency replay and optimistic concurrency are implemented inside the
  synchronous in-memory repository, but confirmation idempotency does not repair
  a session consumed before a failed repository commit. Concurrent same-version
  clinical changes were tested; concurrent confirmation with failure/different
  keys was not.
- Suspension and cancellation emit validated monotonic status events and make
  cancellation terminal on the successful path. No separate blocker was found
  there.
- The focused test suite is useful for success-path ownership, immutability,
  idempotency, concurrency, and status behavior, but is missing the failure
  atomicity, generated-ID, audit-contract, and async-boundary adversarial cases
  identified above.

## Privacy, security, scope, and TD-001

The reviewed diff contains no source-document or raw OCR persistence path,
provider/API/network call, credential, deployment, production persistence,
real document, real health-data operation, or unrelated task scope. The
in-memory/provider-neutral boundary is appropriate for this task. Sensitive
proposal/provenance/confidence fields are not passed into the successful
repository records, and no new logging path was found. TD-001 remains `OPEN`
and unchanged; this review neither resolves nor authorizes that gate.

## Validation and evidence run

- `git status --short --branch`, `git rev-parse HEAD`, base `git rev-parse`, and
  `git diff --stat`: exact identities verified; clean initial worktree.
- Complete base-to-target diff inspection and `git diff --check`: passed.
- `npm test`: passed (backend 56/56, PWA 2/2, contracts 15/15).
- `npm run lint`: passed.
- `npm run build`: passed.
- `./scripts/validate.sh` with the provided Android SDK: Node build/test/lint/
  static checks passed, but eight Android/Wear commands were blocked by the
  read-only environment when Gradle attempted to create its wrapper lock file
  under `/home/felipe/.gradle`; this is an environment limitation, not a
  product finding.
- Deterministic synthetic failure harness reproduced B1; deterministic invalid
  ID harness reproduced B2. No real health data, provider credentials, network,
  or external APIs were used.

## Required next action

Return DEV-007 to implementation for B1 and B2 remediation, add the missing
adversarial tests, rerun the full writable validation suite, and request a fresh
independent review against the exact remediated head. Keep the task
`INTEGRATED`, keep TD-001 `OPEN`, and do not prepare the human gate yet.
