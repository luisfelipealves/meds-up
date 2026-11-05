---
id: DEV-005
type: development
title: Implement ephemeral source-document processing gateway
status: IMPLEMENTED
source: [PD-001, PD-008]
depends_on: [DEV-002, DEV-004]
parallel_class: PARALLEL_SAFE
assigned_agent: developer-dev-005
branch: agent/dev-005-ephemeral-ingestion
worktree: /home/felipe/projetos/meds-up-worktrees/dev-005-ephemeral-ingestion
started_at: 2026-11-05T09:47:39Z
updated_at: 2026-11-05T09:53:41Z
implemented_at: 2026-11-05T09:53:41Z
commit: 1dc6fbf835c1667b982d5bd55b94cb915ffc1d74
handoff: .ai/development/handoffs/DEV-005-developer-handoff.md
architecture_gate: .ai/development/decisions/TD-001-production-health-data-processing-gate.md
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
