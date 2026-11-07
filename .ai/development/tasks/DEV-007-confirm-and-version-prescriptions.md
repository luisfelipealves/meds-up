---
id: DEV-007
type: development
title: Confirm and version prescriptions
status: IMPLEMENTED
source: [PD-001, PD-008]
depends_on: [DEV-002, DEV-004, DEV-006]
parallel_class: SERIAL
assigned_agent: developer-dev-007
branch: agent/dev-007-confirm-version-prescriptions
worktree: /home/felipe/projetos/meds-up-worktrees/dev-007-confirm-version-prescriptions
started_at: 2026-11-07T13:24:13Z
updated_at: 2026-11-07T13:33:27Z
completed_at: 2026-11-07T13:33:27Z
implementation_commit: 2e28ccc1f5f06fe965c340d6ebc9a590effec4cd
handoff: .ai/development/handoffs/DEV-007-developer-handoff.md
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

# Implementation Result

- Added trusted-doctor, active-review-session confirmation of corrected content
  into immutable prescription/version/audit records; unconfirmed proposal,
  source-document, raw OCR/AI, provenance, and confidence data have no
  persistence or recovery path.
- Added append-only clinical version changes, trusted actor/server timestamps,
  idempotency, optimistic concurrency, owner-scoped reads/mutations, and
  suspension/cancellation events for downstream synchronization.
- Added focused domain/integration and shared-contract/schema tests for all
  acceptance criteria. Complete Node, Make, Android/Wear, validation-script,
  and diff checks passed.
- TD-001 remains `OPEN`; implementation is provider-neutral and in-memory only,
  with no provider, credentials, network, deployment, production persistence,
  real document, or real health-data path.

See `.ai/development/handoffs/DEV-007-developer-handoff.md` for exact files,
validation, acceptance evidence, known issues, and integration constraints.
