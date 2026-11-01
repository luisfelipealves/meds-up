---
id: DEV-021
type: development
title: Implement incorrect-claim recovery
status: PLANNED
source: [PD-001, PD-005, PD-006]
depends_on: [DEV-008, DEV-010, DEV-015]
parallel_class: SERIAL
assigned_agent: null
branch: null
worktree: null
---

# Objective
Implement an auditable recovery path for a prescription claimed by the wrong patient.

# Scope
Patient report and auditable case creation; confirmation by the issuing doctor, with pilot administration only when that doctor is unavailable; immediate revocation of the wrong association and future synchronization/reminders; neutral patient communication; and issue of a new single-use, seven-day QR with a new token for the correct patient.

# Out of Scope
Patient-initiated unilateral disassociation, silent reassignment, migration of local reminder history, or guaranteed remote deletion from an offline device.

# Acceptance Criteria
- Only the issuing doctor, or pilot administration when the doctor is unavailable, confirms recovery.
- Revocation stops future access, synchronization, and reminders for the wrong association.
- Reissue uses a new token and exposes no correct-patient data to the wrong account.
- Reporting, confirmation, revocation, reissue, and new redemption are auditable; local history is not migrated.

# Validation
Authorization, audit, race, disclosure, reissue, and device-reconciliation tests.

# Dependencies
DEV-008, DEV-010, and DEV-015.
