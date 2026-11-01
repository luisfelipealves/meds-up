---
id: DEV-015
type: development
title: Synchronize versions and prescription status
status: PLANNED
source: [PD-001]
depends_on: [DEV-007, DEV-012, DEV-014]
parallel_class: SERIAL
assigned_agent: null
branch: null
worktree: null
---

# Objective
Synchronize confirmed prescription versions and status changes to Android while preserving local history and preventing stale reminders.

# Scope
Version cursor/protocol, idempotent updates, frequency-change schedule invalidation, suspension/cancellation propagation, future-reminder removal, and clear patient notification of doctor-originated change.

# Out of Scope
Syncing local reminder responses, incorrect-claim recovery, and new schedule semantics.

# Acceptance Criteria
- Suspension/cancellation promptly removes future reminders once received.
- Local response history is preserved and never uploaded.
- Frequency changes invalidate old schedules until patient confirmation.
- Stale clients cannot recreate invalidated future reminders after reconciliation.

# Validation
Contract and integration tests for retries, out-of-order versions, offline gaps, cancellation, history preservation, and stale-client reconciliation.

# Dependencies
DEV-007, DEV-012, and DEV-014.
