# DEV-004 independent second final review

## Review target

- Production/test HEAD: `e10082da77acb3b853b9c00d6fbcbe54beb8e501`
- Workflow HEAD: `967d116630372d70654df2430f4932c9038c743c`
- Base: `58065b619d047a59c57e23679035c3de88d7b188`
- Reviewed range: complete diff from base through the specified production/test and workflow heads, including all DEV-004 task, developer-handoff, integration-handoff, and prior-review artifacts.
- Context reviewed: `.ai/README.md`, PD-001, PD-008, TECH-PLAN-PD-001, DEV-002 contracts, DEV-003 identity/subject/session/error code, backend package/runtime surface, and all DEV-004 production/tests.
- This review made no production or test changes.

## Verdict

**BLOCKED — do not advance DEV-004 beyond `INTEGRATED`.**

PASS is not permitted because active-session metadata still accepts and returns
semantically sensitive content in fields that pass the new lexical
“opaque identifier” check. The previous nested/invalid-value blocker is
materially remediated, but the PD-008 metadata-only boundary is not complete.

## Historical finding disposition

- **B1 — RESOLVED.** Every covered repository result is an explicit internal
  `{ record, authorization: { ownerDoctorId } }` projection. Contract-shaped
  prescription versions and audit references authorize through that projection
  without inventing public owner fields. Owner, cross-doctor, list, and mutation
  paths were exercised.
- **B2 — RESOLVED.** `sanitizeMutation` recursively removes authority-bearing
  fields before the repository boundary. Mutations use the authenticated owner
  argument and one `mutateByOwner` call with an `activeOnly` policy; the
  side-effecting repository probe received no forged owner or session payload.
- **B3 — RESOLVED for ordinary fields.** Active-session get/list/mutation output
  is projected to the allow-list, and ordinary document/raw-OCR/proposal fields
  are absent. The residual below is a remaining PD-008 boundary failure, not a
  return to verbatim record exposure.
- **B4 — PARTIALLY RESOLVED; residual blocker below.** Nested objects, arrays,
  invalid statuses, and invalid timestamps are rejected or omitted without
  echoing their values. But the identifier validator only checks
  `[A-Za-z0-9_-]{16,128}`; it cannot distinguish an opaque ID from a sensitive
  document/OCR/proposal string.

## Blocking finding

### B4-residual — lexical identifier validation permits content leakage

`isOpaqueIdentifier` in
`apps/backend/src/authorization/doctor-ownership.mjs:52` accepts any bounded
ASCII identifier-shaped string. `projectSession` then returns `id` and the
optional `reviewSessionId` unchanged. A malformed injected repository returning
the valid-shaped value
`RAW_OCR_AI_UNCONFIRMED_PROPOSAL_SENTINEL` therefore passes validation and is
returned by all three active-session operations:

- `getActiveReviewSession` returned it in `id`;
- `listActiveReviewSessions` returned it in `id`;
- `mutateActiveReviewSession` returned it in `id`;
- the same three paths returned it in `reviewSessionId`.

This is a concrete content leak at the authorization/query boundary, not merely
an adapter-style concern: the service claims to enforce a metadata-only
projection while accepting the leaked content as valid metadata. It conflicts
with PD-008's prohibition on exposing document/OCR/proposal content and its
requirement to prevent revealing identifiers. The current tests cover nested
sentinels and invalid scalar forms, but not sensitive strings that satisfy the
identifier grammar.

Required next action: make the active-session identifier contract genuinely
opaque at this boundary (for example, use a constrained generated-ID format or
an injected verifier tied to the repository's ID contract), reject malformed
values with the shared content-free `NOT_FOUND`, and add get/list/mutation tests
for sensitive values in every retained identifier field. Do not weaken the
existing recursive mutation sanitization or one-call atomic behavior.

## Acceptance and scope review

- Server-side owner checks cover active review sessions, confirmed
  prescriptions, versions, audit references, and claim controls on direct
  reads, owner-scoped lists, and mutations.
- Missing and cross-doctor direct identifiers use the same content-free
  `NOT_FOUND` tuple in the covered repository contract; inactive sessions are
  hidden consistently.
- Forged subjects and patient subjects are rejected by DEV-003's trusted
  authenticated-subject assertion and doctor role guard; caller-shaped subject
  objects cannot substitute for authority.
- No doctor reminder-history/adherence/patient-local-history operation is
  exported.
- No DEV-005 implementation, upload route, persistence adapter, document store,
  raw OCR/AI store, or unconfirmed-proposal recovery path was added.
- The backend package export and built runtime surface are present and
  provider-neutral.
- Repository adapters must still implement owner-scoped listing and atomic
  `mutateByOwner`, and later transport handlers must preserve error envelopes,
  rate limits, audit controls, and no reminder-history exposure. Those are
  downstream obligations, not findings against this diff. They do not cure the
  service-level residual above.

## Validation evidence

Passed:

- `npm test -w @medsup/backend` — 24 tests passed.
- `npm test -w @medsup/contracts` — 13 tests passed.
- `npm run build`, lint, static checks, and Node/PWA/contracts portions of
  `./scripts/validate.sh` passed.
- `node --check apps/backend/src/authorization/doctor-ownership.mjs` passed.
- `git diff --check` on the specified code range passed; the existing prior
  review artifact has a pre-existing blank-at-EOF warning when diffed from base.
- Focused adversarial probe reproduced B4-residual leakage in get/list/mutation
  for both `id` and `reviewSessionId`; nested/invalid metadata and malformed
  mutation output failed closed without sentinel echo.

Environment-limited:

- The eight Android/Wear Gradle commands in `./scripts/validate.sh` could not
  run because the sandbox denied creation of Gradle's lock file under
  `/home/felipe/.gradle`; this is not a code finding.

## Next action

Return DEV-004 for remediation of B4-residual, add sensitive-string tests for
every retained identifier across get/list/mutation, rerun the complete
available validation, and request another independent review. Do not merge
main, push, or begin DEV-005 work.
