---
id: DEV-009
type: development
title: Implement masked pre-claim identity confirmation
status: PLANNED
source: [PD-001, PD-002]
depends_on: [DEV-008]
parallel_class: SERIAL
assigned_agent: null
branch: null
worktree: null
---

# Objective
Implement the identity projection and confirmation step shown to a patient before claim completion.

# Scope
After authentication or account creation, expose only patient initials and doctor/clinic name for a valid-token lookup; compare date of birth in the backend, apply attempt limits, return generic failures, and audit the outcome without enabling enumeration.

# Out of Scope
Account/device recovery, incorrect-claim recovery, clinical data display, and selection of the authentication provider.

# Acceptance Criteria
- Claim completion requires a matching date of birth.
- The pre-claim view shows no more than patient initials and doctor/clinic name.
- A mismatch or invalid token returns a generic contact-the-emitter outcome without confirming a patient's existence.
- Invalid tokens disclose no identity information.
- Responses and telemetry minimize identity leakage and enumeration risk.

# Validation
Contract, authorization, enumeration, masking, mismatch, and UX tests based on the approved resolution.

# Dependencies
DEV-008.
