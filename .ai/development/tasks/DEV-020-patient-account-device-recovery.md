---
id: DEV-020
type: development
title: Implement patient account and device recovery
status: BLOCKED
source: [PD-001]
depends_on: [DEV-003]
parallel_class: SERIAL
blocked_by: PA-004
assigned_agent: null
branch: null
worktree: null
---

# Objective
Implement patient account recovery and lost/stolen-device response.

# Product Ambiguity
PA-004 is unresolved: recovery proof, session/device revocation, and treatment or restoration of device-local reminder history are undefined.

# Scope
After resolution: recovery verification, session/device controls, safe re-enrollment, and clear treatment of local-only history.

# Out of Scope
Inventing recovery proof or uploading local reminder history.

# Acceptance Criteria
- Recovery follows approved identity-proof rules.
- Lost/stolen devices can be handled according to approved revocation behavior.
- Local history is never silently uploaded or represented as restored when unavailable.

# Validation
Threat-model-based recovery, revocation, replay, privacy, and multi-device tests.

# Dependencies
DEV-003 plus an approved resolution of PA-004.
