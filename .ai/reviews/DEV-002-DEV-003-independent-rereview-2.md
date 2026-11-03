---
review: DEV-002-DEV-003
review_type: independent-rereview-2
status: CHANGES_REQUIRED
verdict: FAIL
branch: agent/integration-dev-002-dev-003
base_commit: e9fe0afed3e8ce851d49103db1beb714a46c08e8
reviewed_commit: c13f0e24f1fb9549daef703cb607bc6014d8e69c
remediation_commit: 560626632f3a6165870246c642da3e930a26720b
blocking_findings: 1
non_blocking_findings: 0
reviewed_at: 2026-11-03T16:20:57Z
---

# Independent re-review 2 — DEV-002 + DEV-003 second remediation

## Verdict

**FAIL — 1 blocking finding remains.** The second remediation resolves B3 and N1 and preserves the earlier B2, B4, and N2 fixes. B1 is only partially resolved: package exports are closed and test identities are test-only, but the generated backend runtime still publishes an identity composition-root function that an ordinary built-artifact importer can use to mint an accepted doctor subject. DEV-002 and DEV-003 must remain `INTEGRATED` and must not advance to `HUMAN_TESTING`.

## Reviewed scope

- Branch: `agent/integration-dev-002-dev-003`
- Base: `main` at `e9fe0afed3e8ce851d49103db1beb714a46c08e8`
- Reviewed HEAD: `c13f0e24f1fb9549daef703cb607bc6014d8e69c`
- Second remediation: `560626632f3a6165870246c642da3e930a26720b`
- Read independently: both prior review records, integration handoff, DEV-002/DEV-003 tasks and developer handoffs, PD-005, PD-008, architecture/contracts documentation, complete base-to-HEAD diff, implementation, package manifests, schemas, tests, build script, and generated runtime.

## Prior-finding disposition

| Finding | Disposition | Independent evidence |
| --- | --- | --- |
| B1 — ordinary callers can mint authenticated subjects | **PARTIALLY RESOLVED / BLOCKING** | Public package exports contain no fake, credential, provider, registrar, authentication, composition-root, or mint export; the package blocks `@medsup/backend/src/identity/identity-port.mjs`; fixed identities and credentials exist only under `test/support`. However, the build copies all of `src`, and `dist/identity/identity-port.mjs` publicly exports `createIdentityCompositionRoot`. Importing that built module with an attacker provider minted and authorized an arbitrary doctor. |
| B2 — revoked device ordinary reauthorization | **RESOLVED** | Focused test and code inspection confirm ordinary establishment returns `DEVICE_REVOKED`, explicit replacement is required, and replacement does not revive the old token. |
| B3 — caller-controlled sensitive logging channel | **RESOLVED** | `requestId` is removed. Event, action, outcome, and error code are closed sets; duration is a bounded safe integer; all unknown fields fail before the sink. Identifier-shaped clinical/OCR text was rejected through the event, all four accepted fields, and ten likely free-form/removed fields, with zero sink calls for every probe. |
| B4 — free-form/incompatible error schema tuples | **RESOLVED** | Exact closed error variants remain in the schema; all runtime tuples pass and modified messages/retryability fail in AJV and runtime. |
| N1 — schema execution and safe-integer parity | **RESOLVED** | All nine schema integer occurrences corresponding to runtime `isPositiveInteger` fields have `maximum: 9007199254740991`; max/max+1 parity passes through AJV and each runtime validator. Recursive nested closure and executable fixture parity remain covered. |
| N2 — invalid device IDs and duplicate tokens | **RESOLVED** | Bounded device IDs and duplicate-token rejection remain implemented and focused tests pass. |

## BLOCKING finding

### B1 — The generated backend runtime exposes a subject-minting composition root

The package export map is now explicit and safe for ordinary package-subpath imports. Its namespaces are:

- `@medsup/backend`: `SURFACE`, `runtimeInfo`
- `@medsup/backend/identity/subject`: `ROLES`, `assertAuthenticatedSubject`, `requireRole`
- `@medsup/backend/identity/session-manager`: `createSessionManager`
- `@medsup/backend/identity/errors`: shared error helpers
- `@medsup/backend/observability/structured-logger`: closed logging helpers

`@medsup/backend/src/identity/identity-port.mjs` correctly fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`, and production source/build output contains no deterministic fake, fixed test identity, fixed test credential, or test-support file.

However, `scripts/build-node-surface.mjs:10-14` recursively copies the complete backend `src` directory into `dist`. Consequently, `apps/backend/dist/identity/identity-port.mjs` exports `createIdentityCompositionRoot` from the built runtime. That function accepts any object with an `authenticate` method and brands whatever `{ subjectId, role }` it returns. The independently built and imported runtime accepted this probe:

```json
{
  "minted": {
    "subjectId": "attacker-doctor",
    "role": "doctor"
  },
  "accepted": {
    "subjectId": "attacker-doctor",
    "role": "doctor"
  }
}
```

The accepted value was checked by the matching built `requireRole(subject, "doctor")`, so this is not merely a relative test-helper import or an unbranded plain object. It demonstrates a real subject-minting capability in the generated runtime.

The regression named `production runtime surface exposes no fake identity or subject-minting capability` does not detect this. It scans production text only for four old fake-specific strings, then checks export names only for package-manifest targets under `src`. It neither imports every generated `dist` module nor rejects `createIdentityCompositionRoot`; therefore it passes while the built-runtime exploit succeeds.

**Impact:** Any code able to import the generated runtime module can install an attacker-controlled provider and mint an authenticated doctor accepted by the same runtime's authorization/session primitives. The requested trust boundary is not established for the deliverable build artifact.

**Required fix:** Ensure the deployable runtime does not expose a provider-registration, composition-root, subject-minting, or equivalent authority. Keep provider installation inside a trusted bootstrap/closure and expose only the already-composed authentication operation needed by application code. Add a post-build regression that imports every built module and proves no such export/capability exists, then attempt the exact attacker-provider probe against the built artifact. Preserve the current package-export and test-only-helper protections.

## Validation evidence

- `npm ci --ignore-scripts` — passed; 13 packages audited, 0 vulnerabilities.
- Focused backend probes/tests — 5/5 passed for package surface, plain-object forgery, B2, N2, and B3. The independent built-artifact B1 probe nevertheless minted and authorized an arbitrary doctor.
- Focused contract schema tests — 2/2 passed for all nine safe-integer boundaries and canonical error tuples.
- Independent B3 probe — identifier-shaped payload `req_rawOCRpatientMedicationDose1234` rejected through 15 event/field paths; every path produced `sinkCalls: 0`.
- Independent B1 surface probe — package exports safe and internal package subpath blocked; generated `dist/identity/identity-port.mjs` exported `createIdentityCompositionRoot`, and the built runtime accepted the attacker doctor shown above.
- `ANDROID_HOME=/home/felipe/.hermes/cache/scratch/android-sdk ANDROID_SDK_ROOT=/home/felipe/.hermes/cache/scratch/android-sdk ./scripts/validate.sh` — passed all Node build/test/lint/static checks and Android/Wear assemble, unit-test, lint, and check commands. Node totals: backend 15/15, PWA 2/2, contracts 13/13.
- `npm audit --json` and `npm audit --omit=dev --json` — 0 vulnerabilities.
- `npm ls --all` — valid dependency tree with exact AJV pins and workspace dependency resolution.
- `git diff --check e9fe0afed3e8ce851d49103db1beb714a46c08e8..HEAD` — passed.

## Full acceptance and privacy recheck

### DEV-002

The contract model remains compliant apart from no new finding: ephemeral document metadata, session-only untrusted proposals, explicit doctor confirmation, confirmed prescriptions and immutable versions, status suspension/cancellation, version retrieval, idempotency/resource/server versions, and non-clinical audit references remain distinct and closed. There is no source-document/raw-OCR/proposal retrieval or recovery locator and no private reminder-response backend field. Error messages remain fixed and content-free. Numeric schema/runtime parity is now complete for the nine published integer fields.

### DEV-003 / PD-005

Roles remain explicit; plain objects cannot forge branded subjects; expiry occurs at the configured deadline; common error envelopes are used; all-session/all-device revocation remains synchronous; revoked devices cannot ordinarily re-establish or synchronize; explicit replacement preserves old-token revocation; device IDs and generated-token collisions fail closed. Provider-specific fake behavior and fixed credentials are now test-only. B1 still prevents acceptance because the generated production runtime itself exposes the authority that brands attacker-selected provider results.

### PD-008 and private reminder transport

No repository, bucket, table, attachment, backup, retrieval/recovery locator, durable queue, shared cache, browser storage, analytics, or trace path was introduced for source documents, raw OCR/AI output, or unconfirmed proposals. No private reminder-response transport was added. The logger now has no caller-controlled free-form string field, and the identifier-shaped adversarial probes reached the sink zero times. Canonical errors remain content-free.

### Scope, dependencies, and regression risk

Changes remain within contracts, identity/session/logging foundations, tests, build/package wiring, and workflow records. No real provider SDK, production credential, deployment/provider choice, or persistence implementation was added. Dependency wiring and audits are clean. The full validation suite passes, but its production-surface test has the built-artifact false negative demonstrated above.

## Counts and next action

- Blocking findings: **1**
- Non-blocking findings: **0**
- Verdict: **FAIL / CHANGES_REQUIRED**

Keep DEV-002 and DEV-003 at `INTEGRATED`. Remove the composition-root/subject-minting capability from the generated runtime surface, add a post-build adversarial regression over every built module, rerun clean/full validation, update the integration handoff, and request another independent re-review. PASS is not permitted until the built-artifact B1 probe fails closed.
