---
task: DEV-003
status: IMPLEMENTED
branch: agent/dev-003-identity-foundation
worktree: /home/felipe/projetos/meds-up-worktrees/dev-003-identity-foundation
implementation_commit: 3df837243492274ee3975b278c728295dc692376
implemented_at: 2026-11-03T15:50:44Z
---

# DEV-003 developer handoff

## Implementation

Implemented the provider-neutral backend identity/session foundation under `apps/backend`:

- explicit branded doctor and patient authenticated subjects with role enforcement;
- provider-neutral authentication port and deterministic fake using reserved `.invalid` test identities;
- provider-neutral error codes and stable error envelope;
- in-memory session/device lifecycle primitives with injected clock/token generation, exact expiry, monotonic revocation versions, and synchronous atomic all-session/all-device revocation;
- synchronization authorization that rejects revoked devices;
- structured allow-listed logging that excludes credential, token, identity, prescription, and medication fields.

No shared contracts package, workspace/package configuration, persistence adapter, real identity vendor, recovery flow, doctor invitation policy, prescription authorization, deployment, or UI was added.

## Files changed

- `.ai/development/tasks/DEV-003-implement-identity-foundation.md`
- `.ai/development/tasks/DEV-019-doctor-invitation-administration.md`
- `.ai/development/technical-plan-PD-001.md`
- `.ai/development/handoffs/DEV-003-developer-handoff.md`
- `apps/backend/src/identity/errors.mjs`
- `apps/backend/src/identity/fake-identity-provider.mjs`
- `apps/backend/src/identity/identity-port.mjs`
- `apps/backend/src/identity/session-manager.mjs`
- `apps/backend/src/identity/subject.mjs`
- `apps/backend/src/observability/structured-logger.mjs`
- `apps/backend/test/identity-foundation.test.mjs`

## Strict TDD evidence

Each behavior was introduced test-first and the focused test was observed failing for the expected missing behavior before implementation:

1. Roles/subjects: `ERR_MODULE_NOT_FOUND` for `src/identity/subject.mjs`.
2. Common error envelope: missing `toErrorEnvelope` export.
3. Replaceable provider/fake identities: `ERR_MODULE_NOT_FOUND` for `fake-identity-provider.mjs`.
4. Session expiry: `ERR_MODULE_NOT_FOUND` for `session-manager.mjs`.
5. Atomic all-session/device revocation: `TypeError: sessions.revokeAll is not a function`.
6. Revoked-device sync rejection: `TypeError: sessions.authorizeSynchronization is not a function`.
7. Structured log filtering: `ERR_MODULE_NOT_FOUND` for `structured-logger.mjs`.
8. Non-forgeable authorization context: `Missing expected exception` for a forged doctor subject.
9. Session subject enforcement: `Missing expected exception` for establishing a session with a forged subject.

Every RED was followed by a focused GREEN run of `node --test test/identity-foundation.test.mjs`; final focused result: 8 passed, 0 failed.

## Validation

Passed:

- `node --test test/identity-foundation.test.mjs` — 8 passed, 0 failed.
- `npm run validate:node` — backend 10 passed, PWA 2 passed, build/lint/root static check passed.
- explicit `node --check` for all new nested backend source files and the new test — passed.
- `make static-check` — backend/PWA checks passed; Android and Wear `check` tasks passed after setting ignored `local.properties` to the provided SDK path.
- `git diff --check` and staged diff inspection — passed/no whitespace errors.

The first `make static-check` attempt failed only because `local.properties` did not yet point to the available Android SDK. The ignored file was added locally with `sdk.dir=/home/felipe/.hermes/cache/scratch/android-sdk`; the complete rerun passed.

## Integration notes

DEV-002 concurrently owns the shared contracts package. This branch intentionally defines provider-neutral backend-local role names and error codes without changing root workspace/package files or creating a competing package. During integration, align DEV-003's `ROLES`, `ERROR_CODES`, and `toErrorEnvelope` shape with DEV-002's canonical contracts, using imports from the shared package if its exported API requires that; preserve the tested behavior and do not duplicate contract definitions.

DEV-019 depends only on DEV-003 and may advance to `READY`. Tasks that also require DEV-002 must remain unchanged until integration confirms both dependencies.

## Known issues

- Session/device state is deliberately in memory; persistence/provider selection is outside DEV-003.
- Independent review and integration have not occurred.
