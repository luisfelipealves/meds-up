---
id: DEV-012
type: development
title: Build Android local prescription store and agenda
status: PLANNED
source: [PD-001, PD-003, PD-005]
depends_on: [DEV-001, DEV-010, DEV-011]
parallel_class: PARALLEL_CONDITIONAL
parallel_notes:
  - Uses stabilized API and schedule contracts.
assigned_agent: null
branch: null
worktree: null
---

# Objective
Build the Android local data model and consolidated agenda for active prescriptions from multiple doctors.

# Scope
Encrypted local persistence, prescription/version cache, confirmed schedule storage, sync cursors, agenda queries, temporary offline availability, and a clean bootstrap path that can receive only active prescriptions and approved schedules on a new device.

# Out of Scope
Reminder response transitions, notification scheduling, account recovery, and Wear OS.

# Acceptance Criteria
- Active prescriptions from multiple doctors appear in one agenda.
- Clinical fields are read-only on the patient device.
- Previously synchronized schedules remain available temporarily offline.
- Data model supports version invalidation, suspension, and cancellation.

# Validation
Database migration, repository, multi-doctor agenda, offline-read, and clinical-read-only tests.

# Dependencies
DEV-001, DEV-010, and DEV-011.
