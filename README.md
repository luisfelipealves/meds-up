# MedsUp

Greenfield monorepo foundation for the backend, doctor PWA, Android client, and Wear OS extension. This repository currently contains infrastructure and empty runtime shells only; it does not implement product features.

## Runtime surfaces

| Surface | Location | Build | Test | Lint | Static check |
| --- | --- | --- | --- | --- | --- |
| Backend | `apps/backend` | `make backend-build` | `make backend-test` | `make backend-lint` | `make backend-static-check` |
| Doctor PWA | `apps/pwa` | `make pwa-build` | `make pwa-test` | `make pwa-lint` | `make pwa-static-check` |
| Android | `apps/android` | `make android-build` | `make android-test` | `make android-lint` | `make android-static-check` |
| Wear OS | `apps/wear` | `make wear-build` | `make wear-test` | `make wear-lint` | `make wear-static-check` |

Run all commands with `make validate`. Node 22+ and JDK 17+ are required. Android/Wear checks additionally require Android SDK Platform 35, Build Tools 35, and an SDK path in `ANDROID_HOME`, `ANDROID_SDK_ROOT`, or untracked `local.properties`.

Install the dependency lockfile with `npm ci`. The Gradle wrapper downloads the pinned Gradle distribution; application dependencies resolve only from Google Maven and Maven Central.

## Safety boundaries

- Never commit `.env`, `local.properties`, keystores, credentials, claim tokens, or health data.
- Source documents, scans, images, PDFs, raw OCR/AI output, and unconfirmed proposals are memory-only and must not enter databases, object storage, backups, durable queues, shared caches, browser persistence, logs, analytics, or traces.
- Only corrected, explicitly doctor-confirmed structured prescriptions may become persistent records.
- Do not add a storage, identity, OCR/AI, notification, key-management, or cloud provider directly to domain code. Implement the documented port and adapter boundary.
- Do not send local reminder-response history to backend APIs, telemetry, analytics, or crash reporting.

See [`docs/architecture`](docs/architecture/README.md), [`docs/environments.md`](docs/environments.md), and [`docs/secrets.md`](docs/secrets.md) before adding runtime behavior.
