---
task: DEV-001
status: IMPLEMENTED
branch: agent/dev-001-foundation
worktree: /home/felipe/projetos/meds-up-worktrees/dev-001-foundation
commit: 0dffdd93fb25db62a52509852d26feb04d7f7346
completed_at: 2026-11-01T20:15:17Z
---

# Developer handoff — DEV-001

## Files changed

- Workflow: `.ai/development/tasks/DEV-001-establish-project-foundation.md`, `.ai/development/tasks/DEV-002-define-core-domain-contracts.md`, `.ai/development/tasks/DEV-003-implement-identity-foundation.md`, `.ai/development/technical-plan-PD-001.md`
- Root/tooling: `.env.example`, `.gitignore`, `Makefile`, `README.md`, `package.json`, `package-lock.json`, `build.gradle.kts`, `settings.gradle.kts`, `gradle.properties`, `gradlew`, `gradle/wrapper/*`
- Runtime foundations/tests: `apps/backend/**`, `apps/pwa/**`, `apps/android/**`, `apps/wear/**`
- Architecture/operations: `docs/architecture/**`, `docs/environments.md`, `docs/secrets.md`
- Validation tooling: `scripts/build-node-surface.mjs`, `scripts/check-foundation.mjs`, `scripts/validate.sh`

## Implementation

- Established explicit backend, doctor PWA, Android, and Wear OS roots with per-surface build, unit-test, lint, and static-check commands.
- Added a single `make validate`/`./scripts/validate.sh` entry point that runs all 12 baseline commands and reports all failures rather than stopping after the first surface.
- Added pinned npm and Gradle dependency entry points and minimal executable/tested runtime shells without product features or deployment configuration.
- Documented isolated environments, secret injection/redaction, health-data controls, client compatibility, EU deployment constraints, and replaceable identity/persistence/OCR/key-management/notification boundaries.
- Encoded PD-008 as an architecture invariant and negative static checks: no source-document/OCR persistence contract, durable queue, shared cache, browser persistence, service worker, backup route, analytics payload, or trace payload exists.
- Disabled Android/Wear application backup and data transfer in the foundation; marked Wear as non-standalone to preserve phone authority.
- Advanced newly unblocked DEV-002 and DEV-003 to `READY`.

## Validation

Environment used: Node `26.7.0`, npm `11.19.0`, OpenJDK `21.0.12.1`, Gradle `8.11.1`, temporary Android SDK Platform/Build Tools `35` under the Hermes scratch directory.

`ANDROID_HOME=/home/felipe/.hermes/cache/scratch/android-sdk ANDROID_SDK_ROOT=/home/felipe/.hermes/cache/scratch/android-sdk ./scripts/validate.sh` — **PASSED**:

- `npm run build` — backend and PWA builds passed.
- `npm test` — 4 Node tests passed.
- `npm run lint` — Node syntax checks passed.
- `npm run static-check` — required layout and prohibited runtime-mechanism checks passed.
- `./gradlew :apps:android:assembleDebug` — passed.
- `./gradlew :apps:android:testDebugUnitTest` — passed.
- `./gradlew :apps:android:lintDebug` — passed.
- `./gradlew :apps:android:check` — passed.
- `./gradlew :apps:wear:assembleDebug` — passed.
- `./gradlew :apps:wear:testDebugUnitTest` — passed.
- `./gradlew :apps:wear:lintDebug` — passed.
- `./gradlew :apps:wear:check` — passed.

The first validation attempt accurately failed because no Android SDK was installed. A temporary SDK was then installed outside the repository, Wear lint identified the missing non-standalone declaration, that defect was fixed, and the complete validation suite passed.

## Known issues

- None in DEV-001 scope.
- Developers running mobile checks must install Android SDK Platform 35 and Build Tools 35 and set `ANDROID_HOME`, `ANDROID_SDK_ROOT`, or ignored `local.properties`; the SDK is intentionally not committed.
- Production provider selection, deployment topology, identity implementation, persistent confirmed-prescription storage, and ephemeral OCR adapter implementation remain later tasks and approval gates.

## Integration notes

- Integrate branch HEAD; implementation is anchored at commit `0dffdd93fb25db62a52509852d26feb04d7f7346` and the later branch commits preserve workflow evidence and repository hygiene.
- Preserve the port names and PD-008 negative boundary when DEV-002/DEV-003 introduce contracts or adapters.
- No merge to `main`, push, GitHub action, deployment, provider selection, or `.ai/backups` modification was performed.
