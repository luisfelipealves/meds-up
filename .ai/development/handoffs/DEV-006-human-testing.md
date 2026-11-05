---
task: DEV-006
status: HUMAN_TESTING
integration_branch: agent/integration-dev-006
integration_worktree: /home/felipe/projetos/meds-up-worktrees/integration-dev-006
base_commit: cddc9f845f1b4fee0bd4faef12740f0c86f19d38
implementation_commit: 8f6d2d1746f6b4d58e756bfbcb59685f94b3d982
remediation_commit: c20449a9f3e5b6ea995a50494cf3e8fdd5700dc0
reviewed_head: c8cb9db9fb6e3616265a347300e747d9c0ae2652
review: .ai/reviews/DEV-006-independent-rereview.md
validation_status: PASSED
architecture_gate: .ai/development/decisions/TD-001-production-health-data-processing-gate.md
architecture_gate_status: OPEN
merge_status: NOT_MERGED
prepared_at: 2026-11-05T13:27:07Z
---

# DEV-006 human-testing handoff

## Completed scope

DEV-006 adds a local, provider-neutral OCR extraction proposal boundary and
in-memory doctor-review lifecycle. It requires explicit retention-disabled and
training-disabled controls, accepts only bounded mutable raw-response bytes,
validates a closed structured result, zeroes raw bytes before settlement, and
exposes proposals only as `SESSION_ONLY_UNTRUSTED` with session-only provenance
and bounded confidence.

The lifecycle is bound to one trusted doctor and active review session. Failure
is content-free and retry-safe. Expiry, abandonment, completion, or reload ends
the lifecycle and removes the proposal without recovery. Extraction runs in a
dedicated local worker; expiry or abandonment aborts, terminates, and awaits the
worker before settlement, including when the extractor never settles or ignores
abort. No proposal API can confirm a prescription or create reminders.

No real OCR/AI provider, provider credential, API/network call, real
prescription document, persistent proposal/source/raw-response path, production
ingress, deployment, region/network/key choice, or real-health-data activation
was added. DEV-007 was not started.

## Validation

- Focused OCR proposal suite: **11/11 passed**.
- Complete backend suite: **49/49 passed**.
- Contracts: **14/14 passed**; PWA: **2/2 passed**.
- Full `./scripts/validate.sh` passed all Node workspace builds, tests, lint, and
  static checks plus all Android/Wear assemble, unit-test, lint, and check tasks.
- `git diff --check` passed.
- Source/path inspection found no concrete provider, network, credential,
  persistence/recovery, confirmation, reminder, deployment, DEV-007, or
  `.ai/backups` path.
- Independent re-review: **PASS**, zero blocking and zero non-blocking findings.
  The reviewer's read-only sandbox could not run one build-authority test because
  that test writes generated `dist/`; the coordinator's writable full validator
  passed that test and the complete suite on unchanged executable code.

## Review history

The initial independent review found one blocker: an in-process extractor that
never settled could remain active beyond expiry or abandonment. Remediation
moved extraction into an enforceable worker boundary and added never-settling
expiry/abandonment tests with post-settlement activity checks. Independent
re-review verified the blocker resolved with no remaining findings.

## Human validation

This task has no UI or live provider. The reserved human gate is review of the
health-data proposal/discard and architecture boundary:

1. Inspect `apps/backend/src/proposals/ocr-proposal-adapter.mjs` and
   `apps/backend/src/proposals/ocr-extractor-worker.mjs`.
2. Confirm every extraction requires explicit retention/training-disabled
   controls and a bounded session `AbortSignal`.
3. Confirm expiry or abandonment terminates and awaits the worker before the
   caller settles, then leaves no recoverable proposal.
4. Inspect `apps/backend/test/ocr-proposal-adapter.test.mjs`, especially the
   never-settling expiry and abandonment tests and raw-byte discard assertion.
5. Confirm the public session surface has no confirmation, persistence,
   recovery, or reminder operation.
6. Confirm the full diff contains no real provider/API/network/credential,
   production/deployment, real-document, DEV-007, or `.ai/backups` change.
7. Confirm TD-001 remains `OPEN` and continues to block every real provider,
   prescription document, production ingress, deployment, region/network/key
   decision, and real-health-data operation.
8. Optionally rerun the focused OCR suite or the full validator recorded above.

## Human decision required

DEV-006 defines untrusted prescription-proposal lifecycle, ephemeral health-data
discard, and provider retention/training controls. Under the dev-team Autonomy
Policy and the human's explicit instruction, merge and push require an explicit
human decision.

If the scoped provider-neutral, local-only implementation and evidence are
accepted, explicitly approve the exact current head of
`agent/integration-dev-006` for fast-forward merge into `main` and a normal push
to `origin/main`. The coordinator will report that exact candidate hash with the
human-gate event.

Approval will not resolve TD-001 and will not authorize OpenAI or another real
provider, provider credentials, API/network calls, Vercel/Supabase/OpenAI as
final architecture, real prescription documents, a production data path,
deployment, region/network/key choices, real-health-data operation, or DEV-007.
