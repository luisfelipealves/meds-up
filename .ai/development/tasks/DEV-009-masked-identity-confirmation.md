---
id: DEV-009
type: development
title: Implement masked pre-claim identity confirmation
status: BLOCKED
source: [PD-001]
depends_on: [DEV-008]
parallel_class: SERIAL
blocked_by: PA-001
assigned_agent: null
branch: null
worktree: null
---

# Objective
Implement the identity projection and confirmation step shown to a patient before claim completion.

# Scope
Expose only approved masked attributes after valid-token lookup, render confirmation, handle mismatch, and audit the outcome without enabling enumeration.

# Out of Scope
Selecting which identity attributes or masking/mismatch rules should apply.

# Product Ambiguity
PA-001 is unresolved: the displayed attributes, masking rules, mismatch behavior, and correction path are not defined. Development must not invent them.

# Acceptance Criteria
- The resolved product rules are implemented exactly.
- Invalid tokens disclose no identity information.
- Responses and telemetry minimize identity leakage and enumeration risk.

# Validation
Contract, authorization, enumeration, masking, mismatch, and UX tests based on the approved resolution.

# Dependencies
DEV-008 plus an approved resolution of PA-001.
