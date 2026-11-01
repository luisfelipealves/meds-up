---
id: DEV-008
type: development
title: Implement claim-token lifecycle
status: PLANNED
source: [PD-001]
depends_on: [DEV-002, DEV-003, DEV-004, DEV-007]
parallel_class: SERIAL
assigned_agent: null
branch: null
worktree: null
---

# Objective
Implement cryptographically random, single-use prescription claim tokens with seven-day expiry, revocation, replacement, and atomic consumption.

# Scope
Secure generation, digest-only storage, QR-safe opaque payload, expiry, revocation/replacement, attempt auditing, rate limiting, and replay-safe transaction boundaries.

# Out of Scope
Masked identity contents, patient claim UI, incorrect-claim recovery, and clinical data in the QR.

# Acceptance Criteria
- QR payload contains only an opaque random token.
- Raw tokens are absent from persistence, logs, telemetry, and URLs beyond the intended delivery path.
- Expired, revoked, replaced, or consumed tokens cannot claim.
- Concurrent attempts result in at most one successful claim.

# Validation
Randomness/configuration checks and integration tests for expiry, revocation, replacement, replay, races, rate limits, and leakage.

# Dependencies
DEV-002, DEV-003, DEV-004, and DEV-007.
