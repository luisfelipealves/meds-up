---
task: DEV-008
status: HUMAN_TESTING
branch: agent/integration-dev-008
worktree: /home/felipe/projetos/meds-up-worktrees/integration-dev-008
base_commit: c464d2aefb86b3b1a25806b71c9232529b15a4ca
reviewed_head: dd8b86a3d9ad337e03cfe87e445050d1bf32e209
review_record_commit: e72b2f702b01c30a7ce6af1abae71c62cee8df21
remediation_commit: 25ccea1c27c8ac04a203318cd33cc1bf0176bee5
prepared_at: 2026-11-07T15:20:07Z
merge_status: NOT_MERGED
push_status: NOT_PUSHED
architecture_gate: .ai/development/decisions/TD-001-production-health-data-processing-gate.md
---

# Human testing handoff — DEV-008

## Product and task

- Product decisions: `PD-001`, `PD-002` — `APPROVED_FOR_DEVELOPMENT`.
- Task: `DEV-008` — provider-neutral claim-token lifecycle.
- Dependencies verified complete on `main`: `DEV-002`, `DEV-003`, `DEV-004`, `DEV-007`.

## Delivered scope

- 256-bit cryptographically random opaque QR token generation.
- SHA-256 digest-only token lookup and persistence.
- Exact seven-day issue and replacement expiry.
- Owner-authorized issue, read, list, revoke, and replace operations.
- Single-use atomic consumption, replay protection, attempt auditing, per-patient failure rate limiting, and rollback/retry behavior.
- Content-free external failures and tests preventing raw-token leakage into persistence, errors, owner projections, observability-shaped fields, or URLs.

DEV-009 masked identity confirmation, DEV-010 patient association, client/UI work, durable adapters, providers, real persistence, production ingress, deployment, and real health data remain out of scope.

## Implementation and integration

- Developer branch: `agent/dev-008-claim-token-lifecycle`.
- Integration branch: `agent/integration-dev-008`.
- Original implementation: `db84d511605ada98976a528743cccef89477d2c8`.
- Integrated implementation: `801131e1ba61218e25bb0341b6615d968a180526`.
- Review remediation: `25ccea1c27c8ac04a203318cd33cc1bf0176bee5`.
- Latest independently reviewed implementation/workflow head: `dd8b86a3d9ad337e03cfe87e445050d1bf32e209`.
- Review record commit: `e72b2f702b01c30a7ce6af1abae71c62cee8df21`.
- No merge conflict occurred. The root `main` worktree and its uncommitted human `.ai` changes were preserved.

## Automated validation

All validation passed after remediation:

- Focused claim-token tests: 10/10.
- `npm run test`: backend 70/70, PWA 2/2, contracts 16/16.
- `npm run lint`.
- `npm run build`.
- `make test`, including Android and Wear unit tests.
- `make lint`, including Android and Wear lint.
- `make build`, including Android and Wear debug assembly.
- `scripts/validate.sh`, including Node build/test/lint/static checks and Android/Wear assemble, test, lint, and check phases.
- `git diff --check`.

## Independent review

- Initial review: `FAIL`, one blocking finding and one non-blocking finding.
- Blocking B1: replacement used two clock reads and could produce less or more than an exact seven-day replacement lifetime.
- B1 remediation captures one validated operation timestamp for replacement issuance, expiry, and replacement linkage; deterministic regression coverage was added.
- Fresh independent rereview: `PASS`, zero blocking findings and one accepted non-blocking finding.
- Remaining N1: the in-memory repository is synchronous, so its concurrency test proves serialized single-use behavior rather than a real durable-adapter interleaving. This is accepted for DEV-008; a future durable adapter must provide and test equivalent atomicity.

Canonical review: `.ai/reviews/DEV-008-independent-rereview.md`.

## Safe human validation

Use only the isolated worktree and synthetic local tests. Do not provide real prescriptions, patient data, credentials, or provider configuration.

1. Open `/home/felipe/projetos/meds-up-worktrees/integration-dev-008` and verify the branch is `agent/integration-dev-008`.
2. Run `node --test apps/backend/test/claim-token-lifecycle.test.mjs` and verify 10 tests pass.
3. Inspect `apps/backend/test/claim-token-lifecycle.test.mjs` and confirm coverage for exact expiry boundaries, revoke/replace, one replacement timestamp, replay, rollback/retry, rate limiting, owner isolation, digest-only persistence, and raw-secret leakage.
4. Inspect `apps/backend/src/claims/claim-token-lifecycle.mjs` and confirm the raw token is returned only as `qrPayload`, while repository records use `tokenDigest`.
5. Confirm replacement captures one `now` value and passes it to both issuance and the atomic repository replacement.
6. Optionally rerun `npm run test`, `npm run lint`, and `npm run build` locally.
7. Approve or reject DEV-008 explicitly. Approval authorizes only the repository workflow's next merge step; it does not resolve TD-001 or authorize providers, credentials, network paths, real health data, production persistence, deployment, or production activation.

## TD-001 boundary

TD-001 remains `OPEN`. No real provider was selected or connected; no credentials or application/provider network calls were used; no real health data was received; no production flow, persistence, ingress, or deployment was activated; and no provider, region, network, key-management, backup, or retention decision was changed.

## Gate

`NOT MERGED — NOT PUSHED`. Explicit human approval is required before any merge or push. No other DEV task has been started.