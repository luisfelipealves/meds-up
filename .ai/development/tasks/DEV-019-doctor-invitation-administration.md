---
id: DEV-019
type: development
title: Implement doctor invitation administration
status: BLOCKED
source: [PD-001]
depends_on: [DEV-003]
parallel_class: SERIAL
blocked_by: PA-003
assigned_agent: null
branch: null
worktree: null
---

# Objective
Implement individual, single-use, expiring doctor invitations and their administration flow.

# Product Ambiguity
PA-003 is unresolved: invitation issuer, expiry duration, replacement invalidation, and pilot administration flow are undefined.

# Scope
After resolution: secure issue/redeem/revoke/replace lifecycle, rate limiting, auditing, and administrative access control.

# Out of Scope
Professional verification after the invitation pilot.

# Acceptance Criteria
- Invitations are individual, single-use, expiring, securely stored, and audited.
- Only the approved issuer can administer them.
- Reuse, expiry, revocation, and replacement follow approved rules.

# Validation
Lifecycle, race, authorization, rate-limit, leakage, and audit tests.

# Dependencies
DEV-003 plus an approved resolution of PA-003.
