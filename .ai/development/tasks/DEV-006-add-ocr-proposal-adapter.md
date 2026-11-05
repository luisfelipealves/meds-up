---
id: DEV-006
type: development
title: Add OCR extraction proposal adapter
status: INTEGRATED
source: [PD-001, PD-008]
depends_on: [DEV-005]
parallel_class: PARALLEL_SAFE
assigned_agent: developer-dev-006
branch: agent/dev-006-ocr-proposal-adapter
worktree: /home/felipe/projetos/meds-up-worktrees/dev-006-ocr-proposal-adapter
started_at: 2026-11-05T13:05:08Z
updated_at: 2026-11-05T13:24:37Z
implemented_at: 2026-11-05T13:14:18Z
commit: 8f6d2d1746f6b4d58e756bfbcb59685f94b3d982
handoff: .ai/development/handoffs/DEV-006-developer-handoff.md
integration_branch: agent/integration-dev-006
integration_worktree: /home/felipe/projetos/meds-up-worktrees/integration-dev-006
integrated_at: 2026-11-05T13:16:54Z
integration_commit: c20449a9f3e5b6ea995a50494cf3e8fdd5700dc0
integration_handoff: .ai/development/integration/DEV-006-integration-handoff.md
review: .ai/reviews/DEV-006-independent-review.md
reviewed_commit: dd056babcb0425e2d134d7d60fd7882b7a9a0a29
review_status: CHANGES_REQUIRED
review_blocking_findings: 1
remediation_commit: c20449a9f3e5b6ea995a50494cf3e8fdd5700dc0
remediated_at: 2026-11-05T13:24:37Z
---

# Objective
Produce session-bound, untrusted structured extraction proposals from ephemeral
source-document processing through a replaceable OCR/AI adapter.

# Scope
Adapter contract, deterministic fake, session-bound processing state,
session-only provenance/confidence metadata, failure handling, immediate
raw-response discard, non-persistent proposal delivery to doctor review, and
provider controls that disable retention and training on MedsUp inputs/outputs.

# Out of Scope
Automatic clinical confirmation, vendor selection, schedule interpretation beyond approved contracts, and reminder generation.

# Acceptance Criteria
- OCR output is always marked as a proposal and cannot directly create reminders.
- Source and raw OCR output are never durable; only minimal non-clinical
  processing evidence is traceable.
- Provider failures are retry-safe and do not mutate confirmed clinical data.
- Proposal ends with session expiry, abandonment, or reload and cannot be
  recovered.
- The provider adapter cannot be enabled without explicit retention/training
  controls compatible with PD-008.

# Validation
Adapter contract tests, deterministic fixture tests, retry/failure/expiry tests,
persistence scans, and proof that proposals cannot enter confirmed state.

# Dependencies
DEV-005.

# Intake and Implementation Plan

- PD-001 and PD-008 are `APPROVED_FOR_DEVELOPMENT`; DEV-005 is `DONE`, so the
  declared dependency is satisfied.
- Add a provider-neutral proposal adapter and deterministic local fake behind
  the existing isolated ingestion boundary. Extend only the existing
  `UntrustedPrescriptionProposal` contract as needed for closed, session-only
  provenance and confidence metadata.
- Keep proposal state inside one in-memory review-session lifecycle. Explicit
  expiry, abandonment, completion, or construction of a fresh lifecycle
  discards the proposal and provides no recovery path.
- Validate and copy only the structured proposal from the processor response,
  then erase the mutable raw-response bytes before the extraction call settles.
  Failures and expiry remain retry-safe and cannot mutate confirmed data.
- Add focused contract, deterministic fixture, failure, retry, expiry,
  abandonment/reload, raw-discard, no-confirmation, logging, and forbidden
  persistence/network/credential-path tests; run backend/contracts suites and
  the complete repository validator.

# Architecture Boundary

TD-001 remains `OPEN`. This task must not add a concrete OCR/AI provider,
provider credential, API/network call, provider selection, production ingress,
deployment or data path, real prescription document, or real health-data test.
The preference for Vercel, Supabase, or OpenAI is not architecture approval.
DEV-007 must not start as part of this task.

# Implementation Summary

Implemented a provider-neutral raw-extraction adapter and in-memory doctor
review-session lifecycle. Valid output is closed, contract-validated, always
`SESSION_ONLY_UNTRUSTED`, owner/session bound, and includes only session-scoped
provenance, bounded confidence, and structured clinical content. Mutable raw
response bytes are zeroed in `finally` before extraction settles. Provider
configuration requires exact `retentionDisabled: true` and
`trainingDisabled: true` controls.

Failure, invalid response, expiry during/after extraction, abandonment,
completion, reload, and cross-owner behavior discard or deny proposal access
without recovery. The surface has no confirmation/reminder method and no
persistence, credential, network, concrete provider, deployment, or production
ingress path. DEV-005 ingestion worker code and containment behavior are
unchanged. TD-001 remains `OPEN`; DEV-007 was not started.

# Validation Summary

- Focused OCR proposal suite: **9/9 passed**.
- Backend suite: **47/47 passed**; contracts suite: **14/14 passed**.
- Backend/contracts build, lint, and backend static check: **passed**.
- Full `scripts/validate.sh` with the repository Android SDK environment:
  **passed**, including Node, PWA, contracts, Android, and Wear checks.
- `git diff --check` and explicit provider/network/credential/persistence source
  guards: **passed**.

# Integration Summary

The developer branch was fast-forwarded from exact base `cddc9f8` onto
`agent/integration-dev-006`. Fresh integration validation passed the complete
Node, Android, and Wear validator, including backend **47/47**, contracts
**14/14**, and PWA **2/2**. The integrated diff remains provider-neutral and
local-only; no DEV-005 ingestion code, DEV-007 artifact, real provider,
credential, network call, persistence path, deployment, or real health data was
introduced. TD-001 remains `OPEN`.

Complete evidence and review cautions are recorded in
`.ai/development/integration/DEV-006-integration-handoff.md`. DEV-006 is ready
for independent review, not merge or push.

# Independent Review

Independent review of `dd056babcb0425e2d134d7d60fd7882b7a9a0a29`
returned one blocking finding: a never-settling injected extractor leaves the
operation pending beyond expiry or abandonment. DEV-006 is `BLOCKED` pending a
bounded, enforceably contained extraction lifecycle, a never-settling regression
test, fresh validation, and independent re-review. TD-001 remains `OPEN`; no
merge or push is authorized.

# Review Remediation

Commit `c20449a9f3e5b6ea995a50494cf3e8fdd5700dc0` moves each local
extraction into a dedicated worker, requires a bounded `AbortSignal`, and on
expiry or abandonment requests cooperative abort, terminates and awaits the
worker, discards any transferred raw bytes, and only then settles the caller.
Never-settling expiry and abandonment tests prove worker activity cannot
continue after settlement and no proposal can be recovered.

Fresh validation passed: focused OCR proposal **11/11**, backend **49/49**,
contracts **14/14**, PWA **2/2**, all Node build/lint/static checks, and all
Android/Wear assemble, unit-test, lint, and check tasks in
`./scripts/validate.sh`. DEV-006 is `INTEGRATED` pending independent re-review.
TD-001 remains `OPEN`; no provider, credential, network call, real document,
deployment, merge, push, or DEV-007 work was introduced.
