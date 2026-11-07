---
task: DEV-008
status: IMPLEMENTED
remediation: B1
branch: agent/integration-dev-008
worktree: /home/felipe/projetos/meds-up-worktrees/integration-dev-008
remediated_at: 2026-11-07T15:16:09Z
remediation_commit: 25ccea1c27c8ac04a203318cd33cc1bf0176bee5
independent_review: .ai/reviews/DEV-008-independent-review.md
architecture_gate: .ai/development/decisions/TD-001-production-health-data-processing-gate.md
---

# DEV-008 review remediation handoff

## B1 remediation

`replace()` now validates the injected clock once into one operation timestamp
and passes that same value to replacement issuance and the atomic repository
transition. The replacement record therefore uses one timestamp for
`issuedAt`/`expiresAt`, while the replaced record uses it for `replacedAt`.

The deterministic regression test supplies distinct successive clock values for
initial issue and replacement, verifies the replacement operation timestamp is
used exactly, verifies `expiresAt - replacedAt` is exactly
`CLAIM_TOKEN_TTL_MS` (seven 24-hour days), and verifies the clock is called only
once per operation.

## Scope preservation

The remediation changes only replacement timestamp capture and its focused
test. Owner authorization, digest-only persistence, raw-secret delivery,
content-free claim failures, audit behavior, rate limiting, atomicity,
single-use/replay behavior, TD-001, and all out-of-scope boundaries remain
unchanged.

N1 is non-blocking and was not expanded into an adapter change. The existing
concurrency behavior relies on synchronous in-memory repository operations
being serialized within the JavaScript execution turn; the `Promise.allSettled`
test therefore verifies serialized replay behavior. A future durable adapter
must provide the equivalent atomic/interleaving contract.

## Validation evidence

- `node --test apps/backend/test/claim-token-lifecycle.test.mjs` — PASSED, 10/10.
- `npm run test` — PASSED: backend 70/70, PWA 2/2, contracts 16/16.
- `npm run lint` — PASSED.
- `npm run build` — PASSED.
- `make test` — PASSED, including Android and Wear unit tests.
- `make lint` — PASSED, including Android and Wear lint.
- `make build` — PASSED, including Android and Wear debug assembly.
- `ANDROID_HOME=/home/felipe/.hermes/cache/scratch/android-sdk ANDROID_SDK_ROOT=/home/felipe/.hermes/cache/scratch/android-sdk ./scripts/validate.sh` — PASSED all Node and Android/Wear build, test, lint, static, assemble, and check phases.
- `git diff --check` — PASSED.

The remediation source/test diff is clean and limited to:

- `apps/backend/src/claims/claim-token-lifecycle.mjs`
- `apps/backend/test/claim-token-lifecycle.test.mjs`

## Workflow note

The focused remediation is committed as
`25ccea1c27c8ac04a203318cd33cc1bf0176bee5`. No merge or push was attempted.
