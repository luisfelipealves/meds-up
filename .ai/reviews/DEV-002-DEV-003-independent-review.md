---
review: DEV-002-DEV-003
review_type: independent
status: CHANGES_REQUIRED
verdict: FAIL
branch: agent/integration-dev-002-dev-003
base_commit: e9fe0afed3e8ce851d49103db1beb714a46c08e8
reviewed_commit: eaf6adf3e113f496f38c35a7e17ff9a069c35894
blocking_findings: 4
non_blocking_findings: 2
reviewed_at: 2026-11-03
---

# Independent review — DEV-002 + DEV-003

## Verdict

**FAIL — 4 blocking findings.** Do not advance DEV-002 or DEV-003 to `HUMAN_TESTING`. The integrated branch needs fixes and independent re-review.

## Reviewed scope

- Branch: `agent/integration-dev-002-dev-003`
- Base: `main` at `e9fe0afed3e8ce851d49103db1beb714a46c08e8`
- Reviewed HEAD: `eaf6adf3e113f496f38c35a7e17ff9a069c35894`
- Diff: `main...HEAD`, 26 files, 1,442 insertions and 19 deletions before this review record
- Requirements and evidence read: `.ai/README.md`; DEV-002 and DEV-003 task records; both developer handoffs; integration handoff; technical plan; PD-001, PD-005, and PD-008; architecture README and ADR-0001 through ADR-0004; actual implementation, schemas, tests, package manifests, and lockfile.

## Validation evidence

- `npm ci --ignore-scripts` — passed; 7 packages audited, 0 vulnerabilities.
- `npm run validate:node` — passed: backend 10/10, PWA 2/2, contracts 10/10; build, lint, and foundation static check passed.
- `ANDROID_HOME=/home/felipe/.hermes/cache/scratch/android-sdk ANDROID_SDK_ROOT=/home/felipe/.hermes/cache/scratch/android-sdk ./scripts/validate.sh` — passed all Node, Android, and Wear build/test/lint/check commands.
- `npm audit --omit=dev --json` — 0 vulnerabilities.
- `git diff --check e9fe0afed3e8ce851d49103db1beb714a46c08e8...HEAD` — passed.
- AJV 2020-12 compilation of `packages/contracts/schemas/v1/contracts.schema.json` — schema is valid.
- Read-only adversarial probes reproduced all blocking findings below.

## Requirements that pass

- Canonical roles and error codes are shared by `@medsup/contracts` and backend identity code; backend tests assert object identity and shared-envelope compatibility.
- Doctor and patient role checks reject interchange once a legitimately minted subject is supplied.
- Session expiry rejects at the exact configured deadline.
- Existing sessions and devices are synchronously revoked together by `revokeAll`, with a monotonic per-subject revocation version.
- Stale sessions from revoked devices are rejected during synchronization.
- Provider-specific identity behavior is isolated behind `authenticateSubject`; only a deterministic `.invalid` fake exists. No real identity vendor, production credential, cloud/deployment configuration, or provider SDK was added.
- DEV-002 separates ephemeral request metadata, untrusted session-only proposals, explicit confirmation commands, confirmed prescriptions, immutable version records, status commands/events, and non-clinical audit references.
- Request validators and object schemas are closed, explicit doctor confirmation is required, owner/confirming-doctor IDs must match, status transitions exclude reactivation, and idempotency/resource/server version conventions are documented.
- Version response parsing tolerates additive envelope, record, clinical-content, and medication fields while retaining required-field and enum validation.
- Contract/runtime code adds no repository, retrieval, recovery, durable-message, queue, shared-cache, browser-storage, analytics, or trace mechanism for documents, raw OCR/AI output, or unconfirmed proposals. No private reminder-response backend transport or field was added.
- Dependency and lockfile wiring is consistent: backend declares `@medsup/contracts` `1.0.0`, the workspace and lock both contain the contracts package, and clean install succeeds.
- Workflow transitions are correct: DEV-004, DEV-011, and DEV-019 are `READY` with their declared dependencies satisfied.

## BLOCKING findings

### B1 — Authenticated doctor subjects can be minted directly without identity-provider authentication

**Evidence:** `apps/backend/src/identity/subject.mjs:9-17` publicly exports `createAuthenticatedSubject({ subjectId, role })`. Its only proof is insertion into a module-local `WeakSet`; any caller that imports this public function can mint an arbitrary doctor. `authenticateSubject` uses the same public function, so the brand does not prove provider authentication. The existing forgery test at `apps/backend/test/identity-foundation.test.mjs:34-37` tests only a plain object and misses the exported minting path.

Read-only probe result:

```json
{"accepted":true,"subject":{"subjectId":"attacker","role":"doctor"}}
```

**Impact:** Subject-forgery resistance is not established. Downstream authorization can receive a forged, branded doctor context, defeating role isolation.

**Required fix:** Make authenticated-subject minting inaccessible to ordinary callers and available only through the trusted authentication boundary (for example, a closure/factory capability owned by the identity adapter), then add a negative test proving application callers cannot mint or forge a doctor subject.

### B2 — Revoked device identity is silently re-authorized by establishing a new session

**Evidence:** `apps/backend/src/identity/session-manager.mjs:30-35` unconditionally overwrites the device entry with `revoked: false`. After `revokeAll`, calling `establishSession` with the same `deviceId` clears the revocation without an explicit reauthorization operation or generation check. The existing test only retries synchronization with the old token.

Read-only probe result:

```json
{"oldRejected":true,"sameRevokedDeviceReauthorized":true}
```

**Impact:** The primitive does not preserve device revocation. A declared-lost device that obtains or retains valid credentials can resume synchronization merely by establishing a session, contrary to PD-005 and DEV-003's revoked-device guarantee.

**Required fix:** Preserve revoked device identity/generation across ordinary session establishment and require an explicit trusted reauthorization/new-device path. Add tests for old-token rejection, fresh-session attempts from a revoked device, and deliberate authorized replacement.

### B3 — Structured logging allows sensitive document/OCR/proposal content through allow-listed values

**Evidence:** `apps/backend/src/observability/structured-logger.mjs:1-12,28-31` allow-lists field names but accepts any string/number/boolean value. Sensitive data can be placed in `action`, `status`, `outcome`, `method`, `requestId`, or `errorCode` and is sent unchanged to the sink. The test at `apps/backend/test/identity-foundation.test.mjs:142-171` checks only sensitive values under disallowed keys.

Read-only probe result:

```json
[{"timestamp":"1970-01-01T00:00:00.000Z","event":"review","action":"raw OCR patient medication dose","status":"unconfirmed proposal"}]
```

**Impact:** The review cannot prove the required absence of a logging path for documents, raw OCR/AI output, unconfirmed proposals, credentials, identity, or clinical content. This violates PD-008/ADR-0002 and DEV-003's sensitive-log acceptance criterion.

**Required fix:** Replace free-form operational strings with bounded enums/identifiers or apply explicit value validation/redaction that fails closed. Add adversarial tests injecting sensitive values through every allowed field and event name.

### B4 — Published error schema permits free-form sensitive messages and incompatible retryability

**Evidence:** `packages/contracts/schemas/v1/contracts.schema.json:155-173` closes the error object and enumerates codes, but `message` is any string and `retryable` is any boolean. The executable validator at `packages/contracts/src/index.mjs:279-304` instead requires an exact code/message/retryability tuple. AJV accepted this schema-valid payload:

```json
{
  "apiVersion":"v1",
  "error":{
    "code":"INTERNAL_ERROR",
    "message":"raw OCR: patient takes drug X",
    "requestId":"request_identifier_1234",
    "retryable":false
  }
}
```

The executable validator rejects the same tuple.

**Impact:** The published schema and executable contract disagree, and schema-only producers/consumers can emit sensitive diagnostic or clinical content despite the fixed content-free error requirement.

**Required fix:** Encode the exact allowed code/message/retryability tuples in JSON Schema (for example, closed `oneOf` variants), add positive/negative schema execution tests, and assert parity with every entry accepted by `createErrorEnvelope`.

## NON_BLOCKING findings

### N1 — Schema tests do not execute the schemas or prove runtime/schema parity

`packages/contracts/test/schema.test.mjs` parses JSON, checks top-level definitions for `additionalProperties: false`, and scans selected words. It does not compile the schema, validate fixtures, inspect nested closure generically, or compare schema acceptance with executable validators. AJV independently confirmed that the bundle is a valid 2020-12 schema, but parity gaps remain beyond B4; for example, JSON Schema accepts whitespace-only medication strings while executable validation trims and rejects them, and executable cross-field rules are not represented in schema tests.

**Recommendation:** Add AJV as a pinned development dependency and run valid/invalid fixtures through both schema and executable validators, documenting any intentionally application-only cross-field rule.

### N2 — Session-manager inputs and generated token uniqueness are not validated

`establishSession` accepts empty/non-string device IDs, and duplicate `tokenFactory` output silently overwrites an existing session. These do not invalidate the reviewed happy paths but weaken the foundation and are untested.

**Recommendation:** Validate bounded opaque device IDs, reject duplicate tokens, and test both failure paths while fixing B2.

## Privacy/security boundary conclusion

No retrieval/recovery/persistence/durable messaging/browser storage/analytics/trace implementation was introduced for source documents, raw OCR/AI output, or unconfirmed proposals; no private reminder-response backend transport exists; and no real vendor, credential, deployment, or provider selection was added. However, **the logging path in B3 and schema-valid free-form error path in B4 prevent the required proof that sensitive content cannot enter logs or error transport.**

## Next action

Fix B1-B4 on `agent/integration-dev-002-dev-003`, add the missing adversarial/schema-parity tests, rerun full validation, update the integration handoff to the fix commit, and request independent re-review. Keep DEV-002 and DEV-003 out of `HUMAN_TESTING` until a follow-up review passes.
