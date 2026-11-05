---
task: DEV-005
status: HUMAN_TESTING
integration_branch: agent/integration-dev-005
integration_worktree: /home/felipe/projetos/meds-up-worktrees/integration-dev-005
base_commit: 3565d40b6e133bf25c2518ff54869a3b7f8a31ea
final_code_commit: 94d031d7910825d020a14aee9906b9553f0481f1
workflow_head_before_handoff: 4ca445e8b96416b8eaf779ca4cdb4374b7957c7a
approved_review: .ai/reviews/DEV-005-independent-rereview-2.md
approved_review_commit: 4ca445e8b96416b8eaf779ca4cdb4374b7957c7a
validation_status: PASSED
architecture_gate: .ai/development/decisions/TD-001-production-health-data-processing-gate.md
architecture_gate_status: OPEN
merge_status: NOT_MERGED
prepared_at: 2026-11-05T12:07:18Z
---

# DEV-005 human-testing handoff

## Completed scope

DEV-005 adds a provider-neutral backend gateway for authenticated, owner-bound,
ephemeral prescription-document processing. It rejects unauthorized,
unsupported, mismatched, malformed, oversized, or over-limit input before
handoff; normalizes exposed errors; emits only allow-listed non-clinical audit
metadata; and contains processing in a dedicated local worker.

The gateway transfers its private source copy into the worker. Completion,
failure, timeout, ignored abort, late completion, and late failure all terminate
and await the worker boundary before lifecycle evidence records discard or the
caller settles. PNG validation checks bounded chunks, CRCs, ordering, IHDR
metadata, bounded decompression, exact decoded scanline length, and filter
bytes.

No HTTP/runtime ingress, filesystem write, durable store, queue/cache, public
URL, real OCR/AI provider, network call, credential, deployment configuration,
OCR proposal, clinical persistence, or real-health-data capability was added.
DEV-006 remains `PLANNED` and unstarted.

## Validation

- Fresh final `./scripts/validate.sh`: passed all Node workspace builds, tests,
  lint, and static checks; backend 38/38, PWA 2/2, contracts 13/13; and every
  Android/Wear assemble, unit-test, lint, and check command.
- Focused ingestion suite: 14/14 passed, including ignored abort, late
  completion, late failure, discard ordering, authorization sanitization, and
  malformed decoded PNG data.
- `git diff --check 3565d40..4ca445e`: passed.
- Independent final review: PASS with zero blocking and one non-blocking
  observation.

## Review history

The first review found timeout-settlement, authorization-message, and PNG
structure blockers. The first remediation resolved authorization sanitization
but an independent rereview reproduced an abort-ignoring hang and malformed
PNG decoded data. The second remediation introduced enforceable worker
containment and bounded decoded PNG validation. The final independent review at
`.ai/reviews/DEV-005-independent-rereview-2.md` verified all blockers resolved.

The remaining non-blocking observation is that JPEG/PDF checks are intentionally
shallow and are not a production parser, malware scanner, or renderer sandbox.
TD-001 keeps that production boundary blocked.

## Human validation

This task has no UI or live provider. The narrow human gate is review of the
health-data discard and security boundary:

1. Inspect `apps/backend/src/ingestion/ephemeral-document-gateway.mjs` and
   `apps/backend/src/ingestion/document-processor-worker.mjs`.
2. Confirm processing receives only a private transferred copy and worker exit
   is awaited before discard is recorded or the caller settles.
3. Inspect `apps/backend/test/ephemeral-document-ingestion.test.mjs` and confirm
   coverage for unauthorized/malformed input, content-free logging/errors,
   ignored abort, late completion, late failure, and malformed decoded PNG data.
4. Confirm the integration diff contains no runtime/HTTP ingress, provider,
   network, persistence, credentials, deployment activation, or DEV-006 work.
5. Confirm TD-001 remains `OPEN` and continues to block all real prescription
   documents, OCR/AI providers, regions, networks, keys, and production paths.
6. Optionally rerun the focused ingestion suite or the full validator recorded
   above.

## Human decision required

DEV-005 defines source-document retention/discard and security behavior for a
future prescription health-data path. Under the dev-team Autonomy Policy,
changes to clinical/health-data handling and data-retention/security posture
require explicit human approval before merge.

If the scoped provider-neutral boundary and evidence are accepted, explicitly
authorize fast-forward merge of `agent/integration-dev-005` into `main` and a
normal push to `origin/main`. That approval will not resolve TD-001 and will not
authorize a real provider, region, network, key, deployment, production route,
real health data, or DEV-006.

No merge or push has occurred.
