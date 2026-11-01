---
id: DEV-017
type: development
title: Build Android claim and schedule flow
status: PLANNED
source: [PD-001]
depends_on: [DEV-010, DEV-011, DEV-012]
parallel_class: PARALLEL_CONDITIONAL
assigned_agent: null
branch: null
worktree: null
---

# Objective
Build the Android flow for QR scanning, masked identity confirmation, account continuation, prescription association, and permitted schedule confirmation.

# Scope
Scan/input handling, safe token transport, new/existing account paths, claim outcomes, proposed times, permitted alternatives, and confirmation.

# Out of Scope
Choosing masking or schedule rules, clinical editing, and incorrect-claim recovery.

# Acceptance Criteria
- QR handling exposes no clinical data and does not persist raw tokens unnecessarily.
- Both new and existing patients can associate a prescription.
- Clinical content is read-only; only permitted reminder times can change.

# Validation
Android journey tests for success, expiry, revocation, reuse, mismatch, account paths, and invalid schedule alternatives.

# Dependencies
DEV-010, DEV-011, and DEV-012.
