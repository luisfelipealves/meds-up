---
task: DEV-008
status: IMPLEMENTED
branch: agent/dev-008-claim-token-lifecycle
worktree: /home/felipe/projetos/meds-up-worktrees/dev-008-claim-token-lifecycle
implementation_commit: db84d511605ada98976a528743cccef89477d2c8
workflow_commit: this file's commit
implemented_at: 2026-11-07T15:06:10Z
architecture_gate: .ai/development/decisions/TD-001-production-health-data-processing-gate.md
---

# Developer handoff — DEV-008

## Implementation

- Added a provider-neutral claim-token lifecycle service using Node's cryptographic `randomBytes(32)` and unpadded base64url to produce a 256-bit opaque QR payload. The only raw-secret output is the one-time `qrPayload`; the service builds no URL.
- Added SHA-256 digest-only token lookup/storage. Owner control projections omit both raw tokens and digests, while the in-memory repository persists only the digest and bounded lifecycle metadata.
- Issuance sets `expiresAt` to exactly `issuedAt + 604800000ms` (seven 24-hour days). Consumption rejects at `now >= expiresAt` with one content-free error shared by malformed, unknown, expired, revoked, replaced, consumed, and rate-limited attempts.
- Reused DEV-003 trusted authenticated subjects and explicit doctor/patient role guards. Initial issuance calls an injected trusted prescription-ownership authority; reads, lists, revocation, and replacement enforce the stored doctor owner and preserve content-free cross-owner `NOT_FOUND` behavior.
- Added atomic synchronous repository transitions for issue, revoke, replace, and consume. Consumption validates rate state, digest lookup, expiry, lifecycle state, single use, attempt audit, and final status in one rollback-capable boundary; concurrent/replayed attempts can produce at most one success.
- Every authenticated patient consume attempt is audited with a server-controlled attempt ID, actor, bounded outcome, optional internal token ID, and server time. No raw token or digest is written to attempt records.
- Added per-trusted-patient failed-attempt rate limiting with an injected policy (default five failures per 15-minute rolling window). Rate-limit failures are audited without token lookup/linkage, and separate patient identities remain isolated.
- Revocation atomically invalidates an active token. Replacement atomically marks the old token `REPLACED`, links only the new non-secret control ID, creates a fresh random secret/digest, and starts a fresh exact seven-day lifetime.
- Added repository fault injection for deterministic transaction tests; a failed commit restores tokens, digest indexes, and audit records so a retry can complete once.
- DEV-009 date-of-birth confirmation, DEV-010 patient-prescription association, client/UI work, durable adapters, and production operation were not implemented.

## Files changed

Implementation commit `db84d511605ada98976a528743cccef89477d2c8`:

- `apps/backend/src/claims/claim-token-lifecycle.mjs`
- `apps/backend/test/claim-token-lifecycle.test.mjs`
- `apps/backend/package.json`

Workflow commit containing this handoff:

- `.ai/development/tasks/DEV-008-implement-claim-token-lifecycle.md`
- `.ai/development/handoffs/DEV-008-developer-handoff.md`

## TDD evidence

- The complete focused test file was written before the production module.
- The first focused run was blocked by missing isolated-worktree workspace dependencies. After `npm ci --ignore-scripts`, the focused test was observed RED with `ERR_MODULE_NOT_FOUND` for `src/claims/claim-token-lifecycle.mjs`.
- The initial implementation produced 7/9 passing tests. Owner negative testing exposed a synchronous assertion mismatch, and the exact rate-window boundary exposed an inclusive-cutoff defect; both were corrected before final validation.
- Final focused result: **9/9 passed**.

## Validation

Environment: Node `26.7.0`, npm `11.19.0`, Android SDK `/home/felipe/.hermes/cache/scratch/android-sdk`.

- `npm ci --ignore-scripts` — **PASSED**, 11 packages audited, 0 vulnerabilities.
- `node --test test/claim-token-lifecycle.test.mjs` from `apps/backend` — **PASSED 9/9**.
- `npm run test` — **PASSED**: backend 69/69, PWA 2/2, contracts 16/16.
- `npm run lint` — **PASSED**.
- `npm run build` — **PASSED**.
- `make test` with the scratch Android SDK — **PASSED**, including backend/PWA and Android/Wear unit tests.
- `make lint` with the scratch Android SDK — **PASSED**, including Android/Wear lint.
- `make build` with the scratch Android SDK — **PASSED**, including Android/Wear debug assembly.
- `ANDROID_HOME=/home/felipe/.hermes/cache/scratch/android-sdk ANDROID_SDK_ROOT=/home/felipe/.hermes/cache/scratch/android-sdk ./scripts/validate.sh` — **PASSED** all Node build/test/lint/static checks and all Android/Wear assemble, unit-test, lint, and check tasks.
- `git diff --check` — **PASSED** before the implementation commit and for workflow evidence.
- The implementation diff and branch status were inspected. A source scan found no filesystem, HTTP/network, environment/credential, provider, logger/telemetry, URL construction, production persistence, or deployment path.

## Acceptance evidence

- Randomness/configuration tests assert 43-character 256-bit base64url payloads, distinct default-generated secrets, SHA-256 digest derivation, exact seven-day millisecond expiry, and absence of raw/QR fields from persistence.
- Expiry tests cover one millisecond before expiry, exact expiry, and one millisecond after expiry.
- Revocation/replacement tests prove old tokens cannot consume, replacement creates a new opaque secret and fresh seven-day lifetime, and only the replacement can consume.
- Replay/concurrency tests run two patient consumes together and prove exactly one success; later replay remains rejected and audited.
- Rollback/retry tests inject a consume commit failure, prove token and audit state fully restore, then prove one successful retry.
- Rate-limit tests cover threshold enforcement, rate-limited auditing, patient isolation, and reset at the exact rolling-window boundary.
- Owner-isolation tests cover issuance authority, direct control reads, lists, revocation, and replacement across two doctors.
- Leakage tests inspect owner projections, repository token/attempt snapshots, serialized errors including stack, key names, and output shape; raw secrets are absent from persistence, errors, logs/telemetry fields, and URLs. The sole raw-secret output is `qrPayload`.

## Known issues

- None in DEV-008 scope.
- The repository is intentionally provider-neutral and in-memory. A durable transactional adapter must preserve the same atomic multi-index/audit rollback behavior, digest-only storage, owner predicates, exact expiry comparison, rate policy, and single raw-secret delivery boundary.
- DEV-009 must perform masked identity/date-of-birth confirmation before invoking consumption. DEV-010 must add patient-prescription association without weakening this single-use transaction boundary; neither behavior is claimed here.

## Integration notes

- Integrate implementation commit `db84d511605ada98976a528743cccef89477d2c8` and the following workflow commit containing this handoff without amendment.
- Inject `authorizePrescriptionOwnership` from the trusted DEV-004/DEV-007 prescription ownership surface; never derive owner authority from a transport payload.
- Treat `qrPayload` as a one-time secret response. Do not place it in query parameters, persisted command/event objects, logs, telemetry, analytics, traces, referrers, or crash reports.
- Keep the consume call behind DEV-009's successful trusted confirmation. DEV-010 integration must coordinate association and token consumption in one durable transaction rather than consuming first and associating later.
- Preserve generic claim failures externally; repository attempt outcomes are internal audit data and must not become an enumeration surface.

## TD-001 boundary

TD-001 remains `OPEN`. This implementation uses only provider-neutral interfaces, an in-memory repository, local cryptographic primitives, synthetic identities/data, and deterministic tests. It does not select or connect a provider, use credentials, make API/network calls, receive real documents or health data, create production persistence/ingress/deployment, activate production, or decide a region, network, key-management, backup, or provider-retention path. Integration and review do not authorize those blocked production paths.
