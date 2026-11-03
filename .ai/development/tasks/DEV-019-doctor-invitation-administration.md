---
id: DEV-019
type: development
title: Implement doctor invitation administration
status: READY
source: [PD-001, PD-004]
depends_on: [DEV-003]
parallel_class: SERIAL
assigned_agent: null
branch: null
worktree: null
updated_at: 2026-11-03T15:50:44Z
---

# Objective
Implement individual, single-use, expiring doctor invitations and their administration flow.

# Scope
Allow active doctors to issue invitations bound to a professional email, with single use and seven-day expiry; redeem directly into an active account; atomically revoke older active invitations when reissuing to the same email; expose issuer-visible invitation state; and provide pilot-administration revocation and account suspension. Include rate limiting, auditing, and backend authorization.

# Out of Scope
Professional verification after the invitation pilot, public doctor signup, billing, and complex clinic/organization management.

# Acceptance Criteria
- Only active doctors issue invitations; redemption activates the invited account without further administrative approval.
- Invitations are bound to a professional email, single-use, valid for seven days, securely stored, and audited with the invitation chain.
- Reissue to the same email atomically revokes earlier active invitations.
- The issuer sees the state of invitations it created; invalid, expired, revoked, or used invitations fail neutrally without email/account enumeration.
- Suspended doctors cannot sign in, invite, import, create, or manage prescriptions.

# Validation
Lifecycle, race, authorization, rate-limit, leakage, and audit tests.

# Dependencies
DEV-003.
