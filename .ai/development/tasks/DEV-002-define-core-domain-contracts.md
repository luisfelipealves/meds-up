---
id: DEV-002
type: development
title: Define core prescription and API contracts
status: IMPLEMENTED
source: [PD-001, PD-008]
depends_on: [DEV-001]
parallel_class: PARALLEL_CONDITIONAL
parallel_notes:
  - Stabilizes shared contracts used by backend and clients.
assigned_agent: developer-dev-002
branch: agent/dev-002-core-contracts
worktree: /home/felipe/projetos/meds-up-worktrees/dev-002-core-contracts
commit: da1bd862ff78629367dcb024c687ea6cd63a35f0
handoff: .ai/development/handoffs/DEV-002-developer-handoff.md
started_at: 2026-11-03T15:44:25Z
updated_at: 2026-11-03T15:51:27Z
completed_at: 2026-11-03T15:51:27Z
---

# Objective
Define contract-first models and API conventions for ephemeral document processing, session-only extraction proposals, confirmed prescriptions, immutable versions, prescription status, ownership, and audit references.

# Scope
Specify identifiers, timestamps, version fields, error envelopes, idempotency conventions, state transitions, and contract compatibility rules. Keep document input and unconfirmed proposals outside persistent domain and recovery contracts. Exclude scheduling semantics, which are defined by DEV-011 from PD-003.

# Out of Scope
Persistence implementation, OCR provider integration, client UI, and reminder-response history transport.

# Acceptance Criteria
- Ephemeral document input, session-only proposal, confirmed version, and non-clinical audit concepts are distinct.
- Contracts provide no retrieval or recovery path for source documents, raw OCR/AI responses, or unconfirmed proposals.
- Clinical content cannot be represented as confirmed without explicit doctor confirmation.
- Contracts support suspension, cancellation, and version retrieval.
- Contracts contain no backend field for private reminder-response history.

# Validation
Schema validation plus contract serialization and compatibility tests.

# Dependencies
DEV-001.

# Implementation Summary

Implemented `@medsup/contracts` as a dependency-free, provider-neutral v1 workspace with executable validation/serialization and published JSON Schema contracts. The surface distinguishes ephemeral document request metadata, session-only untrusted proposals, explicit doctor confirmation, confirmed prescriptions and immutable versions, ownership/status/version state, non-clinical audit references, version retrieval, idempotent status commands/events, and stable content-free errors. It includes no scheduling grammar, source-document/OCR/proposal persistence or recovery field, or private reminder-response transport.

# Validation Summary

- `npm test -w @medsup/contracts` — passed, 10 tests.
- `npm run build -w @medsup/contracts && npm run lint -w @medsup/contracts` — passed.
- `ANDROID_HOME=/home/felipe/.hermes/cache/scratch/android-sdk ANDROID_SDK_ROOT=/home/felipe/.hermes/cache/scratch/android-sdk ./scripts/validate.sh` — passed all Node, Android, and Wear build/test/lint/check commands.
- `git diff --check` — passed.

See `.ai/development/handoffs/DEV-002-developer-handoff.md` for RED evidence and integration notes.
