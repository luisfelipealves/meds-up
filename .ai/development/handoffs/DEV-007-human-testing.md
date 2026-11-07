---
task: DEV-007
type: human-testing-handoff
status: HUMAN_TESTING
integration_branch: agent/integration-dev-007
integration_head: 0f39e517670babe0f63e68a65578936124b5032e
base_commit: d6362ae2304e1c20951d8569b2bf4a9f87c105b6
implementation_commit: 2e28ccc1f5f06fe965c340d6ebc9a590effec4cd
remediation_commit: a7cc726ef3102f7203059ecdfbefe6f34f301a4a
independent_rereview: .ai/reviews/DEV-007-independent-rereview.md
review_status: PASS
blocking_findings: 0
non_blocking_findings: 0
prepared_at: 2026-11-07T13:58:26Z
architecture_gate: .ai/development/decisions/TD-001-production-health-data-processing-gate.md
architecture_gate_status: OPEN
merge_status: NOT_MERGED
pushed: false
---

# Human testing handoff — DEV-007

## Gate reason

DEV-007 changes prescription confirmation, immutable clinical versioning, and
suspension/cancellation behavior. This is medication/clinical workflow behavior
and the human explicitly required a gate before merge or push. Automated
validation and independent review do not authorize integration into `main`.

## Approved product scope represented

- PD-001 and PD-008 are `APPROVED_FOR_DEVELOPMENT`.
- Only corrected, explicitly doctor-confirmed content can become a persistent
  prescription/version source.
- Unconfirmed proposals, source documents, raw OCR/AI output, provenance, and
  confidence remain session-only and have no persistence, recovery, logging, or
  reminder-source path in DEV-007.
- Confirmed clinical content is immutable; later clinical corrections append an
  audit-linked version.
- Only the trusted owning doctor can confirm, change, suspend, or cancel.
- Suspension and cancellation produce ordered downstream status events, and
  cancellation is terminal.

## Exact candidate

- Branch: `agent/integration-dev-007`.
- Validated and independently reviewed executable/workflow HEAD:
  `0f39e517670babe0f63e68a65578936124b5032e`.
- Base/main: `d6362ae2304e1c20951d8569b2bf4a9f87c105b6`.
- Initial implementation: `2e28ccc1f5f06fe965c340d6ebc9a590effec4cd`.
- Review remediation: `a7cc726ef3102f7203059ecdfbefe6f34f301a4a`.
- Passing independent rereview and metadata corrections:
  `0f39e517670babe0f63e68a65578936124b5032e`.

The commit containing this handoff will be a workflow-only descendant of that
validated head. The changes after reviewed workflow head
`26816b5ec37b3dc9421e5d446b84d621e70a43f7` are workflow-only: the passing
rereview artifact and correction of an initially mistyped remediation hash. No
runtime, contract, schema, or test implementation changed after independent
rereview.

## Review and remediation

The first independent review found two blockers:

1. review-session completion preceded persistent confirmation and was not an
   explicit atomic boundary; and
2. generated audit identifiers and complete audit records were not validated.

Both were remediated. Confirmation now uses a provider-neutral synchronous
transaction capability that prepares validated state and coordinates commit,
rollback, and session consumption. Failed preparation/persistence leaves no
prescription and permits retry; success persists once and consumes once. A new
closed `PrescriptionAuditRecord` runtime/JSON-Schema contract validates actor,
server time, identifiers, prescription/version/resource linkage, and event
semantics. Generated identifiers are shape-, duplicate-, and collision-checked
before mutation.

The fresh independent rereview at
`.ai/reviews/DEV-007-independent-rereview.md` returned `PASS` with zero blocking
and zero remaining non-blocking findings.

## Automated validation

The complete writable suite passed on the remediated executable tree:

- `npm run test` — backend 60/60, PWA 2/2, contracts 16/16.
- `npm run lint` — passed.
- `npm run build` — passed.
- `make test` — passed, including Android and Wear unit tests.
- `make lint` — passed, including Android and Wear lint.
- `make build` — passed, including Android and Wear debug assembly.
- `ANDROID_HOME=/home/felipe/.hermes/cache/scratch/android-sdk
  ANDROID_SDK_ROOT=/home/felipe/.hermes/cache/scratch/android-sdk
  ./scripts/validate.sh` — passed every Node build/test/lint/static check and all
  Android/Wear assemble, unit-test, lint, and check tasks.
- `git diff --check` — passed.

The independent rereviewer separately passed focused backend/contracts tests,
the complete Node test suite, syntax checks, deterministic rollback and async
boundary probes, and base-to-reviewed-head diff checks.

## Human validation instructions

DEV-007 has no doctor UI in scope, so the gate is a behavior and evidence review
rather than an end-user screen walkthrough.

1. Review the exact candidate diff:
   `git diff d6362ae2304e1c20951d8569b2bf4a9f87c105b6..0f39e517670babe0f63e68a65578936124b5032e`.
2. Read the focused behavior tests in
   `apps/backend/test/prescription-confirmation.test.mjs`.
3. Confirm the intended clinical rules:
   - explicit owning-doctor confirmation is the only creation path;
   - failed confirmation leaves the review session retryable and persists
     nothing;
   - successful confirmation stores corrected content only;
   - changes append immutable audit-linked versions;
   - stale/concurrent changes permit one expected-version winner;
   - suspension/cancellation emits downstream status events; and
   - cancellation prevents later clinical or status mutation.
4. Optionally rerun the focused evidence from the integration worktree:
   `node --test apps/backend/test/prescription-confirmation.test.mjs` and
   `npm test -w @medsup/contracts`.
5. Confirm that the local/provider-neutral transaction boundary is acceptable
   for DEV-007 while any durable production adapter remains a future gated
   obligation.

## TD-001 boundary and limitations

TD-001 remains `OPEN`. This candidate does not select or connect a real provider,
use credentials, make API/network calls, process a real prescription document or
real health data, create production persistence/ingress/deployment, or decide a
provider, region, network, key-management, backup, or retention path. The
repository is in-memory and deterministic for local/domain validation. A future
durable adapter must implement one real transaction covering review-session
consumption and prescription/version/audit persistence; two separately ordered
calls are not acceptable.

## Required human decision

Choose one explicit action for the exact `agent/integration-dev-007` HEAD named
in the accompanying HTP `HUMAN_DECISION_REQUIRED` event. That head contains
validated candidate `0f39e517670babe0f63e68a65578936124b5032e` plus only this
human-testing handoff and task metadata:

- approve DEV-007 for a normal fast-forward-safe merge into `main` and normal
  push to `origin/main` while keeping TD-001 `OPEN`; or
- reject/request changes and identify the behavior or evidence that must change.

## Merge status

`NOT MERGED — awaiting explicit human approval.`

No push, deployment, provider operation, credential use, real-health-data
operation, other DEV task, branch deletion, or worktree deletion occurred.
