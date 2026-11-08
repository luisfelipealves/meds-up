---
id: DEV-009
type: development
title: Implement masked pre-claim identity confirmation
status: INTEGRATED
source: [PD-001, PD-002]
depends_on: [DEV-008]
parallel_class: SERIAL
assigned_agent: codex-dev-team
branch: agent/dev-009-masked-identity
worktree: /home/felipe/projetos/meds-up-worktrees/dev-009-masked-identity
implemented_at: 2026-11-08T10:34:26Z
implementation_commit: e0486a0
review_status: SELF_VALIDATED
handoff: .ai/development/handoffs/DEV-009-developer-handoff.md
integration_branch: agent/integration-dev-009
integration_worktree: /home/felipe/projetos/meds-up-worktrees/integration-dev-009
integration_base_commit: 479db3c9a00b887dc8c82d40dec4793532c8c79d
integration_commits: [8cf9a38, 4c54701, 72de2f7, 96869eb]
integration_handoff: .ai/development/integration/DEV-009-integration-handoff.md
integrated_at: 2026-11-08T10:37:37Z
ready_for_review: true
---

# Objective
Implement the identity projection and confirmation step shown to a patient before claim completion.

# Scope
Expose only patient initials and doctor/clinic name in the pre-claim confirmation; require authentication or account creation and backend date-of-birth comparison before association; apply attempt limits, return generic failures, and audit every attempt and outcome without enabling enumeration.

# Out of Scope
Account/device recovery, incorrect-claim recovery, clinical data display, and selection of the authentication provider.

# Acceptance Criteria
- Claim completion requires a matching date of birth.
- The pre-claim view shows no more than patient initials and doctor/clinic name.
- A mismatch or invalid token returns a generic contact-the-emitter outcome without confirming a patient's existence.
- Invalid tokens disclose no identity information.
- Failed attempts are rate-limited and every claim-confirmation attempt and outcome is auditable.
- Responses and telemetry minimize identity leakage and enumeration risk.

# Validation
Contract, authorization, enumeration, masking, mismatch, and UX tests based on the approved resolution.

# Dependencies
DEV-008.
