---
id: DEV-011
type: development
title: Define and implement scheduling constraints
status: BLOCKED
source: [PD-001]
depends_on: [DEV-002]
parallel_class: SERIAL
blocked_by: PA-002
assigned_agent: null
branch: null
worktree: null
---

# Objective
Define and implement the clinical scheduling grammar, proposed schedules, permitted patient alternatives, and strict-interval validation.

# Scope
Frequency and duration representation, time windows, fixed/interval constraints, validation, frequency-change invalidation, and schedule confirmation rules.

# Out of Scope
Inventing clinical semantics, reminder notification delivery, and autonomous clinical recommendations.

# Product Ambiguity
PA-002 is unresolved: supported frequency forms, strict interval behavior, permitted windows/tolerance, duration rules, and the exact effect of `ADIADA` are not defined.

# Acceptance Criteria
- Every supported prescription form has deterministic scheduling behavior.
- Patient alternatives cannot violate clinical constraints.
- Frequency changes invalidate prior scheduling and require fresh confirmation.

# Validation
Table-driven domain tests for every approved frequency, boundary, invalid alternative, duration, and frequency change.

# Dependencies
DEV-002 plus an approved resolution of PA-002.
