---
id: DEV-010
type: development
title: Associate claimed prescription to patient
status: PLANNED
source: [PD-001]
depends_on: [DEV-003, DEV-008, DEV-009]
parallel_class: SERIAL
assigned_agent: null
branch: null
worktree: null
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
