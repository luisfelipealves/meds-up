---
id: DEV-007
type: development
title: Confirm and version prescriptions
status: PLANNED
source: [PD-001, PD-008]
depends_on: [DEV-002, DEV-004, DEV-006]
parallel_class: SERIAL
assigned_agent: null
branch: null
worktree: null
---

# Objective
Implement doctor correction and explicit confirmation of session-bound extraction
proposals as immutable, auditable prescription versions.

# Scope
Validation, explicit confirmation command, version creation, actor/timestamp audit, clinical-change versioning, and suspension/cancellation state transitions.

The unconfirmed proposal must not be persisted; confirmation persists only the
confirmed prescription version, never source-document or raw-OCR content.

# Out of Scope
Doctor PWA screens, claim QR generation, schedule-alternative semantics, and patient-local response history.

# Acceptance Criteria
- No unconfirmed proposal can become a reminder source.
- Confirmed content is immutable; changes create a new audit-linked version.
- Only the owning doctor may confirm, change, suspend, or cancel.
- Suspension/cancellation is represented for downstream sync.

# Validation
Domain and integration tests for confirmation gates, concurrent updates, version history, ownership, and status transitions.

# Dependencies
DEV-002, DEV-004, and DEV-006.
