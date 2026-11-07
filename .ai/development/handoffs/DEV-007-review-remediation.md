---
task: DEV-007
status: REMEDIATED_PENDING_REREVIEW
overall_status: INTEGRATED
review_status: REMEDIATED_PENDING_REREVIEW
blocking_findings_remaining: 0
remediation_commit: a7cc7261c31f1bfae96c08e6783664c079b7bbfa
remediated_at: 2026-11-07T13:52:24Z
architecture_gate: .ai/development/decisions/TD-001-production-health-data-processing-gate.md
---

# DEV-007 review remediation handoff

## Findings resolved

- B1: confirmation no longer completes the ephemeral review session before
  persistence. The service requires an explicit `synchronous: true`
  `confirmAtomically` capability. It authorizes the active session, prepares
  all repository state without mutation, and coordinates commit/rollback with
  session consumption. Failed preparation or persistence leaves no prescription
  and leaves the session retryable. Successful confirmation persists once and
  consumes the session once; replay uses the idempotency result, and concurrent
  different-key attempts produce one prescription.
- B2: every generated identifier is checked for opaque-ID shape, duplicate
  values, and collisions with prior prescription/audit/correlation/status-event
  identifiers before commit. The new closed `PrescriptionAuditRecord` runtime
  contract validates actor, server time, event/outcome, IDs, prescription,
  version, previous-version, and resource linkage. The matching JSON Schema is
  tested for runtime/schema parity. It is intentionally distinct from the
  narrower `AuditReference` contract.

## Exact files changed

- `apps/backend/src/prescriptions/prescription-confirmation.mjs`
- `apps/backend/test/prescription-confirmation.test.mjs`
- `packages/contracts/src/index.mjs`
- `packages/contracts/schemas/v1/contracts.schema.json`
- `packages/contracts/test/contracts.test.mjs`
- `packages/contracts/test/schema.test.mjs`
- `packages/contracts/README.md`

## Atomicity contract

`confirmationBoundary.confirmAtomically` is a provider-neutral synchronous
transaction capability. The callback passed to it must only prepare state and
return `{ result, commit, rollback }`; it must not mutate session or repository
state during preparation. The capability must validate/consume the active
session and commit the prepared repository state as one transaction, restoring
both sides on failure. Async functions and malformed capabilities are rejected
before use. A future durable adapter must implement the same obligation with a
real transaction covering the session-consumption and prescription/version/audit
writes; two separately ordered calls are not an acceptable adapter.

## Generated-ID and audit validation

Focused adversarial tests cover malformed audit IDs, malformed clocks,
duplicate/colliding generated IDs, audit actor/time/linkage failures, and
failure atomicity. Successful audit records assert prescription, version, and
resource linkage. JSON Schema fixtures and executable validators cover the new
complete audit contract; cross-field version linkage remains an explicit runtime
rule because JSON Schema cannot express it directly.

## Tests and evidence

- Focused backend and contract/schema suites: passed (backend 60/60; contracts
  16/16 in the complete run).
- `npm run test`: passed (backend 60/60, PWA 2/2, contracts 16/16).
- `npm run lint`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- `make test`, `make lint`, and `make build`: passed, including Android and Wear
  unit tests, lint, and debug assembly.
- `ANDROID_HOME=/home/felipe/.hermes/cache/scratch/android-sdk
  ANDROID_SDK_ROOT=/home/felipe/.hermes/cache/scratch/android-sdk
  ./scripts/validate.sh`: passed every Node build/test/lint/static check and all
  Android/Wear assemble, unit-test, lint, and check tasks.

## TD-001 boundary and known issues

TD-001 remains `OPEN`. No provider, adapter choice, credentials, network/API,
real document or health data, production persistence/deployment, or
region/network/key decision was introduced. The in-memory repository and
deterministic synthetic tests remain local/provider-neutral. The parent
coordinator reran the complete writable suite and committed the focused
implementation as `a7cc7261c31f1bfae96c08e6783664c079b7bbfa`.

## Rereview instructions

Independent review must inspect exact implementation commit
`a7cc7261c31f1bfae96c08e6783664c079b7bbfa` plus the following workflow-only
commit containing this handoff, and verify B1/B2, focused adversarial tests,
the full diff, and validation evidence. Keep overall status `INTEGRATED`; do
not merge or push. Do not begin the human gate until the fresh independent
rereview approves the exact remediation head.
