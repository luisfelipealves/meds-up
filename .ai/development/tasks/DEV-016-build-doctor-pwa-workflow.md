---
id: DEV-016
type: development
title: Build doctor PWA prescription workflow
status: PLANNED
source: [PD-001, PD-008]
depends_on: [DEV-005, DEV-007, DEV-008]
parallel_class: PARALLEL_CONDITIONAL
parallel_notes:
  - Consumes stabilized backend contracts shared with Android.
assigned_agent: null
branch: null
worktree: null
---

# Objective
Build the doctor PWA flow for import, extraction review/correction, explicit confirmation, QR management, versioning, suspension, and cancellation.

# Scope
Accessible doctor UI, session-only import/review state, validation/error states, confirmation warning, QR issue/revoke/replace controls, version history, and ownership-scoped lists/details. The source document disappears when the OCR/AI request completes, fails, or expires. Reload, logout, review-session expiry, or abandonment discards the unconfirmed proposal and requires a new upload.

# Out of Scope
Patient claim UI, OCR provider internals, invitation administration, and prescriptions owned by other doctors.

# Acceptance Criteria
- Import proposals cannot be sent before explicit confirmation.
- The UI states that the document is not archived; neither source input nor raw OCR is recoverable after processing, and no unconfirmed proposal survives reload or session end.
- The confirmation UI explains that confirmed data becomes the reminder source.
- QR controls expose no clinical data in payload or presentation metadata.
- Cross-doctor records are unavailable.

# Validation
Component tests, accessibility checks, and browser journey tests for import through confirmation, QR lifecycle, versioning, suspension, and cancellation.

# Dependencies
DEV-005, DEV-007, and DEV-008.
