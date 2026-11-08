---
task: DEV-009
type: developer-handoff
status: IMPLEMENTED
branch: agent/dev-009-masked-identity
worktree: /home/felipe/projetos/meds-up-worktrees/dev-009-masked-identity
implementation_commit: e0486a0
workflow_commit: pending
implemented_at: 2026-11-08T10:34:26Z
assigned_agent: codex-dev-team
architecture_gate: .ai/development/decisions/TD-001-production-health-data-processing-gate.md
---

# DEV-009 — Developer handoff

## Result

DEV-009 is implemented in the provider-neutral/local boundary with synthetic
data only. The work adds a backend masked pre-claim identity confirmation
service and closed v1 contracts. It does not select an authentication provider,
connect to a provider, persist production data, deploy anything, associate a
prescription, add UI, or implement DEV-010.

## Implementation

- `apps/backend/src/claims/masked-identity-confirmation.mjs`
  - Requires a trusted authenticated patient subject before preview or
    confirmation; doctor subjects and forged subjects are rejected.
  - Derives first/last initials at the trusted boundary and returns exactly
    `{ initials, issuerDisplayName }` for a valid pre-claim preview.
  - Requires a provider-neutral allow-listed issuer display name and a
    canonical civil DOB (`YYYY-MM-DD`) from the trusted projection.
  - Compares DOB in the backend without echoing or serializing either DOB.
  - Uses the same content-free `CONFLICT` claim failure for malformed,
    unknown, expired, revoked/replaced/consumed lifecycle state, and DOB
    mismatch paths.
  - Records every preview/confirmation attempt with opaque IDs, operation,
    allow-listed outcome, and server timestamp only. Raw token, token digest,
    patient name, initials, issuer name, DOB, clinical data, and URLs do not
    enter audit records.
  - Applies a bounded rolling-window failure limit per trusted patient.
  - Returns a non-serializable-by-secret handoff capability after a matching
    DOB. `consumeConfirmed` is an explicit next lifecycle boundary; no consume
    or association happens during preview or confirmation.
- `apps/backend/src/claims/claim-token-lifecycle.mjs`
  - Adds an internal `resolveForConfirmation` operation that only resolves an
    active, unexpired token to opaque claim/prescription IDs and does not
    mutate or consume the token.
- `packages/contracts/src/index.mjs` and
  `packages/contracts/schemas/v1/contracts.schema.json`
  - Add closed, provider-neutral contracts for masked preview, confirmation
    command, and minimized claim identity audit records.
- `apps/backend/package.json`
  - Exports the new claim confirmation module without adding a provider SDK.

## Security and scope evidence

- Preview output has exactly two fields and contains no DOB, patient name,
  medication, dose, diagnosis, instruction, document, OCR, URL, or provider
  payload.
- Invalid token and DOB mismatch produce the same external error code/message;
  internal audit outcomes remain allow-listed and bounded.
- The token lifecycle remains ACTIVE after preview and after successful DOB
  confirmation. Only the explicit capability handoff can invoke the later
  lifecycle consume operation, and it is bound to the authenticated patient
  subject in a `WeakMap`.
- Projection shape is closed and rejects clinical/provider-shaped fields.
- No IdP, OCR, cloud, database, KMS, notification provider, credential,
  network call, production persistence, deployment, or real health data was
  introduced. TD-001 remains OPEN.

## Tests

Focused tests:

- `node --test apps/backend/test/masked-identity-confirmation.test.mjs`
  — 7/7 passed.
- `node --test apps/backend/test/claim-token-lifecycle.test.mjs`
  — 10/10 passed.
- `node --test packages/contracts/test/contracts.test.mjs packages/contracts/test/schema.test.mjs`
  — 17/17 passed.

Full Node validation:

- `npm run validate:node` — passed: backend 77/77, PWA 2/2, contracts 17/17,
  build, lint, and foundation static check.
- `git diff --check` — passed.

The implementation commit is `e0486a0`.

## Follow-up boundary

DEV-010 must consume the confirmed capability and coordinate association with
token consumption in its own required durable transaction. A future durable
adapter must preserve atomic lookup/rate-limit/audit/confirmation semantics;
this handoff claims only the deterministic in-memory/local implementation.

No merge or push was performed.
