---
integration: DEV-002-DEV-003
status: INTEGRATED
branch: agent/integration-dev-002-dev-003
base_commit: e9fe0afed3e8ce851d49103db1beb714a46c08e8
integration_commit: da5a6c98e9e51f4b503bd0593e03ecad4018075d
review_record_commit: 3385d51d841acec7b64e481b8591a724d0c86d5b
remediation_commit: 112b792eba5593ef59efd0d1c60435f390834838
integrated_at: 2026-11-03T15:55:44Z
remediated_at: 2026-11-03T16:08:53Z
ready_for_review: true
---

# DEV-002 + DEV-003 integration handoff

## Included commits

- DEV-002 implementation: `da1bd862ff78629367dcb024c687ea6cd63a35f0`
- DEV-002 developer handoff: `86106c1833fbadf02e9fdc83c4ff80d64caef8ac`
- DEV-002 merge: `849be301aa14b51dbaa3f7aa6c7993dd7b063af9`
- DEV-003 implementation: `3df837243492274ee3975b278c728295dc692376`
- DEV-003 developer handoff: `619431cec37a5058950a2602e1bc740c1d49b878`
- DEV-003 merge: `3f2c5e756ed3e5efdd039062f2c4e5055ef8d6de`
- Shared-contract alignment: `da5a6c98e9e51f4b503bd0593e03ecad4018075d`

## Conflict resolution and dependency state

The only DEV-003 merge conflict was `.ai/development/technical-plan-PD-001.md`. It was resolved mechanically at integration time: `updated_at` is `2026-11-03T15:53:52Z`; the graph records `IMPLEMENTED: DEV-001, DEV-002, DEV-003` and `READY: DEV-004, DEV-011, DEV-019, DEV-022`. DEV-004 was advanced from `PLANNED` to `READY` only after both DEV-002 and DEV-003 were present on this integration branch.

## Shared-contract alignment

- `@medsup/contracts` now canonically exports the doctor/patient roles and the complete stable error-code set used by the identity/session foundation.
- The published v1 error schema includes the identity/session codes and retains the fixed content-free envelope (`apiVersion`, stable message, request ID, and retryability).
- Backend-local duplicate role/error-code objects were removed. Backend modules import and re-export the canonical shared objects to preserve their existing API and tested role/session behavior.
- `toErrorEnvelope` delegates to the canonical `createErrorEnvelope`; backend callers provide the request ID required by the shared contract.
- `@medsup/backend` declares its workspace dependency on `@medsup/contracts`; `package-lock.json` was regenerated consistently by npm.
- Session expiry, atomic all-session/all-device revocation, revoked-device synchronization rejection, non-forgeable subjects, provider isolation, and structured log redaction remain unchanged.
- PD-008 remains intact: no document/OCR/proposal persistence or recovery path was introduced. No private reminder-response history transport was added.

## TDD and validation evidence

RED was observed before alignment:

1. The integration test initially failed with `ERR_MODULE_NOT_FOUND` because the backend had no declared shared-contract dependency.
2. After installing the workspace dependency, it failed because `@medsup/contracts` did not export `ERROR_CODES`.

GREEN and full validation:

- `node --test apps/backend/test/identity-foundation.test.mjs` — passed, 8 tests.
- `npm test -w @medsup/contracts` — passed, 10 tests.
- `npm install --package-lock-only --ignore-scripts` and `npm install --ignore-scripts` — completed; 0 vulnerabilities.
- `ANDROID_HOME=/home/felipe/.hermes/cache/scratch/android-sdk ANDROID_SDK_ROOT=/home/felipe/.hermes/cache/scratch/android-sdk ./scripts/validate.sh` — passed all Node build/test/lint/static checks and Android/Wear assemble, unit-test, lint, and check commands.
- Full Node test results within validation: backend 10 passed, PWA 2 passed, contracts 10 passed, 0 failed.
- `git diff --check` — passed.
- Added-line privacy scans over contracts/backend — passed; no private reminder-history transport or durable document/OCR/provider payload fields were introduced.

## Independent-review remediation history

Independent review at `3385d51d841acec7b64e481b8591a724d0c86d5b` recorded `CHANGES_REQUIRED` with blocking findings B1-B4 and non-blocking findings N1-N2. Remediation commit `112b792eba5593ef59efd0d1c60435f390834838` addresses all six findings without advancing DEV-002 or DEV-003 beyond `INTEGRATED`.

### Root causes and fixes

- **B1:** The module-local subject brand was sound, but its public `createAuthenticatedSubject` registrar exposed the minting capability to every importer. Minting and the trusted-provider registry now live inside the authentication boundary; the public subject module exposes only assertions/role checks. Arbitrary provider objects are rejected, while the fixed deterministic `.invalid` fake is registered by the trusted boundary and remains testable.
- **B2:** `establishSession` treated device registration as an unconditional upsert, conflating ordinary authentication with revocation recovery. Ordinary establishment now preserves a revoked device and returns `DEVICE_REVOKED`; only the explicit backend `replaceRevokedDevice` transition may replace that revoked registration. The old token remains revoked before and after replacement.
- **B3:** Logging constrained keys but not values, leaving each string field and the event name as a free-form sensitive-data channel. The logger now fails closed on unknown keys and uses one allow-listed event, bounded action/outcome/error enums, a bounded request-correlation identifier, and a bounded integer duration. Adversarial document/OCR/proposal/identity/credential/clinical values are rejected through every accepted input before the sink is called.
- **B4:** Runtime errors used a canonical tuple map while the independently maintained schema only enumerated codes and allowed arbitrary messages/booleans. The schema now encodes every exact code/message/retryability tuple as a closed `oneOf`; executable AJV tests assert positive and adversarial parity for every canonical runtime error.
- **N1:** Schema tests previously inspected JSON structure as text rather than compiling definitions. AJV `8.20.0` and `ajv-formats` `3.0.1` are exact dev pins; tests compile all definitions, validate positive/negative fixtures through schema and runtime, recursively enforce nested closure, reject whitespace-only clinical strings, and document the remaining application-only cross-field comparisons.
- **N2:** Session creation trusted device/token factories without checking their outputs. Device IDs now use the bounded opaque-ID grammar, and a duplicate generated token fails with `CONFLICT` before device/session mutation.

### Adversarial RED evidence

- B1: the subject namespace still exposed `createAuthenticatedSubject` (`true !== false`).
- B2: same-device establishment after revocation produced `Missing expected exception` instead of `DEVICE_REVOKED`.
- B3: sensitive content injected through allow-listed fields produced `Missing expected exception (TypeError)`.
- B4/N1: schema execution first failed because AJV was absent; after the exact dev dependency was introduced, the schema accepted an incompatible canonical tuple, and the fixture test separately showed acceptance of whitespace-only clinical text.
- N2: invalid device IDs produced `Missing expected exception (TypeError)`; the same test also covers duplicate token generation.

### GREEN and regression evidence

- `node --test apps/backend/test/identity-foundation.test.mjs` — passed 12/12 adversarial and foundation tests.
- `npm test -w @medsup/contracts` — passed 12/12, including compiled-schema fixtures, nested closure, and all canonical error tuples.
- `npm ci --ignore-scripts` — clean install passed; 13 packages audited, 0 vulnerabilities.
- `npm audit --json` and `npm audit --omit=dev --json` — both passed with 0 vulnerabilities.
- `ANDROID_HOME=/home/felipe/.hermes/cache/scratch/android-sdk ANDROID_SDK_ROOT=/home/felipe/.hermes/cache/scratch/android-sdk ./scripts/validate.sh` — passed all Node build/test/lint/static checks and Android/Wear assemble, unit-test, lint, and check commands. Node totals were backend 14/14, PWA 2/2, contracts 12/12.
- Privacy scans over backend runtime, contract runtime, and published schemas returned no document/OCR/provider-payload/persistence/recovery/clinical logging fields; adversarial logger and error-schema tests confirm fail-closed behavior.
- `git diff --check` — passed.

## Known issues

- Session/device state remains intentionally in memory; persistence, real identity providers, account recovery flow, and provider selection are outside DEV-003 and this integration.
- The first independent review failed and is preserved at `.ai/reviews/DEV-002-DEV-003-independent-review.md`; remediation now requires independent re-review.

## Review readiness

`ready_for_review: true`. Re-review the integrated diff from base `e9fe0afed3e8ce851d49103db1beb714a46c08e8` through remediation commit `112b792eba5593ef59efd0d1c60435f390834838`, with particular attention to the B1-B4 and N1-N2 adversarial evidence above. DEV-002 and DEV-003 remain `INTEGRATED` and must not advance to `HUMAN_TESTING` until the follow-up independent review passes.
