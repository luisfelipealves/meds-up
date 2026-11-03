---
task: DEV-001
status: HUMAN_TESTING
branch: agent/dev-001-foundation
reviewed_commit: be0758e01ff55e899911d77c7a20174fa6c77df2
review_commit: dec0f7f75269b510795c5b894bb52e3c49340f97
prepared_at: 2026-11-01T20:18:50Z
human_test_result: APPROVED
human_approved_at: 2026-11-03T15:39:03Z
merged_at: 2026-11-03T15:41:55Z
merge_commit: aa1b7b2c7c11a107560d600eaee395befb4aa204
merge_status: MERGED_LOCAL
---

# Human testing handoff — DEV-001

## What to validate

The branch establishes project structure and validation only. It must expose executable foundations for backend, doctor PWA, Android, and Wear OS without implementing product features, deployment, or persistent handling of source documents, raw OCR/AI output, or unconfirmed proposals.

## Prerequisites

- Node 22 or newer.
- JDK 17 or newer.
- Android SDK Platform 35 and Build Tools 35.
- Set `ANDROID_HOME` or `ANDROID_SDK_ROOT`, or create an untracked `local.properties`.

## Manual validation

1. Open `/home/felipe/projetos/meds-up-worktrees/dev-001-foundation` and verify `git branch --show-current` reports `agent/dev-001-foundation`.
2. Run `npm ci` if dependencies are not already installed.
3. Run `make validate` with the Android SDK configured. Verify all 12 build/test/lint/static-check commands finish with `all validation commands passed`.
4. Inspect the runtime table in `README.md`. Verify backend, PWA, Android, and Wear OS each list separate build, test, lint, and static-check commands.
5. Run one command from each surface, for example `make backend-test`, `make pwa-static-check`, `make android-build`, and `make wear-lint`.
6. Review `docs/environments.md` and `docs/secrets.md`. Verify local, test, staging, and production separation is explicit and no real credential value is present in `.env.example`.
7. Review `docs/architecture/adr/0002-health-data-and-ephemeral-processing.md`. Verify it forbids persistence of source documents, images, PDFs, scans, raw OCR/AI output, and unconfirmed proposals across databases, object storage, backups, durable queues, shared caches, browser persistence, logs, analytics, and traces.
8. Verify there is no deployment configuration or product workflow/UI in the branch and that provider choices remain replaceable boundaries rather than selected clinical vendors.
9. Run `git status --short`. Build products may exist only in ignored paths; no source or workflow file should be unexpectedly modified.

## Automated evidence

- Coordinator validation: all 12 commands passed.
- Independent review: PASS, 0 blocking findings, 2 non-blocking validation-hardening observations.
- Review record: `.ai/reviews/DEV-001-independent-review.md`.

## Known limitations

- Android SDK Platform/Build Tools 35 are external prerequisites.
- The reviewer noted unused root Node test globs and that the PD-008 negative static guard should expand as future source roots/adapters are added. Neither finding blocks this foundation.
- Production deployment, providers, product behavior, and clinical workflows remain outside DEV-001.

## Approval boundary

Approval of DEV-001 confirms this foundation for downstream development. It does not authorize merging into `main`, pushing to GitHub, deployment, or provider selection. Those actions require separate explicit instructions.

Human testing was approved on `2026-11-03T15:39:03Z`. The separate approval record is `.ai/development/handoffs/DEV-001-human-approval.md`.
