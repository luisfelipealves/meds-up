---
task: DEV-009
type: independent-review
status: FAIL
verdict: FAIL
branch: agent/review-dev-009
base_commit: 479db3c9a00b887dc8c82d40dec4793532c8c79d
reviewed_commit: 40ec9df81cf6f90bc373ea4465908ca743dbe2fb
reviewed_range: 479db3c9a00b887dc8c82d40dec4793532c8c79d..40ec9df81cf6f90bc373ea4465908ca743dbe2fb
reviewer: fresh-independent-codex-read-only
reviewed_at: 2026-11-08T00:00:00Z
blocking_findings: 2
non_blocking_findings: 1
architecture_gate: .ai/development/decisions/TD-001-production-health-data-processing-gate.md
---

# DEV-009 independent review

## Verdict

**FAIL.** The integrated diff is provider-neutral and the focused tests pass,
but two blocking contract/privacy gaps remain. This review does not authorize
merge, push, HUMAN_TESTING, production activation, providers, credentials, or
real health-data operation. TD-001 remains `OPEN`.

## Scope and evidence

I independently read PD-002, the DEV-009 task, technical analysis, developer
and integration handoffs, DEV-008 task/handoffs, TD-001, PD-001, and the
architecture records. I inspected the complete `origin/main..HEAD` diff and
the implementation, tests, contracts, and lifecycle boundary; conclusions are
based on code, not on handoff assertions. The reviewed commit is
`40ec9df81cf6f90bc373ea4465908ca743dbe2fb`.

## Blocking findings

### B1 — Failure response does not satisfy contact-the-emitter behavior

Evidence: `apps/backend/src/claims/masked-identity-confirmation.mjs:5,12`
defines and throws only `"The claim could not be completed."` for malformed,
unknown/invalid lifecycle, rate-limited, internal, and DOB-mismatch paths
(`:127-137` and `:152-167`). The focused test asserts only that this same
message is shared (`apps/backend/test/masked-identity-confirmation.test.mjs:13,
79-94`).

This is uniform, but it is not the approved UX/outcome: DEV-009 acceptance
requires a generic contact-the-emitter outcome, while PD-002 requires a
neutral instruction to contact the doctor/clinic (`PD-002:27-29,62-63`). The
same requirement is also part of the task acceptance (`DEV-009:37`). At the
transport boundary, `toErrorEnvelope` canonicalizes the `CONFLICT` message, so
the custom FoundationError text cannot supply this missing instruction.

Required action: define one stable, content-free error outcome/message for
invalid token and DOB mismatch that explicitly tells the user to contact the
emitter, and make the service/contract/transport tests prove that all relevant
failure variants have the same code, shape, and message without revealing
existence or state. Preserve the internal allow-listed audit outcomes.

### B2 — Full patient name is retained in the identity repository

Evidence: `apps/backend/src/claims/masked-identity-confirmation.mjs:46-57`
accepts `patientName`, and the in-memory repository clones and stores it at
`:184-193`; `inspectForTests()` exposes the stored projection at `:211`.
`preview` and `confirm` repeatedly derive initials from that stored full name
at `:111-112`.

The technical analysis explicitly requires deriving initials once at the
trusted boundary “sem armazenar nem devolver o nome completo”
(`DEV-009-technical-analysis.md:137-142`). Storing the full name in the
projection contradicts that minimization boundary even though the public
preview is masked. It creates an unnecessary identity-data persistence/read
surface and makes a future adapter likely to copy the full name into storage;
it also weakens the negative leakage guarantee around repository snapshots and
debug/test inspection. The current test only proves the response omits the
name (`masked-identity-confirmation.test.mjs:61-70`), not that the repository
never stores it.

Required action: make the trusted projection contain only pre-derived initials
(or a narrowly scoped one-time masking input that is discarded before
persistence), retain only the DOB and minimum opaque references needed for
confirmation, and add a negative test over repository state/snapshots and
errors/log-shaped objects.

## Non-blocking finding

### N1 — Issuer display-name validation does not reject Unicode spoofing controls

Evidence: `masked-identity-confirmation.mjs:53` and the published/runtime
validators at `packages/contracts/schemas/v1/contracts.schema.json:202-209`
and `packages/contracts/src/index.mjs:355-361` reject only C0 controls and
DEL. They permit bidi controls, zero-width characters, and other format/
line-separator characters when `isAllowedIssuerDisplayName` returns true.
The allow-list is a useful trusted boundary, so this is not treated as a
current enumeration blocker, but a display name can still be visually
spoofed or rendered inconsistently at the UI boundary.

Recommendation: normalize and reject Unicode format/bidi/control characters
in the issuer display contract (or require a canonical allow-listed display
record whose serialized value is checked), with adversarial schema and service
tests. Keep the initials rules Unicode-aware and test composed/decomposed names
explicitly.

## Positive validation

- `node --test apps/backend/test/masked-identity-confirmation.test.mjs apps/backend/test/claim-token-lifecycle.test.mjs packages/contracts/test/contracts.test.mjs packages/contracts/test/schema.test.mjs`: **34/34 passed**.
- The tests cover trusted-subject role gating, masked response shape, token
  state enumeration resistance, DOB mismatch, per-patient rate limiting,
  capability binding, replay, token lifecycle rollback, digest-only token
  persistence, and closed contracts.
- A focused Unicode probe rejected zero-width, bidi, C1, and ambiguous name
  inputs; composed/decomposed and non-ASCII letter cases were exercised.
- `git diff --check origin/main..HEAD`: **passed**.
- `npm ci --ignore-scripts` was needed because the worktree initially lacked
  workspace dependencies; it completed with 0 reported vulnerabilities. No
  code, provider, network, credential, root checkout, merge, or push operation
  was performed.

## Gate disposition

DEV-009 remains at `REVIEW` with `FAIL` review status. Do not advance to
`HUMAN_TESTING` until B1 and B2 are remediated and independently re-reviewed.
