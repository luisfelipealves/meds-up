---
id: DEV-004
type: development
title: Enforce doctor ownership isolation
status: IMPLEMENTED
source: [PD-001, PD-008]
depends_on: [DEV-002, DEV-003]
parallel_class: SERIAL
assigned_agent: developer-dev-004
branch: agent/dev-004-doctor-ownership
worktree: /home/felipe/projetos/meds-up-worktrees/dev-004-doctor-ownership
started_at: 2026-11-03T17:28:46Z
updated_at: 2026-11-03T17:31:14Z
completed_at: 2026-11-03T17:31:14Z
commit: 5d0adfe4bd980e3706a58d00ca409bd2ca053dd0
handoff: .ai/development/handoffs/DEV-004-developer-handoff.md
---

# Objective
Enforce that each doctor can access and manage only prescriptions and related records they created or imported.

# Scope
Service/query authorization for active ephemeral review sessions, confirmed prescriptions, versions, audit references, and claim controls, including negative access tests. Documents and proposals must not become durable queryable records.

# Out of Scope
Administrative break-glass access, invitation policy, and patient-local reminder history.

# Acceptance Criteria
- Ownership is checked server-side on every covered read and mutation.
- Cross-doctor identifiers do not reveal record existence beyond the approved error policy.
- Patient-local reminder history is not queryable by doctors.

# Validation
Integration tests with at least two doctors covering direct-ID and list/query isolation.

# Dependencies
DEV-002 and DEV-003.

# Implementation Summary

Added a provider-neutral backend authorization service that derives doctor ownership exclusively from DEV-003's injected authenticated-subject authority. It enforces owned direct reads, owner-scoped lists, and owner-atomic mutations for active ephemeral review sessions, confirmed prescriptions, versions, audit references, and claim controls. Missing, inactive, and cross-doctor direct identifiers all return the shared content-free `NOT_FOUND`; the service exposes no patient-local reminder-history path and introduces no persistence or provider choice.

# Validation Summary

Strict RED/GREEN evidence is recorded in the developer handoff. The focused ownership suite passed 5/5 tests, the backend suite passed 22/22 tests, explicit nested-source syntax checks passed, `git diff --check` passed, and the full Node/Android/Wear `./scripts/validate.sh` completed successfully.
