---
id: DEV-020
type: development
title: Implement patient account and device recovery
status: PLANNED
source: [PD-001, PD-005]
depends_on: [DEV-003, DEV-015]
parallel_class: SERIAL
assigned_agent: null
branch: null
worktree: null
---

# Objective
Implement patient account recovery and lost/stolen-device response.

# Scope
Email/password patient access, verified-email recovery links, revocation of all existing sessions and authorized devices after recovery or lost-device declaration, safe re-enrollment, and new-device synchronization of only active prescriptions and approved schedules. Clearly communicate that prior local reminder-response history is neither uploaded nor restored and that offline devices cannot be remotely wiped.

# Out of Scope
SMS as a required factor, restoration/upload of local reminder history, biometric remote proof, and guaranteed remote wipe of an offline device.

# Acceptance Criteria
- A valid link sent to verified email recovers access without mandatory SMS.
- Recovery or lost-device declaration revokes all prior sessions/devices; revoked devices cannot resume synchronization when online.
- A new device receives only active prescriptions and approved schedules.
- Local history is never uploaded or represented as restored, and the product makes no offline remote-wipe promise.

# Validation
Threat-model-based recovery, revocation, replay, privacy, and multi-device tests.

# Dependencies
DEV-003 and DEV-015.
