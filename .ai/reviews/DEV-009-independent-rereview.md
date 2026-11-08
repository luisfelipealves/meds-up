---
task: DEV-009
type: independent-rereview
status: PASS
verdict: PASS
base_commit: 479db3c9a00b887dc8c82d40dec4793532c8c79d
reviewed_commit: 2e6228b05039984db23b9677db4752e36f1d3423
reviewed_range: 479db3c9a00b887dc8c82d40dec4793532c8c79d..2e6228b05039984db23b9677db4752e36f1d3423
remediation_range: 591ae788e804bd1556dd0094736ab8b36ac7576f..2e6228b05039984db23b9677db4752e36f1d3423
reviewer: fresh-independent-codex-rereview
reviewed_at: 2026-11-08T00:00:00Z
blocking_findings: 0
non_blocking_findings: 1
architecture_gate: .ai/development/decisions/TD-001-production-health-data-processing-gate.md
---

# DEV-009 independent rereview

## Verdict

**PASS**, with one non-blocking contract integration note. This is a new
review of the actual `origin/main..HEAD` diff; it does not rely on the prior
review or its handoffs. The exact reviewed `HEAD` is
`2e6228b05039984db23b9677db4752e36f1d3423`.

The remediation in `591ae78..2e6228b` resolves B1, B2, and N1. No merge,
push, provider connection, credential use, production activation, or
`HUMAN_TESTING` status change was performed. TD-001 remains `OPEN`.

## Scope and evidence

I independently read the DEV-009 requirements, PD-002, the technical
analysis, TD-001, DEV-010, DEV-008 lifecycle boundary, and the complete
`origin/main..HEAD` diff. I inspected the implementation, tests, runtime and
published contracts, then ran focused probes and the full Node validation.

### B1 — stable contact-the-emitter error envelope: RESOLVED

`masked-identity-confirmation.mjs:5,12-13` now uses the shared
`CLAIM_IDENTITY_FAILED` code and canonical message `Please contact your doctor
or clinic.`. Invalid token, DOB mismatch, rate limit, lifecycle/provider
failure, repository failure, and audit failure paths converge on that generic
outcome (`:135-181`). Successful preview/confirmation requires a successful
audit commit (`:145`, `:174`); failures are converted to the same generic
outcome and do not leak arbitrary `TypeError`/`FoundationError` details.

The focused transport probe serialized invalid-token, mismatch, and
rate-limited failures through `toErrorEnvelope` and found one identical error
tuple. The adversarial repository/audit probe confirmed that a `TypeError`
does not escape. The published runtime and JSON schema define the same
allow-listed code, message, shape, and non-retryable flag
(`packages/contracts/src/index.mjs:23,41` and
`packages/contracts/schemas/v1/contracts.schema.json:312-314`).

### B2 — minimized trusted projection and masking at rest: RESOLVED

The accepted projection is closed to exactly
`claimTokenId,dateOfBirth,initials,issuerDisplayName,prescriptionId`
(`masked-identity-confirmation.mjs:56-68`). The trusted name masking function
derives only first/last initials (`:44-53`), and repository persistence stores
the normalized projection, never `patientName` (`:198-205`). The public preview
returns exactly initials plus issuer display name (`:125-127`).

The repository snapshot probe found no full patient name, clinical field, raw
token, DOB in the preview, or token digest in identity audit data. Unknown
`patientName` and clinical/provider-shaped fields are rejected by the closed
projection boundary.

### N1 — issuer Unicode hardening: RESOLVED

Issuer values are NFKC-canonical and reject control, format/bidi, surrogate,
zero-width, line-separator, and paragraph-separator characters before the
allow-list check (`masked-identity-confirmation.mjs:35-41`). The executable
preview validator applies the same boundary (`packages/contracts/src/index.mjs:357-369`),
and the v1 schema carries the corresponding negative pattern
(`packages/contracts/schemas/v1/contracts.schema.json:202-208`). Tests/probes
covered bidi/format, zero-width, BOM, soft hyphen, line/paragraph separator,
C1/control, and decomposed display-name inputs.

## Security and boundary checks

- Auth is required before preview/confirmation through the trusted subject
  assertion and patient role guard (`:98,106,130-132,154-156`); forged and
  doctor subjects are rejected.
- Invalid, unknown, expired, revoked/replaced/consumed, and DOB-mismatch
  paths do not return identity information or distinguish existence.
- Failed outcomes are bounded per trusted patient and rate-limited; attempts
  have opaque IDs, server time, allow-listed operation/outcome, and no raw
  token, digest, DOB, name, initials, issuer, or clinical data.
- The capability is an opaque `WeakMap`-bound handoff to the authenticated
  patient, is single-use, and does not consume during preview/confirmation
  (`:104,174-191`). Token replay remains guarded by DEV-008 lifecycle
  consumption. DEV-009 makes no association; DEV-010 remains the owner of
  association and required durable transaction coordination.
- No provider, production persistence, real health data, credential, network,
  or TD-001-gated deployment path was introduced.

## Non-blocking finding

### N2 — service fragment versus versioned public preview contract

The service intentionally returns the two-field masked fragment
`{ initials, issuerDisplayName }` (`:125-127`), while the published closed
`ClaimIdentityPreview` contract requires `apiVersion` and `schemaVersion`
(`packages/contracts/src/index.mjs:363-369`, schema `:202-208`). A direct probe
confirmed that the service-shaped fragment is not itself valid against that
published contract. This is non-blocking for the provider-neutral domain
boundary because the existing tests and requirement intentionally constrain
the service result to exactly two fields, but the future transport adapter
must add/validate the version fields explicitly before wire exposure. DEV-010
must not infer or bypass that adapter boundary.

## Validation

- Focused tests: **37/37 passed**:
  `node --test apps/backend/test/masked-identity-confirmation.test.mjs apps/backend/test/claim-token-lifecycle.test.mjs packages/contracts/test/contracts.test.mjs packages/contracts/test/schema.test.mjs`.
- Full `npm run validate:node`: **passed** — backend 80/80, PWA 2/2,
  contracts 17/17, build, lint, and foundation static check.
- `git diff --check`: **passed**.
- `npm ci --ignore-scripts`: completed successfully; 0 vulnerabilities.
- No product code was changed during this rereview; only this review and
  rereview task metadata are to be committed.

## Gate

**PASS for DEV-009 provider-neutral/local scope.** Keep task status at
`REVIEW`; this rereview does not authorize `HUMAN_TESTING`, merge, push,
production activation, providers, credentials, or real health-data operation.
The one N2 note must be carried into the eventual transport/DEV-010 boundary,
and TD-001 remains an independent production gate.
