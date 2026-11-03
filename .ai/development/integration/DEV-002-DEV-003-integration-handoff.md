---
integration: DEV-002-DEV-003
status: COMPLETE
branch: agent/integration-dev-002-dev-003
base_commit: e9fe0afed3e8ce851d49103db1beb714a46c08e8
integration_commit: da5a6c98e9e51f4b503bd0593e03ecad4018075d
review_record_commit: 3385d51d841acec7b64e481b8591a724d0c86d5b
remediation_commit: 112b792eba5593ef59efd0d1c60435f390834838
second_remediation_commit: 560626632f3a6165870246c642da3e930a26720b
third_remediation_commit: 22109d31737aa5f185bf2730e5fa6a1dddc3db36
final_review_commit: b9af37b54db262d6d5972c707cb1192ef7fa7e70
validated_commit: df6c919c7bdc7acc978635814f9eca509c511809
merged_commit: df6c919c7bdc7acc978635814f9eca509c511809
integrated_at: 2026-11-03T15:55:44Z
remediated_at: 2026-11-03T16:08:53Z
second_remediated_at: 2026-11-03T16:18:00Z
third_remediated_at: 2026-11-03T16:25:36Z
ready_for_review: false
autonomous_completion_eligible: true
merge_status: MERGED_PUSHED
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

## Independent re-review remediation history

Independent re-review commit `0fa7707c3f66a53678a373fcf7f9072798ba836f` kept B1 and B3 blocking and N1 partially unresolved. Second remediation commit `560626632f3a6165870246c642da3e930a26720b` addresses those three findings. DEV-002 and DEV-003 remain `INTEGRATED` pending another independent re-review.

### Root causes and redesign

- **B1:** The prior WeakSet rejected arbitrary provider objects but production still owned and exported both the deterministic provider registrar and its fixed doctor credential. Any ordinary importer could therefore ask production to trust the bundled fake. Deterministic records, credentials, provider behavior, and the authentication helper now exist only in `apps/backend/test/support`. Production exposes an explicit package export map containing only application-facing modules; provider installation and subject minting remain inside the non-exported composition-root authority. The negative runtime-surface test scans all production source, imports every package export, rejects dangerous export names, and proves the internal identity authority is blocked by `ERR_PACKAGE_PATH_NOT_EXPORTED`. The built `dist` contains no test-support path, fake provider, fixed test identity, or fixed credential.
- **B3:** The prior request-ID regex constrained syntax but still trusted caller-selected semantics, so identifier-shaped OCR/clinical text passed unchanged to the sink. `requestId` was removed from the logger field API entirely; the logger still permits only closed event/action/outcome/error enums and bounded duration. The adversarial test injects `req_rawOCRpatientMedicationDose1234` through the event and every field-shaped input, including the removed request-ID path, and checks after each probe that the sink remains untouched.
- **N1:** Runtime and schema duplicated integer constraints, but the schema encoded only lower bounds while runtime used `Number.isSafeInteger`. All nine published integer field occurrences now set `maximum: 9007199254740991`, including the `resourceVersion` minimum-2 variant. Boundary parity fixtures exercise every occurrence through AJV and its runtime validator: max is accepted and max+1 is rejected by both.

### Adversarial RED evidence

- B1 exact probe minted `{ "subjectId": "test-doctor-0001", "role": "doctor" }`; the production-surface regression then failed on `production source contains safe-test-doctor-secret`.
- B3 exact probe emitted `{ "requestId": "req_rawOCRpatientMedicationDose1234" }`; the regression failed with `Missing expected exception (TypeError)` on the request-ID field.
- N1 exact AJV/runtime probe returned `{ "schemaAccepted": true, "runtimeAccepted": false }` for `byteLength: 9007199254740992`; the boundary regression failed with `EphemeralDocumentInput.byteLength schema accepted unsafe integer`.

### GREEN and regression evidence

- `node --test apps/backend/test/identity-foundation.test.mjs` — passed 13/13 focused identity, session, runtime-surface, and logging tests.
- `npm test -w @medsup/contracts` — passed 13/13, including all nine safe-integer max/max+1 parity fixtures.
- `npm ci --ignore-scripts` — clean install passed; 13 packages audited, 0 vulnerabilities.
- `npm audit --json` and `npm audit --omit=dev --json` — both reported 0 vulnerabilities; `npm ls --all` reported a valid dependency tree.
- `ANDROID_HOME=/home/felipe/.hermes/cache/scratch/android-sdk ANDROID_SDK_ROOT=/home/felipe/.hermes/cache/scratch/android-sdk ./scripts/validate.sh` — passed Node build/test/lint/static checks and all Android/Wear assemble, unit-test, lint, and check commands. Node totals were backend 15/15, PWA 2/2, contracts 13/13.
- Post-build runtime/privacy scan found no deterministic fake, fixed test credential, test identity, or test-support artifact in `apps/backend/dist`; the logging artifact contains no request-ID or clinical/OCR field path.
- `git diff --check e9fe0afed3e8ce851d49103db1beb714a46c08e8..HEAD` and worktree `git diff --check` passed before this handoff update.

## Independent re-review 2 final remediation history

Independent re-review 2 commit `d65c1b6d9e6bea0460f0ac71a33c68a26051dbab` kept B1 blocking because the recursive backend build shipped `dist/identity/identity-port.mjs`. Its exported `createIdentityCompositionRoot` accepted an attacker-selected provider result, branded it, and made the resulting doctor subject acceptable to the same built authorization primitive. Final remediation commit `22109d31737aa5f185bf2730e5fa6a1dddc3db36` removes that runtime authority. DEV-002 and DEV-003 remain `INTEGRATED` pending independent review.

### Root cause and architectural remediation

- **Root cause:** Closing package exports did not close the deployable artifact boundary. Production still owned a module-global `WeakSet`, subject minting, provider installation, assertion, and role authorization in one recursively copied module. Any direct built-artifact importer could therefore supply a provider and create a doctor accepted by that same global authority.
- **Runtime authority removal:** `identity-port.mjs` is deleted. Generated runtime contains no brand registry, provider installation, authentication operation, credential handling, or subject-minting function. `subject.mjs` now creates role guards only from an injected trusted `assertAuthenticatedSubject` capability, and `createSessionManager` requires that same capability explicitly.
- **Test-only authority:** The deterministic brand, authentication harness, identities, and credentials now live entirely under `apps/backend/test/support`. Two independently created harness authorities use separate brands; a subject from one is rejected by a role guard and session manager configured with the other.
- **Built-artifact adversary:** `built-artifact-authority.test.mjs` runs the backend build, recursively imports every generated `dist/**/*.mjs`, rejects composition/register/mint/authenticate/provider-factory exports, and runs the exact attacker-provider/composition-root probe. The final artifact has five modules, no dangerous export, and no path that can produce an attacker doctor accepted by built authorization.

### TDD and validation evidence

- RED: the new post-build test failed against the reviewed runtime on `dist/identity/identity-port.mjs:createIdentityCompositionRoot`; the exact attacker-provider path was present and the prior independent probe had already demonstrated the accepted `attacker-doctor` result.
- GREEN: focused built-artifact and identity tests passed 15/15; complete backend tests passed 17/17, including cross-authority rejection.
- `npm ci --ignore-scripts` passed; 13 packages audited, 0 vulnerabilities. `npm audit --json` and `npm audit --omit=dev --json` both reported 0 vulnerabilities; `npm ls --all` reported a valid dependency tree.
- `ANDROID_HOME=/home/felipe/.hermes/cache/scratch/android-sdk ANDROID_SDK_ROOT=/home/felipe/.hermes/cache/scratch/android-sdk ./scripts/validate.sh` passed all Node build/test/lint/static checks and Android/Wear assemble, unit-test, lint, and check commands. Node totals: backend 17/17, PWA 2/2, contracts 13/13.
- Runtime and generated-artifact privacy scans found no raw OCR, proposal, document, credential, fixed test secret, provider, brand registry, composition root, or minting path. B2/B3/B4/N1/N2 and PD-008 behavior remains covered and unchanged.
- `git diff --check e9fe0afed3e8ce851d49103db1beb714a46c08e8..HEAD` and worktree `git diff --check` passed before this handoff update.

## Known issues

- Session/device state remains intentionally in memory; persistence, real identity providers, account recovery flow, and provider selection are outside DEV-003 and this integration.
- All failed independent review records are preserved under `.ai/reviews`; the final independent review passed with zero findings.

## Review readiness

Final independent review at `b9af37b54db262d6d5972c707cb1192ef7fa7e70`
passed with zero blocking and zero non-blocking findings. The only later commit,
`df6c919c7bdc7acc978635814f9eca509c511809`, changed workflow documentation,
not runtime code, schemas, tests, or build configuration.

## Autonomous completion

The work was reassessed under the current dev-team Autonomy Policy and remains
provider-neutral and test-only. It adds no real users, real health-data flow,
deployment, billing, physical-device behavior, or unresolved product or
architecture decision. Full validation on exact commit
`df6c919c7bdc7acc978635814f9eca509c511809` passed, including all Node,
Android, and Wear commands; production dependency audit reported zero
vulnerabilities; `git diff --check` and the clean merge-tree check passed.
`main` and `origin/main` had no divergent human changes. The exact commit was
fast-forwarded to `main`, pushed normally, and verified at `origin/main`.
