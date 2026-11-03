---
id: DEV-004
type: development
title: Enforce doctor ownership isolation
status: INTEGRATED
source: [PD-001, PD-008]
depends_on: [DEV-002, DEV-003]
parallel_class: SERIAL
assigned_agent: developer-dev-004
branch: agent/dev-004-doctor-ownership
worktree: /home/felipe/projetos/meds-up-worktrees/dev-004-doctor-ownership
started_at: 2026-11-03T17:28:46Z
updated_at: 2026-11-03T17:48:02Z
completed_at: 2026-11-03T17:31:14Z
commit: 5d0adfe4bd980e3706a58d00ca409bd2ca053dd0
handoff: .ai/development/handoffs/DEV-004-developer-handoff.md
integration_branch: agent/integration-dev-004
integration_worktree: /home/felipe/projetos/meds-up-worktrees/integration-dev-004
initial_integration_commit: 7f540c698e0a2ca1c8981519fd3741fb6b6d06a6
integration_commit: 329d5f183eb8fdf960d506a68c97cf3a940b49b2
remediation_commit: 2a7c804d0e9ae3bd28411130df4416f910363a49
metadata_validation_commit: e10082da77acb3b853b9c00d6fbcbe54beb8e501
identifier_validation_commit: 329d5f183eb8fdf960d506a68c97cf3a940b49b2
integrated_at: 2026-11-03T17:32:59Z
integration_handoff: .ai/development/integration/DEV-004-integration-handoff.md
integration_validation: PASSED
review: .ai/reviews/DEV-004-independent-review.md
reviewed_commit: eddb178f171a98738b018b65afff1a45298d068b
review_status: REMEDIATED_PENDING_REREVIEW
previous_review_blocking_findings: 3
final_review: .ai/reviews/DEV-004-independent-final-review.md
final_reviewed_code_commit: 2a7c804d0e9ae3bd28411130df4416f910363a49
final_review_status: CHANGES_REQUIRED
final_review_blocking_findings: 1
second_final_review: .ai/reviews/DEV-004-independent-second-final-review.md
second_final_review_status: CHANGES_REQUIRED
second_final_reviewed_code_commit: e10082da77acb3b853b9c00d6fbcbe54beb8e501
second_final_review_blocking_findings: 1
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

# Integration Summary

Developer branch `agent/dev-004-doctor-ownership` at `6320c9f65fc08659b036a153d51a79d2626bf36f` was independently verified and merged without conflicts into `agent/integration-dev-004` at `7f540c698e0a2ca1c8981519fd3741fb6b6d06a6`. Integrator validation passed the focused 5-test ownership suite, the complete 22-test backend suite, syntax and diff checks, and the full Node/Android/Wear repository validator. PD-008 remains preserved: the integrated runtime adds only authorization over injected repositories and introduces no durable or queryable document, raw OCR/AI output, or unconfirmed-proposal path.

# Review Status

Independent review of `eddb178f171a98738b018b65afff1a45298d068b` returned three blocking findings: contract-defined ownership metadata is missing for versions/audit references, authority-bearing owner fields can cross the mutation boundary, and active review-session results do not enforce a metadata-only PD-008 projection. DEV-004 is blocked pending focused remediation and independent re-review.

Remediation commit `2a7c804d0e9ae3bd28411130df4416f910363a49` adds explicit internal authorization projections, sanitizes authority-bearing mutation fields before one atomic repository call, and restricts active review-session results to allow-listed metadata. Focused, backend, contracts, and full Node/Android/Wear validation passed. DEV-004 is `INTEGRATED` pending independent re-review.

The independent re-review confirmed B1 and B2 resolved and B3 materially remediated, but found one residual blocker: allow-listed active-session metadata keys accepted arbitrary nested values. DEV-004 is blocked pending fail-closed scalar metadata validation and another independent review.

Residual B4 is remediated by `e10082da77acb3b853b9c00d6fbcbe54beb8e501`.
Retained active-session metadata now requires bounded scalar identifiers,
allow-listed status, and valid optional timestamps; malformed values fail
closed without echoing content. Focused ownership (7/7), backend (24/24),
contracts (13/13), and full Node/Android/Wear validation passed. DEV-004 is
`INTEGRATED` pending another independent review; no approval is claimed.

The second final review found one residual blocker: the generic opaque-ID
grammar can accept identifier-shaped sensitive strings. DEV-004 is blocked
pending a generated review-session identifier format and independent re-review.

Commit `329d5f183eb8fdf960d506a68c97cf3a940b49b2` constrains active review-session
identifiers to the generated `review_session_` plus 32 lowercase-hex format and
adds get/list/mutation tests for sensitive scalar identifiers. Focused,
backend, contracts, and full Node/Android/Wear validation passed. DEV-004 is
`INTEGRATED` pending independent review; no approval is claimed.
