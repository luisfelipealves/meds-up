---
task: DEV-006
type: independent-review
status: CHANGES_REQUIRED
base_commit: cddc9f845f1b4fee0bd4faef12740f0c86f19d38
reviewed_head: dd056babcb0425e2d134d7d60fd7882b7a9a0a29
reviewed_at: 2026-11-05T13:20:03Z
reviewer: independent-codex-read-only
blocking_findings: 1
non_blocking_findings: 0
---

# DEV-006 independent review

## Verdict

`CHANGES_REQUIRED` with one blocking finding and no non-blocking findings.
The reviewer inspected the actual integration diff and relevant surrounding
contracts, ingestion, authorization, observability, tests, and workflow
artifacts in read-only mode.

## Blocking finding

### Never-settling extraction is unbounded

`createOcrProposalReviewSession().extract()` awaits the injected adapter at
`apps/backend/src/proposals/ocr-proposal-adapter.mjs:148`. Expiry is checked
only before extraction and after the adapter settles at lines 125–131 and 149.
If an extractor never settles, the operation remains pending and `inProgress`
remains true indefinitely through lines 142–175. Expiry or abandonment therefore
does not deterministically end that extraction.

This violates DEV-006's requirement that a proposal operation end with session
expiry and the integration handoff's explicit never-settling-operation review
caution.

Required remediation:

- bound extraction with cancellation/abort semantics;
- on expiry, abandonment, or timeout, deterministically terminate the operation,
  prevent late proposal delivery, clear operation state, and ensure extraction
  cannot continue retaining or processing response data; and
- add a never-settling extractor test proving expiry settlement and
  post-settlement containment.

## Scope and positive evidence

The reviewed diff contains no DEV-007 work, concrete provider/API/network or
credential path, production ingress, persistence path, or real prescription or
health-data path. TD-001 remains `OPEN`.

Focused OCR tests, contracts tests, lint, static checks, full integration
validation, and `git diff --check` passed. Those results do not cover the
blocking never-settling lifecycle behavior.

## Next action

Remediate on `agent/integration-dev-006`, rerun focused and full validation,
update integration evidence, and obtain a new independent review. Do not merge
or push.
