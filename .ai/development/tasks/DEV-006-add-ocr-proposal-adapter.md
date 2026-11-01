---
id: DEV-006
type: development
title: Add OCR extraction proposal adapter
status: PLANNED
source: [PD-001]
depends_on: [DEV-005]
parallel_class: PARALLEL_SAFE
assigned_agent: null
branch: null
worktree: null
---

# Objective
Produce untrusted structured extraction proposals from source documents through a replaceable OCR/AI adapter.

# Scope
Adapter contract, deterministic fake, processing status, provenance/confidence metadata, failure handling, and proposal persistence linked to the source document.

# Out of Scope
Automatic clinical confirmation, vendor selection, schedule interpretation beyond approved contracts, and reminder generation.

# Acceptance Criteria
- OCR output is always marked as a proposal and cannot directly create reminders.
- Source, proposal, and processing errors are traceable.
- Provider failures are retry-safe and do not mutate confirmed clinical data.

# Validation
Adapter contract tests, deterministic fixture tests, retry/failure tests, and proof that proposals cannot enter confirmed state.

# Dependencies
DEV-005.
