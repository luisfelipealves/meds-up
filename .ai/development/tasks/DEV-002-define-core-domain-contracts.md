---
id: DEV-002
type: development
title: Define core prescription and API contracts
status: PLANNED
source: [PD-001]
depends_on: [DEV-001]
parallel_class: PARALLEL_CONDITIONAL
parallel_notes:
  - Stabilizes shared contracts used by backend and clients.
assigned_agent: null
branch: null
worktree: null
---

# Objective
Define contract-first models and API conventions for source documents, extraction proposals, confirmed prescriptions, immutable versions, prescription status, ownership, and audit references.

# Scope
Specify identifiers, timestamps, version fields, error envelopes, idempotency conventions, state transitions, and contract compatibility rules. Exclude unresolved scheduling semantics.

# Out of Scope
Persistence implementation, OCR provider integration, client UI, and reminder-response history transport.

# Acceptance Criteria
- Source document, proposal, confirmed version, and audit concepts are distinct.
- Clinical content cannot be represented as confirmed without explicit doctor confirmation.
- Contracts support suspension, cancellation, and version retrieval.
- Contracts contain no backend field for private reminder-response history.

# Validation
Schema validation plus contract serialization and compatibility tests.

# Dependencies
DEV-001.
