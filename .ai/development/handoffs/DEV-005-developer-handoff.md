---
task: DEV-005
status: IMPLEMENTED
branch: agent/dev-005-ephemeral-ingestion
worktree: /home/felipe/projetos/meds-up-worktrees/dev-005-ephemeral-ingestion
implementation_commit: 1dc6fbf835c1667b982d5bd55b94cb915ffc1d74
implemented_at: 2026-11-05T09:53:41Z
architecture_gate: .ai/development/decisions/TD-001-production-health-data-processing-gate.md
---

# Developer handoff — DEV-005

## Implementation

- Added an in-process, dependency-free `createEphemeralDocumentGateway` behind
  an exported backend subpath. There is no HTTP route or server.
- Requires a trusted DEV-003 authenticated doctor subject and an injected
  active-review-session authorizer. The gateway derives `ownerDoctorId` from
  the trusted subject and passes it with `reviewSessionId` only to the injected
  processor handoff; caller-supplied ownership is not accepted.
- Added local declared-MIME/signature validation for `application/pdf`,
  `image/jpeg`, and `image/png`. Mismatches, unsupported input, truncation,
  active PDF script markers, malformed basic structures, and empty input fail
  before processor handoff.
- Added configurable conservative defaults: 8 MiB source bytes, 20 PDF pages,
  and 20 million image pixels, with positive-safe-integer configuration checks.
- Copies validated input into a private working `Uint8Array`, passes only that
  copy to the processor port, aborts the operation at a bounded timeout, and
  zeroes the copy in `finally` after completion, failure, or timeout. Caller
  input is not mutated.
- Added a deterministic test-only processor fake for completion, failure, and
  wait-for-abort behavior. It makes discard observable without implementing
  OCR, proposals, a provider, or network access.
- Expanded the existing structured logger with closed ingestion event/action,
  outcome, media-family, and failure-category allow-lists. No doctor/session
  identifiers, filenames, source bytes, content, OCR text, processor reference,
  or provider details are accepted or emitted by the gateway audit path.
- Added TD-001 as an `OPEN` Architecture Decision Gate covering production
  backend/deployment, OCR provider, EU/Portugal-compatible residency, network
  boundary, KMS/secrets, provider retention/training terms, options,
  recommendation, cost/lock-in, affected tasks, and the narrow production
  blocking boundary.

## Files changed

- `apps/backend/src/ingestion/ephemeral-document-gateway.mjs`
- `apps/backend/src/observability/structured-logger.mjs`
- `apps/backend/test/ephemeral-document-ingestion.test.mjs`
- `apps/backend/test/support/deterministic-document-processor.mjs`
- `apps/backend/package.json`
- `.ai/development/decisions/TD-001-production-health-data-processing-gate.md`
- `.ai/development/tasks/DEV-005-secure-source-document-ingestion.md`
- `.ai/development/handoffs/DEV-005-developer-handoff.md`

## TDD evidence

1. The focused test was written first. The initial run was blocked because this
   new worktree had no installed workspace links; `npm ci` installed the exact
   lockfile with zero reported vulnerabilities.
2. The next focused run failed with `ERR_MODULE_NOT_FOUND` for the absent
   `src/ingestion/ephemeral-document-gateway.mjs`, providing the intended RED.
3. The gateway and deterministic fake were added. The first GREEN attempt
   passed PDF/JPEG behavior and exposed four PNG-fixture failures; the test
   fixture lacked the IHDR CRC bytes and was corrected to represent the intended
   PNG structure.
4. The focused suite then passed 9/9. Closed structured audit events, a trusted
   patient role negative, independently exercised page/byte/pixel limits, and
   rejection/failure/timeout audit tests were added; the final focused suite
   passed 10/10.

## Validation

- `node --test test/ephemeral-document-ingestion.test.mjs` — **PASSED**, 10/10.
- `npm test -w @medsup/backend` — **PASSED**, 34/34.
- `npm run lint -w @medsup/backend` — **PASSED**, including nested ingestion,
  authorization, identity, observability, and test-support modules.
- `ANDROID_HOME=/home/felipe/.hermes/cache/scratch/android-sdk ANDROID_SDK_ROOT=/home/felipe/.hermes/cache/scratch/android-sdk ./scripts/validate.sh`
  — **PASSED** all Node builds, 34 backend tests, 2 PWA tests, 13 contract tests,
  lint/static checks, and Android/Wear assemble, unit-test, lint, and check
  commands.
- `git diff --check` — **PASSED**.
- Explicit source scan for filesystem/network calls, public URLs, durable write
  APIs, database/bucket/queue/cache paths, environment credentials, and secrets
  in the ingestion implementation — **PASSED**, zero matches.
- Full staged implementation diff and workflow artifacts were inspected before
  commit.

## Acceptance evidence

- Valid PDF/JPEG/PNG inputs reach only the injected provider-neutral processor
  after trusted doctor and active owned-session authorization.
- Cross-doctor, forged-subject, trusted-patient, unsupported, mismatched,
  truncated, polyglot-like, over-byte, over-page, and over-pixel cases are
  rejected before handoff with content-free errors.
- Completion, processor failure, and timeout/abort tests all observe the private
  working source buffer zeroed; timeout produces no processor reference.
- Tests inspect successful, rejected, failed, and timed-out structured audit
  entries and prove they contain only bounded non-clinical categories.
- A source guard proves the implementation contains no filesystem, network,
  URL, durable queue, cache, bucket, or database path. Repository build output
  is generated code packaging only and is ignored; source input is never
  written there.

## Known issues and blocking boundary

- TD-001 is `OPEN`. No production backend/deployment model, real OCR processor,
  approved EU region, private network boundary, KMS/secrets design, or verified
  provider retention/training terms has been selected. This blocks all real
  health-data operation, deployment, concrete provider adapters, credentials,
  and network calls. Local provider-neutral tests may proceed.
- These local signature/structure checks are a pre-handoff rejection boundary,
  not a full document renderer, malware scanner, sandbox, or production content
  isolation control. Production parser isolation and transport protection must
  be resolved under TD-001 before activation.
- The gateway can zero the buffer it owns and signals timeout through
  `AbortSignal`; a future concrete processor must not copy/retain input beyond
  the call and must prove provider-side deletion/retention behavior. No such
  processor exists in this change.
- DEV-006 remains `PLANNED` and was not started. No OCR output, unconfirmed
  proposal, clinical confirmation, or proposal persistence was implemented.

## Integration notes

- Integrate implementation commit
  `1dc6fbf835c1667b982d5bd55b94cb915ffc1d74` plus the following workflow
  handoff commit at branch HEAD.
- Wire `authorizeReviewSession` to DEV-004's trusted doctor-ownership service;
  do not accept an owner ID from a transport payload.
- Any later processor must implement `process({ input, mimeType, signal,
  context })`, treat input as borrowed ephemeral memory, honor abort, create no
  durable retry, and return no provider reference through this gateway.
- Keep TD-001 open through integration. Integration or review of this local
  implementation does not approve a provider, deployment, real document,
  production credential, or health-data operation.
- No `.ai/backups`, other worktree, `main`, remote, deployment, durable store,
  real provider, production secret/KMS, or real health data was touched.
