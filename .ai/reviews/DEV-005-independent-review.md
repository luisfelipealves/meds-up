---
task: DEV-005
type: independent-review
status: CHANGES_REQUIRED
reviewed_commit: 17741f5eb3a3a42172187c90991544e6faff56b3
reviewer: codex-cli-independent-reviewer
review_session: 01a1ab26-93a3-7900-bada-e720eefdca23
reviewed_at: 2026-11-05T10:03:19Z
blocking_findings: 3
non_blocking_findings: 4
architecture_gate: .ai/development/decisions/TD-001-production-health-data-processing-gate.md
---

# Independent review — DEV-005

## Verdict

`CHANGES_REQUIRED`. Three blocking findings must be remediated and independently
re-reviewed before DEV-005 can advance. TD-001 remains `OPEN`; this review does
not approve architecture, merge, deployment, a provider, or real health-data
processing.

## Scope reviewed

The independent reviewer read PD-001, PD-008, the technical plan, DEV-005,
the developer and integration handoffs, and TD-001; inspected the actual
`3565d40..17741f5` diff and changed paths; and reviewed the implementation and
tests. No DEV-006 artifact changed and DEV-006 remains `PLANNED`.

## Blocking findings

### B1 — Timeout can return before processor settlement

`apps/backend/src/ingestion/ephemeral-document-gateway.mjs:229-255`

The gateway races processing against a timer, aborts and zeroes its working
buffer when the timer wins, then returns without awaiting processor settlement.
A processor that ignores or delays abort can continue running or perform late
side effects after the gateway reports timeout. The gateway must not claim the
operation has expired and been discarded until cancellation has settled; add
adversarial delayed/ignored-abort coverage.

### B2 — Injected authorization errors can escape with sensitive content

`apps/backend/src/ingestion/ephemeral-document-gateway.mjs:194-202`

The bounded audit event is safe, but the gateway rethrows the authorizer's
original error. An adapter or repository-derived message could expose clinical
content, identifiers, or internal details. Normalize authorization failures to
fixed content-free gateway errors and test arbitrary sensitive messages.

### B3 — PNG validation accepts materially malformed structure

`apps/backend/src/ingestion/ephemeral-document-gateway.mjs:81-90`

The check accepts a signature, IHDR marker/dimensions, and final IEND bytes
without validating chunk boundaries, CRCs, required image data, or ordering.
The test fixture itself is not a valid PNG structure. Parse bounded chunks,
validate CRCs and required ordering/data, reject trailing/truncated input, and
replace the fixture with structurally valid test data.

## Non-blocking findings

- Tests did not cover ignored abort, delayed abort settlement, late completion,
  or late failure.
- Tests did not verify arbitrary authorization-error sanitization.
- JPEG/PDF checks are intentionally shallow and must not be represented as a
  production malware/parser-isolation boundary; TD-001 correctly keeps that
  boundary open.
- The package export is not wired into `runtime.mjs` or an HTTP route, so no real
  production-facing ingestion path exists in the reviewed change.

## Validation observed

- Focused ingestion suite passed 10/10.
- Source scan found no filesystem, network, persistence, URL, queue, cache,
  provider, credential, or production path.
- Base ancestry and a clean worktree were confirmed.
- Five of six backend test files passed in the read-only reviewer sandbox. The
  built-artifact test could not rebuild `dist/` because the sandbox correctly
  denied writes; integration evidence records the full writable validation as
  passing before review.
- A targeted probe confirmed arbitrary authorization messages currently escape.

## Required next action

Remediate B1-B3 on `agent/integration-dev-005`, add adversarial regression tests,
run focused and full validation, update the integration evidence, and request a
new independent review of the resulting commit. Do not merge, deploy, process
real documents, resolve TD-001 implicitly, or start DEV-006.
