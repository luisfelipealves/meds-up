---
id: DEV-005
type: development
title: Implement ephemeral source-document processing gateway
status: INTEGRATED
source: [PD-001, PD-008]
depends_on: [DEV-002, DEV-004]
parallel_class: PARALLEL_SAFE
assigned_agent: developer-dev-005
branch: agent/dev-005-ephemeral-ingestion
worktree: /home/felipe/projetos/meds-up-worktrees/dev-005-ephemeral-ingestion
started_at: 2026-11-05T09:47:39Z
updated_at: 2026-11-05T12:00:56Z
implemented_at: 2026-11-05T09:53:41Z
commit: 1dc6fbf835c1667b982d5bd55b94cb915ffc1d74
handoff: .ai/development/handoffs/DEV-005-developer-handoff.md
architecture_gate: .ai/development/decisions/TD-001-production-health-data-processing-gate.md
integration_branch: agent/integration-dev-005
integration_worktree: /home/felipe/projetos/meds-up-worktrees/integration-dev-005
integrated_at: 2026-11-05T09:57:28Z
integration_commit: 52e55a74e4d7150ea39a3a235b700a049b6b7819
integration_handoff: .ai/development/integration/DEV-005-integration-handoff.md
review: .ai/reviews/DEV-005-independent-review.md
reviewed_commit: 17741f5eb3a3a42172187c90991544e6faff56b3
review_status: CHANGES_REQUIRED
review_blocking_findings: 3
remediation_commit: f06c4b42eec53bba7224b0cb87307b9b81240afe
remediated_at: 2026-11-05T10:08:51Z
independent_rereview: .ai/reviews/DEV-005-independent-rereview.md
rereviewed_commit: 5300bc59fc93762165d461553d57953e28241c02
rereview_status: CHANGES_REQUIRED
rereview_blocking_findings: 2
second_remediation_commit: 94d031d7910825d020a14aee9906b9553f0481f1
second_remediated_at: 2026-11-05T12:00:56Z
---

# Objective
Implement an authenticated, ephemeral processing gateway for prescription PDFs,
digital files, photographs, and scans; it must not retain source documents.

# Scope
Authenticated session-bound submission, ownership linkage, MIME/signature
validation, size/page limits, isolated API handoff, in-transit protection,
immediate discard, and non-clinical audit events.

# Out of Scope
OCR extraction, doctor review UI, durable document storage, retention of source
documents, and production AI-provider selection.

# Acceptance Criteria
- Unsupported, oversized, malformed, and unauthorized uploads are rejected.
- No source document is written to durable storage, backups, queues, or public
  URLs.
- Document contents and processing references do not leak into logs or public
  URLs.
- Completion, failure, or expiry of the OCR/AI request discards the source input; it never remains for the doctor-review session.

# Validation
Ephemeral-processing integration tests, malicious/mismatched file tests,
authorization tests, expiry/discard tests, persistence scans, and log inspection.

# Dependencies
DEV-002 and DEV-004.

# Implementation Summary

Implemented a dependency-free, provider-neutral in-process gateway for trusted
doctor submissions bound to active owned review sessions. It validates
allow-listed PDF/JPEG/PNG signatures and declared MIME types before handoff,
enforces conservative byte/page/pixel limits, copies source bytes into a
private working buffer, aborts timed-out processing, and zeroes that buffer on
completion, failure, or timeout. Errors and audit events are content-free and
allow-listed. Deterministic test fakes cover handoff and discard behavior.

No HTTP endpoint, network call, real processor/provider, OCR result, proposal,
clinical persistence, durable document path, deployment, production secret, or
real-health-data capability was added. TD-001 remains `OPEN` and blocks any
real provider or production health-data operation. DEV-006 remains `PLANNED`
and was not started.

# Validation Summary

- Focused ephemeral-ingestion suite: **10/10 passed**.
- Complete backend suite: **34/34 passed**.
- Complete contracts suite: **13/13 passed**; PWA suite: **2/2 passed**.
- Full `./scripts/validate.sh`: **passed** Node build/test/lint/static checks and
  Android/Wear assemble, unit-test, lint, and check commands.
- `git diff --check` and explicit forbidden persistence/network-path scan:
  **passed**.

Detailed TDD evidence, files, integration cautions, and validation commands are
recorded in `.ai/development/handoffs/DEV-005-developer-handoff.md`.

# Integration Summary

The exact implementation and developer-handoff commits were fast-forwarded
onto `agent/integration-dev-005` from base `3565d40`. Independent integration
validation passed the focused 10-test ingestion suite, the complete 34-test
backend suite, backend lint/static checks, and the full repository validation
including Node workspaces plus Android and Wear OS builds, tests, lint, and
checks. The inspected diff adds no real network/provider/deployment/credential
or durable source-document path and changes neither DEV-006 nor `.ai/backups`.

TD-001 remains `OPEN`; integration does not approve architecture, merge,
deployment, production operation, or processing of real health data. Complete
evidence and remaining boundaries are recorded in
`.ai/development/integration/DEV-005-integration-handoff.md`.

# Independent Review

Independent review of `17741f5eb3a3a42172187c90991544e6faff56b3`
returned three blocking findings: timeout can return before processor
settlement, injected authorization errors can expose sensitive messages, and
PNG validation accepts materially malformed structure. DEV-005 is `BLOCKED`
pending focused remediation and independent re-review. TD-001 remains `OPEN`;
DEV-006 remains `PLANNED`.

# Review Remediation

Commit `f06c4b42eec53bba7224b0cb87307b9b81240afe` waits for processor
settlement after timeout-triggered abort before reporting discard, normalizes
all authorization failures to fixed content-free errors, and validates PNG
chunk bounds, CRCs, required ordering/data, and image metadata. Adversarial
tests cover delayed abort settlement, sensitive authorization messages, invalid
PNG CRCs, missing image data, and trailing bytes. The focused suite passed
12/12, the backend suite passed 36/36, and the complete Node/Android/Wear
validator passed. DEV-005 is `INTEGRATED` pending independent re-review; no
approval is claimed and TD-001 remains `OPEN`.

## Independent Re-review and Second Remediation

Independent re-review of `5300bc59fc93762165d461553d57953e28241c02`
left two blockers: an abort-ignoring in-process processor could hang forever,
and PNG validation did not inflate IDAT or reconcile decoded scanline length
with IHDR. Commit `94d031d7910825d020a14aee9906b9553f0481f1`
remediates both within the local provider-neutral boundary.

Processors now run in a dedicated `Worker` isolation boundary. The private
source copy is transferred into that worker, timeout first requests cooperative
abort, and the gateway then terminates and awaits worker exit before it records
discard or settles the submission. Tests cover ignored abort with continuing
activity, completion after abort, and failure after abort; all three remain
timeouts and discard is recorded only after containment. PNG validation now
supports non-interlaced IHDR metadata, inflates the concatenated IDAT stream
under an expected-length bound, requires the exact decoded scanline length and
valid per-row filter bytes, and rejects a CRC-valid stream with insufficient
decoded bytes. The positive fixture now deflates the complete 1x1 RGB scanline.

Fresh validation passed: focused ingestion **14/14**; backend build and tests
**38/38**; backend lint and static check; and full `./scripts/validate.sh`,
including backend **38/38**, PWA **2/2**, contracts **13/13**, all Node
build/lint/static checks, and Android/Wear assemble, unit-test, lint, and check
commands. `git diff --check` and the implementation scan for network,
persistence, URL, queue/cache/storage, and credential paths passed. The review
artifact was not modified. DEV-005 remains `INTEGRATED` pending independent
re-review; TD-001 remains `OPEN`, DEV-006 remains `PLANNED`, and no provider,
region, network, key, deployment, production, or real-health-data path was
selected or activated.
