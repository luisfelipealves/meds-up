---
id: DEV-003
type: development
title: Implement identity, sessions, and role foundation
status: PLANNED
source: [PD-001, PD-005]
depends_on: [DEV-001]
parallel_class: PARALLEL_SAFE
assigned_agent: null
branch: null
worktree: null
---

# Objective
Implement replaceable identity and session foundations for doctor and patient accounts.

# Scope
Role model, authenticated subject abstraction, session lifecycle primitives, secure credential/provider adapter, test identities, and technical hooks for revoking all sessions/devices as required by PD-005. The patient-facing recovery flow remains in DEV-020.

# Out of Scope
Doctor invitation operating policy, account recovery behavior, prescription authorization, and UI.

# Acceptance Criteria
- Doctor and patient roles are explicit and cannot be interchanged.
- Session and authentication failures use the common error model.
- Sensitive values are excluded from logs.
- Provider-specific code is isolated behind an adapter.

# Validation
Unit and integration tests for authentication, authorization context, session expiry, and log redaction.

# Dependencies
DEV-001.
