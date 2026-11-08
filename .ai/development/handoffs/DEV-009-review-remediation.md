---
task: DEV-009
status: REVIEW
remediation: B1+B2+N1
branch: agent/dev-009-review-remediation
remediated_at: 2026-11-08T00:00:00Z
remediation_commit: beb43af76055d820d1e2aca8a0d7ed451d2c0428
independent_review: .ai/reviews/DEV-009-independent-review.md
architecture_gate: .ai/development/decisions/TD-001-production-health-data-processing-gate.md
---

# DEV-009 review remediation handoff

## B1 — stable contact-the-emitter outcome

Invalid token, DOB mismatch, rate-limit, lifecycle/provider failure, and
unexpected repository/audit failure paths now converge on
`CLAIM_IDENTITY_FAILED` with the canonical message
`Please contact your doctor or clinic.`. The code and message are defined in
the shared runtime contract and published schema, so `toErrorEnvelope` keeps
the same code, shape, message, and retryability at transport. The service no
longer rethrows arbitrary lifecycle `FoundationError` values, and audit write
failures are swallowed while the generic outcome is preserved; successful
operations fail generically if their audit commit is unavailable.

Focused evidence: the transport test compares serialized error tuples across
invalid token, mismatch, and rate-limit cases; the adversarial repository test
proves audit/repository `TypeError` does not escape. The focused run passed
37/37.

## B2 — minimized trusted projection

The repository projection is closed to exactly `claimTokenId`,
`prescriptionId`, `initials`, `issuerDisplayName`, and `dateOfBirth`. Full
patient names are derived by `maskPatientName` before entering the repository;
`patientName` is rejected as an unknown projection field. Repository snapshots
and audit-shaped data are tested for absence of the full name, and the public
preview remains limited to initials plus allow-listed issuer display name.

## N1 — issuer Unicode hardening

The service normalizes issuer display names with NFKC and rejects non-canonical
values plus Unicode control, format/bidi, surrogate, zero-width, and line /
paragraph-separator characters. The executable contract validator and v1 JSON
schema apply the corresponding rejection boundary. Tests cover adversarial
format/bidi, zero-width, BOM, soft-hyphen, line-separator, and decomposed
display-name inputs.

## Validation evidence

- `node --test apps/backend/test/masked-identity-confirmation.test.mjs apps/backend/test/claim-token-lifecycle.test.mjs packages/contracts/test/contracts.test.mjs packages/contracts/test/schema.test.mjs` — PASSED, 37/37.
- `npm run validate:node` — PASSED: backend 80/80, PWA 2/2, contracts 17/17, build, lint, and static check.
- `git diff --check` — PASSED.
- `npm ci --ignore-scripts` — completed with 0 reported vulnerabilities to restore missing workspace dependencies before validation.

No merge, push, provider, credential, production activation, or HUMAN_TESTING
operation was performed. Auth, non-enumeration, rate-limit, audit,
capability, DEV-010 consumption, and TD-001 boundaries remain in place.
Independent re-review is required before any status advancement.
