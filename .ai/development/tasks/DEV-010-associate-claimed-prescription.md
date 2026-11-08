---
id: DEV-010
type: development
title: Associate claimed prescription to patient
status: ASSIGNED
source: [PD-001, PD-002]
depends_on: [DEV-003, DEV-008, DEV-009]
parallel_class: SERIAL
assigned_agent: developer-dev-010
branch: agent/dev-010-associate-claimed-prescription
worktree: /home/felipe/projetos/meds-up-worktrees/dev-010-associate-claimed-prescription
started_at: 2026-11-08T11:45:02Z
updated_at: 2026-11-08T11:45:02Z
---

# Objective
Implement the transaction that associates a confirmed prescription with a new or existing patient after successful identity confirmation.

# Scope
New-account continuation, existing-account association, atomic token consumption, durable doctor-patient prescription linkage, idempotent outcomes, and audit events.

# Out of Scope
Incorrect-claim recovery, schedule selection, and local reminder history.

# Acceptance Criteria
- Successful claim creates exactly one association and consumes the token.
- A patient can accumulate prescriptions from multiple doctors.
- Failed or repeated attempts do not duplicate associations or expose clinical data.

# Validation
Integration tests for new/existing patients, concurrent claims, retries, rollback, expiry/revocation, and multi-doctor associations.

# Dependencies
DEV-003, DEV-008, and DEV-009.
