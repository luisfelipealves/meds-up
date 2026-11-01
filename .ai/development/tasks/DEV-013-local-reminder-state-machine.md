---
id: DEV-013
type: development
title: Implement local reminder response state machine
status: PLANNED
source: [PD-001, PD-003, PD-005]
depends_on: [DEV-012]
parallel_class: PARALLEL_SAFE
assigned_agent: null
branch: null
worktree: null
---

# Objective
Implement device-local reminder instances and explicit patient response transitions.

# Scope
Initial `SEM_CONFIRMACAO` state, explicit transitions to `TOMADA`, `ADIADA`, or `DISPENSADA`, 10/30/60-minute local notification deferral for `ADIADA`, immutable/local history, and application-layer protections against backend sync or telemetry. Deferral does not move future reminders or mark the dose as taken.

# Out of Scope
Doctor visibility, adherence inference, dose advice, or changing the clinical schedule through `ADIADA`.

# Acceptance Criteria
- Every reminder starts as `SEM_CONFIRMACAO`.
- No state changes without explicit patient action.
- Unanswered notifications remain `SEM_CONFIRMACAO`.
- `ADIADA` accepts only 10, 30, or 60 minutes and does not change future reminders or the clinical dose state.
- Response history remains device-local and cannot enter backend payloads or doctor views.

# Validation
State-machine, persistence, process-restart, privacy-boundary, and telemetry tests.

# Dependencies
DEV-012.
