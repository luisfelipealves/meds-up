---
id: DEV-013
type: development
title: Implement local reminder response state machine
status: PLANNED
source: [PD-001]
depends_on: [DEV-012]
parallel_class: PARALLEL_SAFE
assigned_agent: null
branch: null
worktree: null
---

# Objective
Implement device-local reminder instances and explicit patient response transitions.

# Scope
Initial `SEM_CONFIRMACAO` state, explicit transitions to `TOMADA`, `ADIADA`, or `DISPENSADA`, immutable/local history, and application-layer protections against backend sync or telemetry.

# Out of Scope
Defining the unresolved scheduling effect of `ADIADA`, doctor visibility, adherence inference, or dose advice.

# Acceptance Criteria
- Every reminder starts as `SEM_CONFIRMACAO`.
- No state changes without explicit patient action.
- Unanswered notifications remain `SEM_CONFIRMACAO`.
- Response history remains device-local and cannot enter backend payloads or doctor views.

# Validation
State-machine, persistence, process-restart, privacy-boundary, and telemetry tests.

# Dependencies
DEV-012.
