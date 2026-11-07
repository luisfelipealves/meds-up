---
id: DEV-008
type: development
title: Implement claim-token lifecycle
status: IMPLEMENTED
source: [PD-001, PD-002]
depends_on: [DEV-002, DEV-003, DEV-004, DEV-007]
parallel_class: SERIAL
assigned_agent: developer-dev-008
branch: agent/integration-dev-008
worktree: /home/felipe/projetos/meds-up-worktrees/integration-dev-008
started_at: 2026-11-07T15:00:57Z
updated_at: 2026-11-07T15:16:09Z
completed_at: 2026-11-07T15:06:10Z
implementation_commit: db84d511605ada98976a528743cccef89477d2c8
handoff: .ai/development/handoffs/DEV-008-developer-handoff.md
integration_branch: agent/integration-dev-008
integration_commits: [801131e, 770216f]
integration_handoff: .ai/development/integration/DEV-008-integration-handoff.md
review: .ai/reviews/DEV-008-independent-review.md
review_status: CHANGES_REQUIRED
review_blocking_findings: 1
review_non_blocking_findings: 1
remediation_metadata: .ai/development/handoffs/DEV-008-review-remediation.md
remediation_status: B1_REMEDIATED
remediated_at: 2026-11-07T15:16:09Z
remediation_commit: 25ccea1c27c8ac04a203318cd33cc1bf0176bee5
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
