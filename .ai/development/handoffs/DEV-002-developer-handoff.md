---
task: DEV-002
status: IMPLEMENTED
branch: agent/dev-002-core-contracts
worktree: /home/felipe/projetos/meds-up-worktrees/dev-002-core-contracts
commit: da1bd862ff78629367dcb024c687ea6cd63a35f0
completed_at: 2026-11-03T15:51:27Z
---

# Developer handoff — DEV-002

## Files changed

- Contract workspace: `packages/contracts/package.json`, `packages/contracts/src/index.mjs`
- Published schemas/docs: `packages/contracts/schemas/v1/contracts.schema.json`, `packages/contracts/README.md`
- Contract tests: `packages/contracts/test/contracts.test.mjs`, `packages/contracts/test/schema.test.mjs`
- Workspace integration: `package.json`, `package-lock.json`, `README.md`
- Workflow state: `.ai/development/tasks/DEV-002-define-core-domain-contracts.md`, `.ai/development/tasks/DEV-011-implement-scheduling-constraints.md`, `.ai/development/technical-plan-PD-001.md`, this handoff

## Implementation

- Added dependency-free, provider-neutral v1 validators, serializers, route conventions, a compatibility response parser, and JSON Schema 2020-12 definitions.
- Kept ephemeral document request metadata, session-only untrusted proposals, explicit doctor confirmation, confirmed prescriptions, immutable confirmed versions, and non-clinical audit references as separate contract types.
- Added opaque identifier, offset timestamp, ownership, lifecycle/status, prescription/resource/server version, idempotency, optimistic-concurrency, suspension/cancellation event, historical version retrieval, and stable content-free error conventions.
- Requests are closed to unknown fields; v1 response parsing ignores unknown additive fields while retaining all required-field and enum checks.
- Preserved PD-008: there is no source-document/OCR/proposal locator, repository, recovery, durable message, browser persistence, logging, analytics, trace, provider payload, or raw output field. No contract transports private patient reminder-response history.
- Kept scheduling semantics out of the package; DEV-011 is now `READY` because DEV-002 was its only dependency.

## Strict TDD evidence

Each executable contract behavior was introduced test-first and observed failing for the expected missing behavior before minimal implementation:

1. Ephemeral input tests failed with `ERR_MODULE_NOT_FOUND` for the absent contract module, then passed after the first validator.
2. Session-only proposal tests failed because `validateUntrustedPrescriptionProposal` was not exported, then passed after implementation.
3. Explicit confirmation tests failed because `validateDoctorConfirmationCommand` was not exported, then passed after implementation.
4. Confirmed prescription/version tests failed because `validateConfirmedPrescription` was not exported, then passed after implementation.
5. Status command/event tests failed because `validatePrescriptionStatusCommand` was not exported, then passed after implementation.
6. Retrieval/serialization compatibility tests failed because `parsePrescriptionVersionResponse` was not exported, then passed after implementation.
7. Audit/error tests failed because `createErrorEnvelope` was not exported, then passed after implementation.
8. Published-schema tests failed with `ENOENT` for `schemas/v1/contracts.schema.json`, then passed after adding the closed v1 schema bundle.

The focused suite was rerun after every GREEN step and remained green through refactoring/documentation.

## Validation

Environment: Node `26.7.0`, npm `11.19.0`, Android SDK `/home/felipe/.hermes/cache/scratch/android-sdk`.

- `npm test -w @medsup/contracts` — **PASSED**, 10 tests.
- `npm run build -w @medsup/contracts && npm run lint -w @medsup/contracts` — **PASSED**.
- `ANDROID_HOME=/home/felipe/.hermes/cache/scratch/android-sdk ANDROID_SDK_ROOT=/home/felipe/.hermes/cache/scratch/android-sdk ./scripts/validate.sh` — **PASSED** all root Node build/test/lint/static checks and Android/Wear assemble, unit-test, lint, and check commands.
- `git diff --check` — **PASSED**.
- Privacy field scans over runtime contracts and published schemas — **PASSED**, no prohibited persistence/recovery/provider/telemetry/private-response contract terms found.
- Pre-commit security pattern scan over the contract package — **PASSED**, no credential assignment, dynamic execution, shell injection, unsafe deserialization, or DOM injection pattern found.

## Known issues

- None in DEV-002 scope.
- The shared contracts intentionally do not implement persistence, provider integration, transport handlers, identity behavior, scheduling grammar, clients, or deployment.

## Integration notes

- Integrate implementation commit `da1bd862ff78629367dcb024c687ea6cd63a35f0` plus the following workflow-state/handoff commit at branch HEAD.
- DEV-003 may continue independently; it should consume ownership/doctor identifiers without moving backend identity implementation into this package.
- DEV-011 may branch from the integrated DEV-002 contract surface and add scheduling grammar without changing the privacy boundary.
- DEV-004 remains `PLANNED` because DEV-003 is still unresolved; no other downstream task was advanced.
- No `.ai/backups`, other worktree, protected branch, GitHub resource, deployment, or provider configuration was touched.
