---
tasks: [DEV-002, DEV-003]
status: SUPERSEDED_BY_AUTONOMOUS_COMPLETION
branch: agent/integration-dev-002-dev-003
reviewed_commit: ecacf912190e5792c9000935c73505a417767f1c
review_commit: b9af37b54db262d6d5972c707cb1192ef7fa7e70
prepared_at: 2026-11-03T16:29:45Z
merge_status: MERGED_PUSHED
superseded_at: 2026-11-03T16:50:11Z
completion_handoff: .ai/development/handoffs/DEV-002-DEV-003-autonomous-merge.md
---

# Human testing handoff — DEV-002 + DEV-003

## What to validate

DEV-002 defines versioned provider-neutral prescription/API contracts. DEV-003 defines capability-based identity, role, session, device-revocation, error, and structured-logging foundations. No product UI, real provider, persistence, deployment, document/OCR recovery, or private reminder-response transport is included.

## Prerequisites

- Node 22 or newer.
- JDK 17 or newer.
- Android SDK Platform and Build Tools 35.
- `local.properties` or `ANDROID_HOME`/`ANDROID_SDK_ROOT` configured.

## Automated human-test procedure

1. Open `/home/felipe/projetos/meds-up-worktrees/integration-dev-002-dev-003` and confirm `git branch --show-current` reports `agent/integration-dev-002-dev-003`.
2. Run `npm ci` and confirm the audit reports no vulnerabilities.
3. Run `make validate`; confirm all Node, Android, and Wear checks pass.
4. Run `npm test -w @medsup/contracts`; confirm 13 contract/schema tests pass.
5. Run `node --test apps/backend/test/built-artifact-authority.test.mjs apps/backend/test/identity-foundation.test.mjs`; confirm 15 focused security/foundation tests pass.
6. Run `git status --short`; only ignored build/dependency outputs may exist, with no tracked changes.

## Contract inspection

1. Review `packages/contracts/README.md` and `packages/contracts/schemas/v1/contracts.schema.json`.
2. Confirm ephemeral input, untrusted proposal, explicit doctor confirmation, confirmed prescription/version, status events, audit references, and errors are distinct.
3. Confirm no contract supports source-document/raw-OCR/unconfirmed-proposal persistence, retrieval, recovery, durable messaging, browser storage, or private reminder-response history.
4. Confirm schema/runtime compatibility tests reject unsafe integers and free-form error messages.

## Identity and privacy inspection

1. Review `apps/backend/src/identity/subject.mjs` and `session-manager.mjs`.
2. Confirm roles and sessions require an injected trusted assertion capability and generated runtime has no provider registration or subject-minting authority.
3. Confirm revoked devices cannot ordinarily establish a new session; explicit replacement does not restore old tokens.
4. Review `apps/backend/src/observability/structured-logger.mjs`; confirm only closed operational enums and bounded duration are accepted, with no free-form request/content field.
5. Confirm test identities and `.invalid` credentials exist only under `apps/backend/test/support`, never in generated runtime.

## Automated and review evidence

- Final validation: backend 17/17, PWA 2/2, contracts 13/13; all Android/Wear commands passed.
- Dependency audits: zero vulnerabilities.
- Final independent review: PASS, zero blocking and zero non-blocking findings.
- Historical failed reviews and all remediations remain preserved in `.ai/reviews/` and the integration handoff.
- Final review: `.ai/reviews/DEV-002-DEV-003-independent-final-review.md`.

## Known limits

- Session/device storage remains in memory; durable persistence belongs to later tasks.
- Real identity-provider selection/composition and account recovery are out of scope.
- Future bootstrap code must keep one trusted assertion authority private and inject it consistently into role guards and session managers.

## Workflow reassessment

This handoff is retained as historical evidence from the previous workflow.
Under the current dev-team Autonomy Policy, this provider-neutral, test-only
scope does not require a human-testing or merge-approval gate. Exact commit
`df6c919c7bdc7acc978635814f9eca509c511809` was independently reviewed,
validated, fast-forwarded to `main`, and pushed normally to `origin/main`.
