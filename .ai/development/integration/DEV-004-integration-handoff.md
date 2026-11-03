---
task: DEV-004
status: BLOCKED
integration_branch: agent/integration-dev-004
integration_worktree: /home/felipe/projetos/meds-up-worktrees/integration-dev-004
base_commit: 58065b619d047a59c57e23679035c3de88d7b188
developer_branch: agent/dev-004-doctor-ownership
developer_head: 6320c9f65fc08659b036a153d51a79d2626bf36f
implementation_commit: 5d0adfe4bd980e3706a58d00ca409bd2ca053dd0
initial_integration_commit: 7f540c698e0a2ca1c8981519fd3741fb6b6d06a6
integration_commit: e10082da77acb3b853b9c00d6fbcbe54beb8e501
remediation_commit: 2a7c804d0e9ae3bd28411130df4416f910363a49
metadata_validation_commit: e10082da77acb3b853b9c00d6fbcbe54beb8e501
integrated_at: 2026-11-03T17:32:59Z
validation_status: PASSED
ready_for_review: true
---

# Integration handoff — DEV-004

## Integration

Verified the clean developer branch and its cited implementation and handoff commits, then merged `agent/dev-004-doctor-ownership` into the isolated `agent/integration-dev-004` branch. The merge completed without conflicts. No merge to `main`, push, independent review, deployment, or DEV-005 work occurred.

## Diff and acceptance findings

- The integrated service derives the owner only from the injected trusted authenticated-subject assertion and doctor role guard; request or mutation ownership fields are not authoritative.
- Direct reads and owner-atomic mutations cover active ephemeral review sessions, confirmed prescriptions, prescription versions, audit references, and claim controls. Cross-doctor and missing identifiers share the same content-free `NOT_FOUND` tuple.
- Lists are requested by authenticated owner and defensively filtered by `ownerDoctorId`; active review-session lists also exclude inactive sessions.
- The service exposes no patient-local reminder-history operation.
- Tests use two authenticated doctors and cover direct-ID isolation, list isolation, all covered resource reads and mutations, inactive sessions, ownership-transfer attempts, forged subjects, and patient-role rejection.

## PD-008 invariant

The implementation introduces one provider-neutral authorization service, its package export, and in-memory test doubles. It adds no upload/document field, raw OCR or AI output, unconfirmed proposal, persistence adapter, durable review-session store, recovery locator, logging path, or query API for ephemeral payloads. Active review-session repositories remain injected and the service consumes only authorization metadata. Uploaded documents, raw OCR/AI output, and unconfirmed proposals therefore remain ephemeral and non-queryable.

## Integrator validation

- `npm ci` — passed; 13 packages audited, 0 vulnerabilities.
- `node --test test/doctor-ownership.test.mjs` from `apps/backend` — passed 5/5.
- `npm test -w @medsup/backend` — passed 22/22.
- `node --check src/authorization/doctor-ownership.mjs && node --check test/doctor-ownership.test.mjs` — passed.
- `ANDROID_HOME=/home/felipe/.hermes/cache/scratch/android-sdk ANDROID_SDK_ROOT=/home/felipe/.hermes/cache/scratch/android-sdk ./scripts/validate.sh` — passed all Node workspace build/test/lint/static checks and Android/Wear assemble, unit-test, lint, and check commands. Node totals: backend 22/22, PWA 2/2, contracts 13/13.
- `git diff --check 58065b619d047a59c57e23679035c3de88d7b188..7f540c698e0a2ca1c8981519fd3741fb6b6d06a6` — passed.

The first focused test attempt before dependency installation failed with `ERR_MODULE_NOT_FOUND` for the workspace package `@medsup/contracts`; this was an integration-worktree prerequisite issue, not a product defect. A clean `npm ci` resolved it, after which focused and full validation passed.

## Remediation evidence — independent review blockers B1–B3

Remediation commit `2a7c804d0e9ae3bd28411130df4416f910363a49`
addresses all three blocking findings from the first independent review.

- **B1:** Every injected repository now returns an explicit internal
  `{ record, authorization: { ownerDoctorId } }` projection. The projection is
  validated server-side for active review sessions, confirmed prescriptions,
  versions, audit references, and claim controls. Public version contracts
  continue to use `confirmedByDoctorId`; audit references remain minimal and
  do not gain invented public owner fields. Focused tests cover positive,
  cross-doctor, missing, list, and mutation behavior for contract-shaped
  version and audit records.
- **B2:** Mutations recursively strip authority-bearing fields before the
  repository boundary. Active-session content fields are stripped at the same
  boundary. The service now performs one atomic `mutateByOwner` call with an
  explicit `{ activeOnly }` policy and does not pre-read. An adversarial
  side-effecting repository test proves forged ownership cannot cross the
  boundary, cannot change the returned owner, and produces no side effect.
- **B3:** Active review-session direct reads, lists, and mutation results use
  the allow-listed metadata projection (`id`, `reviewSessionId`, `status`,
  lifecycle timestamps). Sentinel document, raw OCR, and unconfirmed proposal
  fields are absent from all returned values and are stripped from mutations.

Strict TDD evidence: the new envelope/projection and adversarial tests were
observed red against the prior service (B1 denied contract-shaped records; B2
forwarded forged mutation fields; B3 returned no enforced projection), then
passed after remediation. Current focused ownership, backend, contracts,
syntax, lint, static, Node build, and `git diff --check` validation pass.

Coordinator verification reran the focused ownership suite (6/6), complete
backend suite (23/23), contracts suite (13/13), syntax checks, and
`git diff --check`. It then ran the full repository validator with the
configured Android SDK; all Node/PWA/contracts checks and all eight Android and
Wear assemble, unit-test, lint, and check commands passed. The remediation is
therefore integrated and ready for independent re-review. No merge, push,
self-review, or DEV-005 work occurred.

## Known issues

Residual B4 is remediated by
`e10082da77acb3b853b9c00d6fbcbe54beb8e501`. The service validates retained
active-session identifiers, status, and optional timestamps as bounded scalar
metadata and fails closed with content-free `NOT_FOUND` across get, list, and
mutation results. Adversarial tests cover nested objects, arrays, invalid
scalars, and document/raw OCR/AI/unconfirmed-proposal sentinels. Recursive
mutation sanitization and the single atomic `mutateByOwner` call are unchanged;
no DEV-005 surface was added.

Coordinator verification passed the focused ownership suite (7/7), backend
suite (24/24), contracts suite (13/13), syntax checks, `git diff --check`, and
the complete repository validator, including all Node/PWA/contracts checks and
all eight Android/Wear assemble, unit-test, lint, and check commands. The task
is integrated and ready for another independent review; no approval is claimed.

## Review target

Independently review the complete diff from base `58065b619d047a59c57e23679035c3de88d7b188` through metadata-validation commit `e10082da77acb3b853b9c00d6fbcbe54beb8e501`, together with this integration record and both prior reviews. DEV-004 must not advance beyond `INTEGRATED` until re-review completes.
