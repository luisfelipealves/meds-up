---
id: DEV-006
type: development
title: Add OCR extraction proposal adapter
status: PLANNED
source: [PD-001, PD-008]
depends_on: [DEV-005]
parallel_class: PARALLEL_SAFE
assigned_agent: null
branch: null
worktree: null
---

# Objective
Produce session-bound, untrusted structured extraction proposals from ephemeral
source-document processing through a replaceable OCR/AI adapter.

# Scope
Adapter contract, deterministic fake, session-bound processing state,
provenance/confidence metadata, failure handling, immediate raw-response
discard, and non-persistent proposal delivery to doctor review.

# Out of Scope
Automatic clinical confirmation, vendor selection, schedule interpretation beyond approved contracts, and reminder generation.

# Acceptance Criteria
- OCR output is always marked as a proposal and cannot directly create reminders.
- Source and raw OCR output are never durable; only minimal non-clinical
  processing evidence is traceable.
- Provider failures are retry-safe and do not mutate confirmed clinical data.
- Proposal ends with session expiry, abandonment, or reload and cannot be
  recovered.

# Validation
Adapter contract tests, deterministic fixture tests, retry/failure/expiry tests,
persistence scans, and proof that proposals cannot enter confirmed state.

# Dependencies
DEV-005.
