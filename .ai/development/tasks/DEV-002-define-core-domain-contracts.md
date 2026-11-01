---
id: DEV-002
type: development
title: Define core prescription and API contracts
status: READY
source: [PD-001, PD-008]
depends_on: [DEV-001]
parallel_class: PARALLEL_CONDITIONAL
parallel_notes:
  - Stabilizes shared contracts used by backend and clients.
assigned_agent: null
branch: null
worktree: null
updated_at: 2026-11-01T20:15:17Z
---

# Objective
Define contract-first models and API conventions for ephemeral document processing, session-only extraction proposals, confirmed prescriptions, immutable versions, prescription status, ownership, and audit references.

# Scope
Specify identifiers, timestamps, version fields, error envelopes, idempotency conventions, state transitions, and contract compatibility rules. Keep document input and unconfirmed proposals outside persistent domain and recovery contracts. Exclude scheduling semantics, which are defined by DEV-011 from PD-003.

# Out of Scope
Persistence implementation, OCR provider integration, client UI, and reminder-response history transport.

# Acceptance Criteria
- Ephemeral document input, session-only proposal, confirmed version, and non-clinical audit concepts are distinct.
- Contracts provide no retrieval or recovery path for source documents, raw OCR/AI responses, or unconfirmed proposals.
- Clinical content cannot be represented as confirmed without explicit doctor confirmation.
- Contracts support suspension, cancellation, and version retrieval.
- Contracts contain no backend field for private reminder-response history.

# Validation
Schema validation plus contract serialization and compatibility tests.

# Dependencies
DEV-001.
