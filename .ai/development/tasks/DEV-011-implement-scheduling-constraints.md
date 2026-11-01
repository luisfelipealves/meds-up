---
id: DEV-011
type: development
title: Implement approved scheduling constraints
status: PLANNED
source: [PD-001, PD-003]
depends_on: [DEV-002]
parallel_class: SERIAL
assigned_agent: null
branch: null
worktree: null
---

# Objective
Implement the approved clinical scheduling grammar, proposed schedules, permitted patient alternatives, and strict-interval validation.

# Scope
Explicit times; strict intervals; start date; end date or continuous-treatment marker; doctor-controlled flexibility and minimum interval; deterministic rejection of ambiguous/conditional instructions; frequency-change invalidation; and schedule confirmation rules. `ADIADA` offers only 10, 30, or 60 minutes and does not alter the clinical schedule, future reminders, or dose state.

# Out of Scope
Reminder notification delivery, interpretation of ambiguous/conditional instructions, and autonomous clinical recommendations.

# Acceptance Criteria
- Every supported prescription form has deterministic scheduling behavior.
- Ambiguous or conditional instructions do not generate automatic reminders.
- Patient alternatives cannot violate clinical constraints.
- End-dated treatment produces no future reminders after its end date; continuous treatment requires an explicit marker.
- Frequency changes invalidate prior scheduling and require fresh confirmation.
- `ADIADA` is limited to 10, 30, or 60 minutes and leaves the clinical schedule and dose state unchanged.

# Validation
Table-driven domain tests for every approved frequency, boundary, invalid alternative, duration, and frequency change.

# Dependencies
DEV-002.
