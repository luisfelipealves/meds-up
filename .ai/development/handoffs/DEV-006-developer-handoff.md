---
task: DEV-006
status: IMPLEMENTED
branch: agent/dev-006-ocr-proposal-adapter
worktree: /home/felipe/projetos/meds-up-worktrees/dev-006-ocr-proposal-adapter
implementation_commit: 8f6d2d1746f6b4d58e756bfbcb59685f94b3d982
implemented_at: 2026-11-05T13:14:18Z
architecture_gate: .ai/development/decisions/TD-001-production-health-data-processing-gate.md
---

# Developer handoff — DEV-006

## Implementation

- Added a provider-neutral `createOcrProposalAdapter` over an injected extraction
  port. Enabling it requires an exact closed control object with both
  `retentionDisabled: true` and `trainingDisabled: true`.
- The adapter accepts only a bounded mutable UTF-8 response, parses an exact
  three-field structure, copies the validated structure, and zeroes every raw
  response byte in `finally` before its promise settles. Provider failures and
  malformed/malicious responses become fixed content-free errors.
- Added `createOcrProposalReviewSession`, an in-memory lifecycle bound at
  construction to one trusted doctor owner and active review session. Every
  operation rechecks the trusted owner/session boundary.
- Proposals are contract-validated as `SESSION_ONLY_UNTRUSTED`, include closed
  `OCR_AI_EXTRACTION`/`SESSION_ONLY` provenance and bounded overall confidence,
  and expose no confirmation, persistence, recovery, or reminder operation.
- Expiry during processing, expiry after delivery, abandonment, completion, and
  reload clear the proposal and permanently end that lifecycle. Failure leaves
  no proposal and permits a safe retry while the lifecycle remains active.
- Extended the existing content-free structured logger with closed proposal
  completion, failure, and discard events. Logs carry no owner/session ID,
  document content, OCR text, medication content, or provider detail.
- Added a deterministic local fake only under backend test support. No provider
  implementation, network call, credential, real document, or production path
  was added.

## Exact files changed in implementation commit

- `apps/backend/package.json`
- `apps/backend/src/observability/structured-logger.mjs`
- `apps/backend/src/proposals/ocr-proposal-adapter.mjs`
- `apps/backend/test/ocr-proposal-adapter.test.mjs`
- `apps/backend/test/support/deterministic-ocr-extractor.mjs`
- `packages/contracts/schemas/v1/contracts.schema.json`
- `packages/contracts/src/index.mjs`
- `packages/contracts/test/contracts.test.mjs`
- `packages/contracts/test/schema.test.mjs`

Workflow artifacts in the following handoff/task-state commit:

- `.ai/development/tasks/DEV-006-add-ocr-proposal-adapter.md`
- `.ai/development/handoffs/DEV-006-developer-handoff.md`

## Commits

- Implementation: `8f6d2d1746f6b4d58e756bfbcb59685f94b3d982`
- The task-state/handoff artifact commit is the commit containing this file and
  follows the implementation commit on the same branch; it does not amend the
  reachable implementation commit.

## TDD evidence

- Contract fixtures were changed first and failed because provenance/confidence
  were unknown fields.
- The focused backend test was added before production code and failed with
  `ERR_MODULE_NOT_FOUND` for the absent proposal adapter after `npm ci` installed
  the exact lockfile dependencies with zero vulnerabilities.
- Minimal contract and adapter/session implementations then made the focused
  cases green. Content-free observability was added and exercised before final
  validation.

## Validation results

- `node --test test/ocr-proposal-adapter.test.mjs` from `apps/backend` —
  **PASSED 9/9**.
- `npm test -w @medsup/backend` — **PASSED 47/47**.
- `npm test -w @medsup/contracts` — **PASSED 14/14**.
- Backend and contracts builds/lint plus backend static check — **PASSED**.
- `ANDROID_HOME=/home/felipe/.hermes/cache/scratch/android-sdk ANDROID_SDK_ROOT=/home/felipe/.hermes/cache/scratch/android-sdk ./scripts/validate.sh`
  — **PASSED** all Node builds/tests/lint/static checks, backend 47/47, PWA 2/2,
  contracts 14/14, and Android/Wear assemble, unit-test, lint, and check tasks.
- `git diff --check` — **PASSED**.
- Explicit source scans over the production proposal adapter for filesystem,
  HTTP/network, environment/credential, browser/durable persistence, concrete
  provider, confirmation, and reminder paths — **PASSED with zero matches**.
- The staged implementation diff was inspected before commit; it contains the
  nine listed implementation/test/contract files only.

## Acceptance evidence

- Deterministic success proves lifecycle, review-session binding, closed
  provenance/confidence, raw-byte zeroing before settlement, and absence of any
  confirmation/reminder method.
- Invalid/malicious response tests prove unknown confirmation-like data is
  rejected and raw bytes are zeroed.
- Failure-then-success proves fixed content-free errors and retry safety.
- Separate tests cover expiry while extraction is pending and after delivery,
  plus explicit abandonment, completion, reload, and permanent no-recovery.
- Cross-owner tests prove another authenticated doctor receives only a fixed
  not-found result and cannot read or run the lifecycle.
- Structured-log assertions prove successful delivery and discard emit only
  closed operational categories without session, owner, or clinical content.
- Shared schema/runtime tests prove proposal provenance/confidence are closed and
  confidence is bounded to `[0, 1]`.

## Architecture boundary and known issues

- TD-001 remains `OPEN`. This implementation is local and provider-neutral. It
  does not select or connect OpenAI or any provider, use credentials, make API
  or network calls, process a real prescription, create ingress/deployment/data
  paths, or approve Vercel, Supabase, OpenAI, a region, network, key, or provider
  contract.
- DEV-005 source-document gateway and dedicated worker were not modified, so its
  timeout containment, worker termination, and source-discard properties remain
  intact. This proposal adapter handles only the injected extractor's mutable
  raw response boundary; production composition with an approved isolated
  processor remains blocked by TD-001.
- The shared v1 proposal contract now requires provenance and confidence. No
  production client consumes this pre-confirmation contract yet, but downstream
  integration must adopt the extended required shape.
- No persistence or recovery exists by design. A process restart or newly
  constructed lifecycle has no proposal to recover.

## Integration notes

- Integrate implementation commit
  `8f6d2d1746f6b4d58e756bfbcb59685f94b3d982` and the following workflow
  artifact commit at branch HEAD without amendment.
- Inject only a provider-neutral extraction port and the existing trusted
  subject/active-review-session authorization boundary. Do not accept owner ID
  from transport or extracted output.
- Keep the adapter behind DEV-005's isolated source-document processing boundary
  in later composition; do not weaken worker containment or source discard.
- Keep TD-001 open. Integration/review of this local code does not authorize a
  provider, credentials, network, deployment, production health-data path, or
  real document.
- DEV-007 was not started. No `.ai/backups`, `main`, other worktree, remote, or
  deployment path was touched.
