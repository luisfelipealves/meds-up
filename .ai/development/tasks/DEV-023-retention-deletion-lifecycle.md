---
id: DEV-023
type: development
title: Implement retention, export, and deletion lifecycle
status: PLANNED
source: [PD-001, PD-005, PD-006, PD-007, PD-008]
depends_on: [DEV-002, DEV-003, DEV-007, DEV-008, DEV-010, DEV-011, DEV-015, DEV-019, DEV-020, DEV-021, DEV-022]
parallel_class: SERIAL
assigned_agent: null
branch: null
worktree: null
---

# Objective
Implement the approved five-year retention lifecycle, patient data export,
account/data deletion, restricted exception retention, and backup safeguards
for server-side data.

# Product Decision
PD-007 sets a five-year normal retention period for pilot data in Portugal and
requires authenticated export and deletion operations. Clinical responsibility
of an issuing doctor does not remove the platform's data-protection duties.
PD-005 excludes local reminder-response history from backend data, and PD-008
supersedes PD-007 wherever it referred to persisted source documents or raw OCR.

# Scope
- Classify persisted server-side data and record the clinically or operationally relevant event that anchors or restarts each five-year retention period; explicitly exclude local reminder-response history, ephemeral source documents, raw OCR/AI responses, and unconfirmed proposals.
- Build authenticated, auditable export requests and generation.
- Build recent-authenticated deletion requests, account/session/token
  revocation, deletion/anonymisation lifecycle, and status reporting.
- Build restricted, reviewed retention exceptions and deletion tombstones.
- Define encrypted backup expiry and restore behavior that honours tombstones.
- Add no-clinical-content controls to operational logs and metrics.

# Out of Scope
- Remote deletion guarantees for offline device-local data.
- Retention rules for a physician's systems outside MedsUp.
- Replacing legal or DPO review with application code.

# Acceptance Criteria
- Eligible patient data can be exported without third-party or security-secret
  disclosure.
- Confirmed deletion blocks account access, sessions, tokens and future sync.
- Each data class follows the approved five-year lifecycle unless an auditable,
  restricted exception applies.
- Retention anchors and restarts are deterministic and auditable per data class.
- Expired data is deleted or anonymised by a verifiable process.
- Backup restoration cannot recreate completed deletions.
- Logs and metrics exclude clinical content.
- No export, deletion, backup, or retention mechanism creates a persistent copy of a source document, raw OCR/AI response, or unconfirmed proposal.

# Validation
Authorization, data-isolation, export completeness, deletion state-transition,
session/token invalidation, lifecycle expiry, exception-review, backup-restore,
audit-integrity, and log-redaction tests.

# Dependencies
DEV-002, DEV-003, DEV-007, DEV-008, DEV-010, DEV-011, DEV-015, DEV-019,
DEV-020, DEV-021, and DEV-022.
