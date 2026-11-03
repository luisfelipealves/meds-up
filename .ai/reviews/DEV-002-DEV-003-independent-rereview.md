---
review: DEV-002-DEV-003
review_type: independent-rereview
status: CHANGES_REQUIRED
verdict: FAIL
branch: agent/integration-dev-002-dev-003
base_commit: e9fe0afed3e8ce851d49103db1beb714a46c08e8
reviewed_commit: d46a63f987dac5e2f461df9ac678985c53b2dff4
remediation_commit: 112b792eba5593ef59efd0d1c60435f390834838
blocking_findings: 2
non_blocking_findings: 1
reviewed_at: 2026-11-03T16:12:14Z
---

# Independent re-review — DEV-002 + DEV-003 remediation

## Verdict

**FAIL — 2 blocking findings remain.** B2, B4, and N2 are resolved. B1 and B3 remain exploitable through paths not covered by the remediation tests, and N1 remains partially unresolved. DEV-002 and DEV-003 must not advance to `HUMAN_TESTING`.

## Reviewed scope

- Branch: `agent/integration-dev-002-dev-003`
- Base: `main` at `e9fe0afed3e8ce851d49103db1beb714a46c08e8`
- Reviewed HEAD: `d46a63f987dac5e2f461df9ac678985c53b2dff4`
- Remediation implementation: `112b792eba5593ef59efd0d1c60435f390834838`
- Diff: base through reviewed HEAD, 27 files, 1,992 insertions and 19 deletions before this re-review record.
- Read independently: original review; integration and developer handoffs; DEV-002/DEV-003 tasks; PD-005 and PD-008; implementation, schemas, tests, manifests, lockfile, and the complete base-to-HEAD diff.

## Validation evidence

- `npm ci --ignore-scripts` — passed; 13 packages audited, 0 vulnerabilities.
- `node --test apps/backend/test/identity-foundation.test.mjs` — passed 12/12.
- `npm test -w @medsup/contracts` — passed 12/12.
- `npm run validate:node` — passed: backend 14/14, PWA 2/2, contracts 12/12; build, lint, and foundation static check passed.
- `ANDROID_HOME=/home/felipe/.hermes/cache/scratch/android-sdk ANDROID_SDK_ROOT=/home/felipe/.hermes/cache/scratch/android-sdk ./scripts/validate.sh` — passed all Node, Android, and Wear build/test/lint/check commands.
- `npm audit --json` and `npm audit --omit=dev --json` — both reported 0 vulnerabilities.
- `npm ls --all` — dependency tree valid; exact AJV pins and backend-to-contract workspace dependency resolved.
- `git diff --check e9fe0afed3e8ce851d49103db1beb714a46c08e8..HEAD` — passed.
- Added-line scans found no hard-coded production secret assignment, shell execution, dynamic evaluation, or unsafe deserialization pattern.
- Independent runtime and AJV probes reproduced the remaining B1, B3, and N1 findings below while confirming B2 behavior.

## Prior-finding disposition

| Finding | Disposition | Independent evidence |
| --- | --- | --- |
| B1 — public subject minting | **UNRESOLVED / BLOCKING** | Direct registrar export is gone and arbitrary provider objects are rejected, but the runtime publicly exports both a trusted-provider factory and its doctor credential. An ordinary importer minted a branded doctor. |
| B2 — revoked device ordinary reauthorization | **RESOLVED** | Ordinary `establishSession` returned `DEVICE_REVOKED`; explicit replacement succeeded; the old token returned `SESSION_REVOKED` both before and after replacement. |
| B3 — sensitive logging through allow-listed values | **UNRESOLVED / BLOCKING** | Event/action/outcome/error/duration are bounded, but `requestId` still accepts semantically free-form alphanumeric text. A clinical/OCR-bearing value reached the sink unchanged. |
| B4 — free-form/incompatible error schema tuples | **RESOLVED** | AJV compiles the schema; every runtime tuple validates; altered message or retryability is rejected by schema and runtime. |
| N1 — schema execution, nested closure, parity | **PARTIALLY RESOLVED / NON_BLOCKING** | AJV execution and recursive nested closure are now covered, but a concrete numeric runtime/schema parity gap remains. |
| N2 — device IDs and duplicate tokens | **RESOLVED** | Device IDs are bounded and duplicate generated tokens fail with `CONFLICT` before mutation; focused tests pass. |

## BLOCKING findings

### B1 — The public deterministic fake remains an ordinary doctor-minting capability

`apps/backend/src/identity/identity-port.mjs:10-21,33-47,49-58` places `SAFE_TEST_IDENTITIES`, including the doctor secret, beside `createDeterministicFakeIdentityProvider`. `apps/backend/src/identity/fake-identity-provider.mjs:1-4` publicly re-exports both. Calling that public factory inserts its provider into the same private `trustedIdentityProviders` registry used by `authenticateSubject`; any ordinary importer can then submit the public doctor credential and receive a branded doctor subject.

Independent probe:

```json
{
  "subjectExportHasMint": false,
  "arbitraryProviderRejected": true,
  "publicTestFactoryMintsDoctor": {
    "subjectId": "test-doctor-0001",
    "role": "doctor"
  }
}
```

The remediation test at `apps/backend/test/identity-foundation.test.mjs:28-38` checks only the subject-module export and an arbitrary object. It does not test the public trusted-fake route, and its title (“ordinary application callers cannot mint authenticated subjects”) is therefore not established.

**Impact:** Code with ordinary access to the backend runtime modules can mint an authenticated doctor without an externally controlled identity adapter or secret. The brand proves only that a publicly constructible built-in provider was used, not that a trusted composition boundary authenticated the caller.

**Required fix:** Move fake-provider registration and fixed credentials to a test-only boundary that is unavailable to ordinary runtime importers/builds, and make production provider registration/authentication a capability owned by the trusted composition root. Add a negative production-surface test proving that ordinary imports cannot obtain any doctor subject, including through test helpers.

### B3 — `requestId` is still a free-form sensitive log channel

`apps/backend/src/observability/structured-logger.mjs:15-21` validates `requestId` with `^req_[A-Za-z0-9_-]{16,64}$`. This bounds length and alphabet but not meaning. It accepts clinical/document/OCR/identity text after removing spaces, and line 47 forwards it unchanged to the sink.

Independent probe accepted and emitted:

```json
{
  "requestId": "req_rawOCRpatientMedicationDose1234"
}
```

The adversarial test at `apps/backend/test/identity-foundation.test.mjs:225-245` uses one space-containing sensitive string for every field. That string fails the identifier grammar and therefore does not test whether an identifier-shaped sensitive value passes. Event, action, outcome, error code, and duration are otherwise closed and bounded.

**Impact:** PD-008 requires logs, traces, errors, and metrics not to include OCR, clinical fields, or identifiers that reveal them. The logger still provides a direct accepted value path to the sink, so DEV-003's “sensitive values are excluded from logs” criterion is not met.

**Required fix:** Accept only correlation identifiers generated at a trusted boundary with a non-semantic canonical format (and do not accept caller-selected descriptive IDs), or otherwise map caller input to an internally generated correlation ID. Add identifier-shaped adversarial payloads for every identifier field and assert that no sink call occurs.

## NON_BLOCKING findings

### N1 — Published numeric schemas accept integers rejected by runtime validators

Executable validators use `Number.isSafeInteger`, while JSON Schema integer fields specify only `minimum`. AJV accepted this `EphemeralDocumentInput`:

```json
{
  "apiVersion": "v1",
  "schemaVersion": 1,
  "reviewSessionId": "rvs_01JBR4N9V2Q8K6M3F7X5T1C0AZ",
  "mediaType": "application/pdf",
  "byteLength": 9007199254740992
}
```

`validateEphemeralDocumentInput` rejected the same object. The same pattern affects other positive-integer fields. The new parity suite covers representative valid values, unknown fields, whitespace clinical text, and canonical errors, but not numeric boundaries.

**Recommendation:** Add schema `maximum: 9007199254740991` wherever runtime requires safe integers (or deliberately align runtime another way), then add boundary parity fixtures for every shared numeric primitive. Keep the documented application-only cross-field rules separate.

## Full acceptance and boundary review

### DEV-002

The DEV-002 contract model otherwise meets its criteria: ephemeral request metadata, session-only untrusted proposals, explicit doctor confirmation, confirmed prescriptions/immutable versions, status suspension/cancellation, version retrieval, idempotency/resource/server version conventions, and non-clinical audit references are distinct and closed. No source-document/raw-OCR/proposal retrieval or recovery locator exists, and no private reminder-response history transport is represented. Scheduling remains out of scope.

B4 is resolved: the published error schema uses closed exact `oneOf` variants for every canonical code/message/retryability tuple, and both schema and runtime reject modified tuples and nested diagnostics.

### DEV-003 / PD-005

Role checks, exact expiry, shared error envelopes, all-session/all-device revocation, revoked-device synchronization rejection, and device/token duplicate handling behave as required. The B2 probe confirmed that ordinary establishment cannot clear revocation and that explicit replacement never revives the old token. The explicit replacement primitive is acceptable as a backend hook; DEV-020 must ensure only the trusted recovery/new-device flow invokes it.

Provider-specific behavior remains isolated and no real vendor SDK, production credential, deployment configuration, or provider selection was added. B1 nevertheless prevents acceptance of the authenticated-subject trust boundary.

### PD-008 and private reminder transport

No bucket/table/repository/retrieval/recovery/durable queue/shared cache/browser storage/analytics/trace path was introduced for documents, raw OCR/AI output, or unconfirmed proposals. No backend transport or field for private reminder-response history was added. Contract confirmation remains explicit and the proposal cannot masquerade as a confirmed prescription.

The B3 request-ID channel is the remaining PD-008 logging violation. Error messages themselves are now fixed and content-free.

### Scope, dependencies, lockfile, and regression risk

- Changes remain within contracts, identity/session/logging foundations, tests, dependency wiring, and workflow records; no persistence/provider/deployment/UI scope was added.
- DEV-001 dependency is present in task records; downstream DEV-004, DEV-011, and DEV-019 readiness changes match the integrated dependency graph.
- Backend declares `@medsup/contracts` `1.0.0`; workspace and lockfile entries agree; AJV `8.20.0` and `ajv-formats` `3.0.1` are exact development pins; clean install and `npm ls --all` pass.
- Audit reports zero vulnerabilities. Full Node/Android/Wear validation passes, but the passing suite has false-negative gaps demonstrated by the B1, B3, and N1 probes.

## Next action

Keep DEV-002 and DEV-003 at `INTEGRATED`. Remove the runtime-accessible fake doctor-minting path, close the semantic request-ID logging channel, add the missing adversarial tests, align numeric schema/runtime boundaries, rerun full validation, update the integration handoff, and request another independent re-review. PASS is not permitted while either blocker remains.
