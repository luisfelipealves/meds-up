# DEV-004 independent final re-review

## Review target and scope

- Branch: `agent/integration-dev-004`
- Base: `58065b619d047a59c57e23679035c3de88d7b188`
- Production/test remediation commit: `2a7c804d0e9ae3bd28411130df4416f910363a49`
- Workflow/documentation HEAD: `3d0b9e8517549b3962a46fdb91fffe68b1c8c063`
- Reviewed range: complete diff from the base through workflow HEAD, including the remediation, task metadata, both handoffs, prior review, package export, relevant contracts and identity code.
- Context read: `.ai/README.md`, DEV-004, both DEV-004 handoffs, technical plan PD-001, PD-001, PD-008, and `.ai/reviews/DEV-004-independent-review.md`.
- No production code was changed by this review.

## Verdict

**BLOCKED — do not advance DEV-004 beyond `INTEGRATED`.**

The remediation resolves the three original blocking findings, but a new active-session projection boundary defect remains. The projection is key-allow-listed but not value/schema validated, so malformed repository output can still put document/OCR/proposal content inside an allowed metadata field and expose it through active-session get, list, or mutation results. PASS is therefore not permitted.

## Original B1–B3 verification

### B1 — RESOLVED

`createAuthorizationRepositoryProjection(record, ownerDoctorId)` establishes a separate internal authorization envelope, and `unpackProjection` requires it on every covered repository result. Ownership is no longer inferred from the public record shape. Contract-shaped `PrescriptionVersion` records use their realistic `confirmedByDoctorId` field while authorization is carried separately; contract-shaped `AuditReference` records likewise authorize through the internal projection without inventing a public owner field. Direct reads, lists, and mutations for both resources were exercised for the owner and returned the expected records.

### B2 — RESOLVED

`sanitizeMutation` recursively removes `ownerDoctorId`, `confirmedByDoctorId`, `actorDoctorId`, and `authorization` before the repository boundary. Active-session payload fields are stripped there as well. Each mutation invokes one repository `mutateByOwner` call with the authenticated owner as the separate argument and `{ activeOnly }` as the policy, with no service pre-read. The adversarial repository test observed the exact sanitized mutation, confirmed no forged-owner side effect, and confirmed the returned owner cannot be changed by the mutation.

### B3 — PARTIALLY RESOLVED; residual blocker below

Active-session direct reads, lists, and mutation results now pass through `projectSession`, and ordinary sentinel fields (`document`, `rawOcr`, and `unconfirmedProposal`) were absent in focused tests. This closes the original verbatim-record leak for normal records. However, `projectSession` filters only property names and returns their values unchanged. It does not require scalar/allow-listed values for `id`, `reviewSessionId`, `status`, or lifecycle timestamps. A repository result such as `{ status: { rawOcr: "SENTINEL" } }` is returned with that nested content intact. The same issue applies to list and mutation results.

## Blocking finding

### B4 — Active-session metadata projection does not validate metadata values

**Evidence:** `projectSession(record)` in `apps/backend/src/authorization/doctor-ownership.mjs` is `Object.fromEntries(Object.entries(record).filter(([key]) => SESSION_METADATA_FIELDS.has(key)))`. The allow-list protects against ordinary extra field names, but it does not validate the shape or type of the retained values. `publicRecord` therefore returns arbitrary nested objects under an approved key.

**Impact:** A malformed or hostile injected repository can return document, raw OCR/AI, or unconfirmed proposal content under `status`, `createdAt`, `id`, or another approved key. `getActiveReviewSession`, `listActiveReviewSessions`, and `mutateActiveReviewSession` then expose that content. This violates the requested metadata-only/PD-008 boundary and the malformed-repository fail-closed requirement, even though the ordinary sentinel-field test passes.

**Required next action:** Define and enforce the active-session metadata contract at this boundary: validate the required identifier/status/timestamp fields and their scalar formats, reject malformed projections (or return the shared content-free `NOT_FOUND`/safe failure), and add direct/list/mutation adversarial tests with nested payloads in every retained field. Keep the existing recursive mutation sanitization and atomic repository call.

## Acceptance and scope matrix

- Server-side ownership checks exist for active review sessions, confirmed prescriptions, versions, audit references, and claim controls on direct reads, owner-scoped lists, and mutations.
- Missing and cross-doctor direct identifiers, including direct mutations, use the same content-free `NOT_FOUND` tuple in the tested repository contract.
- Lists use the authenticated owner and defensively filter returned projections; inactive sessions are excluded from get/list and are passed to mutation repositories with `activeOnly: true`.
- Forged/patient/cross-authority subjects are rejected by the injected DEV-003 authenticated-subject assertion and doctor role guard; caller-shaped subjects cannot substitute for trusted authority.
- The service exposes no doctor reminder-history, adherence, or patient-local reminder path.
- No DEV-005 implementation, upload route, persistence adapter, document store, raw OCR/AI store, or unconfirmed-proposal recovery path was introduced.
- The public package export is explicit and the backend build/runtime surface remains provider-neutral; no subject-minting authority was added.
- PD-001’s cross-doctor isolation and local reminder-history requirements are addressed within DEV-004 scope. PD-008’s no-document/no-raw-output/no-unconfirmed-proposal query boundary is not fully enforced because of B4.
- The focused tests materially improved coverage for realistic version/audit records, direct/list/mutation matrices, inactive sessions, forged ownership, side-effecting repositories, and metadata projection. Remaining test gaps include malformed projection values, repository exceptions, and explicit missing-vs-cross-doctor assertions for every mutation/list variant.

## Validation evidence

Passed on the reviewed branch:

- `node --test apps/backend/test/doctor-ownership.test.mjs` — passed.
- `npm test -w @medsup/backend` — passed, 23 tests.
- `npm test -w @medsup/contracts` — passed, 13 tests.
- `npm run build -w @medsup/backend` — passed.
- `node --check apps/backend/src/authorization/doctor-ownership.mjs` — passed.
- `git diff --check 58065b619d047a59c57e23679035c3de88d7b188..HEAD` — passed.
- Adversarial checks confirmed contract-shaped version/audit authorization, recursive authority stripping, one-call mutation behavior, and ordinary active-session payload suppression.
- `./scripts/validate.sh` passed Node, PWA, contracts, lint, and static checks. Its eight Android/Wear Gradle commands could not run because the sandbox denied creation of the Gradle wrapper lock file under `/home/felipe/.gradle`; this is an environment limitation, not a code failure.

## Next action

Return DEV-004 for remediation of B4. Add value/schema validation and nested-content adversarial tests for all active-session metadata outputs, rerun the complete available validation, and request another independent review. Do not merge main, push, or begin DEV-005 work from this review.
