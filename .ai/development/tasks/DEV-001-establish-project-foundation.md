---
id: DEV-001
type: development
title: Establish project structure and validation foundation
status: REVIEW
source: [PD-001, PD-007, PD-008]
depends_on: []
parallel_class: PARALLEL_SAFE
assigned_agent: developer-001
branch: agent/dev-001-foundation
worktree: /home/felipe/projetos/meds-up-worktrees/dev-001-foundation
started_at: 2026-11-01T20:10:30Z
updated_at: 2026-11-01T20:16:57Z
completed_at: 2026-11-01T20:15:17Z
commit: 0dffdd93fb25db62a52509852d26feb04d7f7346
handoff: .ai/development/handoffs/DEV-001-developer-handoff.md
integration_branch: agent/dev-001-foundation
integration_commit: 08f877f3aa4a34efe06dadab2ed8ddcc4824b693
integration_handoff: .ai/development/integration/DEV-001-integration-handoff.md
---

# Objective
Establish the greenfield repository structure and common build, test, lint, and architecture conventions for backend, PWA, Android, and Wear OS work.

# Scope
Define project boundaries, workspace layout, baseline validation commands, environment separation, and architecture records for selected technologies. Keep vendor services replaceable and prohibit durable infrastructure paths for source documents, raw OCR/AI responses, or unconfirmed proposals.

# Out of Scope
Product features, production deployment, vendor-specific clinical behavior, and application UI.

# Acceptance Criteria
- All four runtime surfaces have an explicit location and build/test entry point.
- Common validation and secret-handling conventions are documented and executable.
- Technology choices address health-data security, client compatibility, and EU deployment constraints.
- Baseline architecture contains no document bucket, durable document/OCR queue, browser persistence, or backup path for ephemeral clinical input.
- No credentials or health data are committed.

# Validation
Run each baseline build, test, lint, and static-check command defined by the selected toolchain.

# Dependencies
None.

# Implementation Summary

Created executable foundations for the backend, doctor PWA, Android, and Wear OS surfaces; common build/test/lint/static-check entry points; environment and secret conventions; and architecture decisions for health-data security, compatibility, EU deployment constraints, and replaceable providers. The runtime foundation creates no durable document/OCR path or browser persistence.

# Validation Summary

`./scripts/validate.sh` passed all 12 baseline commands with Node 26.7.0, JDK 21.0.12.1, Gradle 8.11.1, and a temporary Android SDK 35 installation. See `.ai/development/handoffs/DEV-001-developer-handoff.md` for command-level evidence and integration notes.
