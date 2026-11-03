# DEV-004 independent final review

## Review target and scope

- Reviewed branch: `agent/integration-dev-004`
- Exact reviewed code commit: `eddb178f171a98738b018b65afff1a45298d068b`
- Base: `58065b619d047a59c57e23679035c3de88d7b188`
- Reviewed range: complete `git diff 58065b6..eddb178f`, including the integration and developer handoffs, task metadata, `apps/backend/src/authorization/doctor-ownership.mjs`, its tests, and package export.
- Required context read: `.ai/README.md`, DEV-004, DEV-004 developer and integration handoffs, PD-001, PD-008, and technical plan PD-001, plus DEV-002/DEV-003 contracts and identity code.
- This review made no production-code changes.

## Verdict

**BLOCKED — do not advance DEV-004 beyond `INTEGRATED`.**

The service has the intended trusted-subject role gate, content-free direct-ID denial for ordinary owner-bearing test records, owner-filtered lists, active-session filtering, and no doctor reminder-history method. However, the authorization boundary is not complete against the repository/contract surfaces it is intended to protect. Versions and audit references cannot be authorized from the published contracts, mutation authority is forwarded through an untrusted mutation object, and the active-session path does not enforce the PD-008 payload boundary. These must be resolved before downstream callers can safely rely on this service.

## BLOCKING findings

### B1 — Covered version and audit records have no contract-defined owner metadata

`doctor-ownership.mjs:27-35` requires every returned record to have `record.ownerDoctorId`. The service applies that requirement to `PrescriptionVersion` and `AuditReference` at lines 9-10 and on every read/list/mutation. But the actual shared contracts do not define that field: `validatePrescriptionVersion` exposes `confirmedByDoctorId` instead (`packages/contracts/src/index.mjs:169-181`), while `validateAuditReference` has no doctor actor or owner field at all (`:267-277`).

Adversarial evidence: a contract-shaped version containing `confirmedByDoctorId` equal to the authenticated doctor and a contract-shaped audit reference both return `NOT_FOUND` from the service. Thus either legitimate records are denied, or a future adapter must add undocumented authorization metadata. For audit references there is no owner identity in the current contract from which an adapter can derive it. The tests avoid this mismatch by inventing `{ id, ownerDoctorId }` records (`apps/backend/test/doctor-ownership.test.mjs:89-121`) and therefore do not validate the real contracts.

Required next action: define and validate an explicit owner/actor projection for each covered resource (including audit references), or revise the covered-resource authorization model and its APIs. Add contract-shaped positive, cross-doctor, missing, list, and mutation tests for versions and audit references.

### B2 — Mutation payload can carry an ownership transfer through the repository boundary

At `doctor-ownership.mjs:66-70`, the service passes `mutation` unchanged to `repository.mutateByOwner`. The caller can therefore supply `{ ownerDoctorId: anotherDoctor }`. The service only checks the returned record after the repository has processed the mutation; it does not strip or reject this authority-bearing field.

Adversarial evidence used a repository that records the received mutation and returns a foreign-owned record. The service returned `NOT_FOUND`, but the repository received `mutation.ownerDoctorId === "doctor-owner-0002"`. A repository that merges mutation fields before applying its owner guard can transfer ownership or mutate a foreign record before the postcondition check. The supplied test double masks this defect by forcibly overwriting `ownerDoctorId` (`doctor-ownership.test.mjs:33-37`), so the ownership-transfer test is not a meaningful repository-misbehavior test.

Required next action: make the service pass a server-constructed mutation with ownership fields removed/forbidden and enforce an explicit repository result/atomicity contract. Add an adversarial repository test proving that a forged owner field cannot change ownership and that a failed owner check has no side effect. This remains necessary even when adapters are expected to implement `mutateByOwner` correctly.

### B3 — Active review-session reads do not enforce the PD-008 non-queryability boundary

The generic direct read, list, and mutation return repository records verbatim (`doctor-ownership.mjs:53-70`). No projection or field allow-list prevents an active-session record from carrying a source document, raw OCR/AI output, or unconfirmed proposal. Consequently, if an injected active-session repository contains any of those fields, `getActiveReviewSession`, `listActiveReviewSessions`, and the mutation result expose them through this service.

The diff does not add persistence, so this is not evidence that the current repository durably stores such content. It is nevertheless an incomplete security boundary: the DEV-004 scope and PD-008 require documents, raw output, and unconfirmed proposals to remain non-durable and non-queryable, while the handoff merely assumes an adapter “returns only session metadata.” There is no code or test enforcing that assumption.

Required next action: define an authorization/session-record projection containing only the metadata needed for ownership and lifecycle checks, reject or discard prohibited payload fields at this boundary, and add tests with sentinel document/raw-OCR/proposal fields proving they cannot be returned or persisted/queryable. Coordinate the projection with DEV-005/DEV-006 without expanding this review into their implementation.

## NON_BLOCKING findings

- The focused suite has only five test cases and uses one custom repository double. It does not cover missing-vs-cross-doctor parity for every resource, missing direct mutations, inactive-session mutation/list behavior, repository exceptions/invalid return values, or atomic side-effect behavior. Expand the adversarial matrix after the blocking contract/boundary decisions are fixed.
- No transport handler currently consumes this service, so HTTP/API error-envelope behavior and request-level audit/rate-limit controls are not evidenced here. Those belong to later integration, but downstream handlers must preserve the content-free `NOT_FOUND` policy and never expose repository errors or private reminder history.

## Scope checks

- No doctor reminder-history, adherence, or patient-local history operation is exported by the service; the focused API-name assertion also passed.
- No DEV-005 implementation, document-ingestion provider, persistence adapter, upload route, raw OCR/AI storage, or unconfirmed-proposal recovery path was added in this diff. The B3 finding is the missing enforcement boundary for future injected session records, not a claim that this diff itself added storage.
- No administrative break-glass, invitation policy, or other out-of-scope authority was introduced.

## Validation evidence

Passed on the exact reviewed commit:

- `node --test apps/backend/test/doctor-ownership.test.mjs` — 5/5 tests.
- `npm test -w @medsup/backend` — 22/22 tests.
- `npm test -w @medsup/contracts` — 13/13 tests.
- Adversarial inline checks reproduced B1 (contract-shaped version/audit records denied) and B2 (forged owner field forwarded to repository).
- Prior integration evidence in the handoff reports syntax checks, diff checks, and the full Node/Android/Wear validator passing; this review did not treat those green checks as closing the authorization findings above.

## Next action

Return DEV-004 to implementation for the three blocking findings. Update the shared resource/adapter contracts and service boundary, add adversarial repository and PD-008 tests, rerun the complete validation suite, then request a new independent review against the resulting commit. Do not advance to downstream authorization consumers until that rerereview is approved.
