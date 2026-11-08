---
id: DEV-009
type: development
title: Implement masked pre-claim identity confirmation
status: HUMAN_TESTING
source: [PD-001, PD-002]
depends_on: [DEV-008]
parallel_class: SERIAL
assigned_agent: codex-dev-team
branch: agent/dev-009-masked-identity
worktree: /home/felipe/projetos/meds-up-worktrees/dev-009-masked-identity
implemented_at: 2026-11-08T10:34:26Z
implementation_commit: e0486a0
review_status: PASS
review: .ai/reviews/DEV-009-independent-rereview.md
initial_review: .ai/reviews/DEV-009-independent-review.md
review_blocking_findings: 0
review_non_blocking_findings: 1
reviewed_commit: 40ec9df81cf6f90bc373ea4465908ca743dbe2fb
candidate_commit: 2e6228b05039984db23b9677db4752e36f1d3423
candidate_branch: agent/integration-dev-009
candidate_review: .ai/reviews/DEV-009-independent-rereview.md
candidate_review_commit: 9ef0565
rereview_status: PASS
rereview_blocking_findings: 0
rereview_non_blocking_findings: 1
rereviewed_commit: 2e6228b05039984db23b9677db4752e36f1d3423
rereview_record_commit: 9ef0565
handoff: .ai/development/handoffs/DEV-009-developer-handoff.md
remediation_metadata: .ai/development/handoffs/DEV-009-review-remediation.md
remediation_status: B1_B2_N1_REMEDIATED_REREVIEW_PASS
remediated_at: 2026-11-08T00:00:00Z
remediation_source_commits: [152f198, beb43af, 40f5271, 1436c77]
remediation_commits: [591ae78, ffe7b0b, fef87d5, 6376a54]
remediation_commit: ffe7b0b5a7d9c6906a2f3cc708bce8db9a1e4cce
integration_branch: agent/integration-dev-009
integration_worktree: /home/felipe/projetos/meds-up-worktrees/integration-dev-009
integration_base_commit: 479db3c9a00b887dc8c82d40dec4793532c8c79d
integration_commits: [8cf9a38, 4c54701, 72de2f7, 96869eb, 591ae78, ffe7b0b, fef87d5, 6376a54]
integration_handoff: .ai/development/integration/DEV-009-integration-handoff.md
integrated_at: 2026-11-08T10:49:00Z
ready_for_rereview: true
validation_status: PASSED
focused_tests: 37/37
validate_node: PASSED
validate_script: PASSED
diff_check: PASSED
human_testing_handoff: .ai/development/handoffs/DEV-009-human-testing.md
human_testing_status: APPROVED
human_approval: .ai/development/handoffs/DEV-009-human-approval.md
human_approved_at: 2026-11-08T11:32:48Z
merge_status: NOT_MERGED
push_status: NOT_PUSHED
rereview: .ai/reviews/DEV-009-independent-rereview.md
rereview_status: PASS
rereviewed_commit: 2e6228b05039984db23b9677db4752e36f1d3423
rereviewed_range: 479db3c9a00b887dc8c82d40dec4793532c8c79d..2e6228b05039984db23b9677db4752e36f1d3423
rereview_blocking_findings: 0
rereview_non_blocking_findings: 1
rereviewed_at: 2026-11-08T00:00:00Z
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
