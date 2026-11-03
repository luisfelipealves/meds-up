---
id: DEV-004
type: development
title: Enforce doctor ownership isolation
status: READY
source: [PD-001, PD-008]
depends_on: [DEV-002, DEV-003]
parallel_class: SERIAL
assigned_agent: null
branch: null
worktree: null
updated_at: 2026-11-03T15:53:52Z
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
