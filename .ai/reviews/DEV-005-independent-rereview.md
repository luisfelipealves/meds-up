---
task: DEV-005
type: independent-rereview
status: CHANGES_REQUIRED
reviewed_commit: 5300bc59fc93762165d461553d57953e28241c02
reviewer: hermes-agent-independent-rereviewer
reviewed_at: 2026-11-05T11:51:06Z
blocking_findings: 2
non_blocking_findings: 1
prior_blockers_resolved: 1
prior_blockers_unresolved: 2
architecture_gate: .ai/development/decisions/TD-001-production-health-data-processing-gate.md
---

# Independent re-review — DEV-005 remediation

## Verdict

`CHANGES_REQUIRED`. Exact commit
`5300bc59fc93762165d461553d57953e28241c02` still has two blocking findings.
The authorization-error remediation resolves prior blocker B2, but the timeout
lifecycle does not handle an ignored abort and the replacement PNG fixture is
still not a valid decodable PNG image. Prior blockers B1 and B3 therefore are
not fully resolved.

TD-001 remains `OPEN`. This review does not approve architecture, merge,
deployment, a provider, a network path, production activation, or real
health-data processing. DEV-006 remains `PLANNED`, unassigned, and unstarted.

## Exact scope and repository state

- Reviewed branch: `agent/integration-dev-005`.
- Reviewed commit: `5300bc59fc93762165d461553d57953e28241c02`.
- Remediation commit inspected: `f06c4b42eec53bba7224b0cb87307b9b81240afe`.
- Base, `main`, and `origin/main` remained
  `3565d40b6e133bf25c2518ff54869a3b7f8a31ea` during review.
- The integration worktree was clean before this review artifact was created.
- Actual base-to-target and remediation diffs were inspected, including the
  gateway, structured logger, deterministic processor, tests, package export,
  task, handoffs, prior review, PD-001, PD-008, and TD-001.
- The base-to-target diff contains no DEV-006 path and no `.ai/backups/` path.

## Prior blocker resolution matrix

### Prior B1 — Timeout can return before processor settlement: **NOT RESOLVED**

The remediation no longer returns or zeroes the gateway-owned buffer before a
processor that eventually settles. However,
`apps/backend/src/ingestion/ephemeral-document-gateway.mjs:311-319` awaits
`processorPromise` without any bounded cancellation settlement or enforceable
termination. A processor that ignores `AbortSignal` leaves `submit()` pending
forever and leaves the source buffer nonzero forever. The added regression test
covers delayed settlement only; it deliberately releases the processor and does
not cover the ignored-abort case required by the prior finding.

A fresh adversarial probe used a processor returning a never-settling promise.
After the 5 ms timeout and 30 ms observation window it reported:

```json
{"abortObserved":true,"submissionSettled":false,"retainedInputStillNonzero":true}
```

This violates the DEV-005/PD-008 expiry requirement: expiry does not actually
complete discard when cancellation is ignored. The gateway also ceases to have
a bounded processing lifecycle.

### Prior B2 — Authorization errors can expose sensitive messages: **RESOLVED**

`authorizationRejected()` maps only three allow-listed shared error codes to
fixed messages and maps every unknown authorizer failure to fixed `NOT_FOUND`.
The focused test injects an arbitrary clinical sentinel and confirms neither it
nor processor execution escapes. Fresh focused and backend suites passed this
coverage.

### Prior B3 — PNG validation accepts materially malformed structure: **NOT RESOLVED**

The remediation materially improves chunk-bound checks, CRC checks, core chunk
ordering, IHDR metadata validation, and trailing-byte rejection. Nevertheless,
the replacement fixture described as a valid PNG is still malformed as image
data: it declares a 1x1, 8-bit true-colour image (PNG colour type 2), whose
single non-interlaced scanline requires one filter byte plus three sample bytes,
but its IDAT zlib stream inflates to only two bytes (`[0, 0]`). The gateway
accepts it because `validatePng()` checks only that a non-empty, CRC-valid IDAT
chunk exists; it does not validate the compressed stream or its decoded image
length.

The prior finding explicitly required replacement with structurally valid test
data and rejection of malformed required image data. The fresh probe proves the
new positive fixture is not a valid decodable image, so that requirement and
its regression coverage remain incomplete.

## Blocking findings

### B1 — Ignored abort causes an unbounded hang and prevents expiry discard

**Location:** `apps/backend/src/ingestion/ephemeral-document-gateway.mjs:311-319`
and `apps/backend/test/ephemeral-document-ingestion.test.mjs:203-229`.

After timeout, the gateway waits forever if the injected processor ignores
abort. It neither settles the caller operation nor zeroes the gateway-owned
source input. Remediation must provide an enforceable, bounded processor
lifecycle (for example, an isolation boundary that can actually be terminated)
and adversarially test ignored abort, late completion, and late failure without
claiming discard before processor activity is contained.

### B2 — PNG positive fixture and validation still accept malformed image data

**Location:** `apps/backend/src/ingestion/ephemeral-document-gateway.mjs:107-166`
and `apps/backend/test/ephemeral-document-ingestion.test.mjs:50-59`.

The purported valid PNG has insufficient inflated scanline bytes, yet it passes
validation. Use a genuinely valid PNG fixture and reject malformed compressed
or decoded image data at the intended pre-handoff boundary. Add a regression
case for a CRC-valid IDAT stream whose decoded data is inconsistent with IHDR.

## Non-blocking finding

### NB1 — JPEG/PDF validation remains intentionally shallow

The JPEG positive fixture has SOF metadata but no scan data, and PDF validation
is token-based rather than parser/sandbox validation. This local boundary must
not be represented as production malware, renderer-isolation, or complete file
validity enforcement. It is non-blocking here only because no HTTP route, real
processor, network/provider, deployment, credential, or real-data path exists
and TD-001 remains open. Production activation must resolve this boundary.

## Architecture, scope, and downstream checks

- TD-001 front matter is still `status: OPEN`; no concrete provider, region,
  network topology, key/KMS, credential, or deployment choice was added.
- Production-source scans found no filesystem/network imports or calls, URL,
  durable write/storage/queue/cache path, environment credential access,
  provider adapter, or deployment activation in the DEV-005 implementation.
- The gateway is an exported in-process subpath only; it is not wired into
  `runtime.mjs`, an HTTP route, or a server.
- No real prescription, OCR output, proposal, clinical persistence, or source
  document was used or added.
- `git diff --name-only 3565d40..5300bc5 -- '*DEV-006*'` returned no paths.
- DEV-006 remains `status: PLANNED`, `assigned_agent: null`, `branch: null`, and
  `worktree: null`.

## Commands and results

- `git status --short --branch; git rev-parse HEAD; git branch --show-current;
  git rev-parse main; git rev-parse origin/main` — clean before artifact;
  expected branch and exact hashes confirmed.
- `git show --stat --oneline 5300bc59fc93762165d461553d57953e28241c02`
  and `git diff --name-status 3565d40b6e133bf25c2518ff54869a3b7f8a31ea..5300bc59fc93762165d461553d57953e28241c02`
  — target and all changed paths inspected.
- `git show f06c4b42eec53bba7224b0cb87307b9b81240afe --
  apps/backend/src/ingestion/ephemeral-document-gateway.mjs
  apps/backend/test/ephemeral-document-ingestion.test.mjs` — actual remediation
  code and tests inspected.
- `git diff --check 3565d40b6e133bf25c2518ff54869a3b7f8a31ea..5300bc59fc93762165d461553d57953e28241c02`
  — passed.
- `node --test test/ephemeral-document-ingestion.test.mjs` — passed 12/12.
- `npm test -w @medsup/backend` — passed 36/36.
- `npm run lint -w @medsup/backend` — passed.
- `npm run static-check -w @medsup/backend` — passed 1/1.
- Production-source grep for filesystem, network, URL, durable writes,
  environment credentials, provider keys, and deployment terms — no matching
  implementation path.
- Fresh ignored-abort and PNG-inflate probe — ignored abort remained unsettled
  with nonzero retained input; the positive PNG IDAT inflated to `[0, 0]`.

The fresh validation was intentionally proportionate to the remediated backend
surface. The repository-wide Node/Android/Wear validator result recorded by the
integration handoff was not substituted for these fresh focused checks, and
passing tests do not override the two reproduced review blockers.

## Required next action

Reopen DEV-005 remediation for B1 and B2 above. Add adversarial ignored-abort
lifecycle coverage and a genuinely valid PNG fixture plus malformed decoded-data
coverage, then run focused and full validation and request another independent
re-review at the resulting exact commit. Keep TD-001 `OPEN`; do not merge,
push, deploy, process real health data, choose a provider/region/network/key
path, activate production, or start DEV-006.
