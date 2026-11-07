---
id: DEV-008
type: development
title: Implement claim-token lifecycle
status: IMPLEMENTED
source: [PD-001, PD-002]
depends_on: [DEV-002, DEV-003, DEV-004, DEV-007]
parallel_class: SERIAL
assigned_agent: developer-dev-008
branch: agent/dev-008-claim-token-lifecycle
worktree: /home/felipe/projetos/meds-up-worktrees/dev-008-claim-token-lifecycle
started_at: 2026-11-07T15:00:57Z
updated_at: 2026-11-07T15:06:10Z
completed_at: 2026-11-07T15:06:10Z
implementation_commit: db84d511605ada98976a528743cccef89477d2c8
handoff: .ai/development/handoffs/DEV-008-developer-handoff.md
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

# Implementation Result

- Added a provider-neutral claim-token service and atomic in-memory repository
  using 256-bit cryptographically random base64url secrets, SHA-256 digest-only
  persistence, exact seven-day expiry, owner-authorized issuance/revocation/
  replacement, patient-role consumption, and content-free failures.
- Added atomic consume-and-audit transitions, replay/concurrency protection,
  per-patient failed-attempt rate limiting, rollback/retry behavior, and
  owner-scoped control projections that never expose a digest or raw secret.
- Added focused tests for expiry boundaries, revoke/replace, replay/races,
  rollback/retry, rate-limit boundaries/isolation, ownership isolation,
  digest-only persistence, and raw-secret leakage. Full npm, Make, Android/Wear,
  and repository validation passed.
- TD-001 remains `OPEN`; this is provider-neutral in-memory code with synthetic
  identities/data only and no real adapter, credential, network, production
  persistence, deployment, provider, region, or health-data path.

See `.ai/development/handoffs/DEV-008-developer-handoff.md` for exact files,
validation evidence, limitations, and integration constraints.
