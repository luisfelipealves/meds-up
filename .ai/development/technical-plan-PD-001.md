---
id: TECH-PLAN-PD-001
type: technical-plan
title: MedsUp MVP — technical delivery plan
status: PLANNED
source:
  - PD-001
created_at: 2026-11-01T19:07:37Z
updated_at: 2026-11-01T19:07:37Z
---

# Objective

Define the technical delivery plan for PD-001 without selecting product behavior that the approved decision leaves open. This plan creates no implementation authorization beyond the already approved product scope; every executable DEV task remains `PLANNED`, except tasks directly blocked by unresolved product behavior, which are `BLOCKED`.

# Intake and repository state

- PD-001 is `APPROVED_FOR_DEVELOPMENT`.
- The repository is greenfield: it contains the `.ai` workflow and PD-001, but no application code, manifests, schemas, test infrastructure, CI, or deployment configuration.
- There are no existing implementation patterns to preserve. Initial architecture must therefore establish explicit boundaries and contract-first interfaces.
- The untracked `.ai/backups/` directory predates this plan and is outside this work; it must not be modified or included in later DEV commits.

# Proposed architecture boundaries

1. Backend-independent API and domain layer for identity, prescriptions, versions, claims, schedules, synchronization, and audit.
2. Replaceable adapters for authentication, object storage, OCR/AI, notification delivery, encryption/key management, and persistence.
3. Doctor PWA for document import, extraction review, explicit confirmation, claim QR management, versioning, suspension, and cancellation.
4. Android client as the patient authority for agenda management and private reminder-response history.
5. Wear OS extension for reminder presentation and actions, with the phone remaining the management authority.
6. Append-only or immutable prescription versions and auditable security/domain events.
7. Contract-based synchronization that is idempotent and prevents stale clients from recreating reminders after suspension or cancellation.

# Data and domain model direction

Keep these concepts distinct:

- doctor invitation, doctor identity, patient identity, session, and device;
- source document, extraction proposal, confirmed prescription, and prescription version;
- prescription ownership and patient-prescription association;
- claim token and claim attempt;
- clinical schedule constraints, proposed reminder schedule, and patient-confirmed schedule;
- backend prescription state versus device-local reminder and response history;
- operational/security audit events versus mutable domain records.

The backend must never receive the MVP reminder-response history (`SEM_CONFIRMACAO`, `TOMADA`, `ADIADA`, `DISPENSADA`) through sync, telemetry, analytics, or doctor-facing APIs.

# API and compatibility direction

- Stabilize shared contracts before independent backend, PWA, Android, and Wear implementation.
- Use opaque identifiers, explicit version fields, idempotency where repeated commands are possible, and a consistent error model.
- Preserve backward compatibility between deployed clients and backend contract versions.
- Make ownership checks part of service/query authorization, not only UI filtering.
- Model suspension/cancellation and clinical version changes as explicit server events consumed by clients.

# Persistence and concurrency direction

- Use transactional storage for claim issuance/consumption, ownership, confirmed versions, and audit linkage.
- Claim token consumption must atomically validate digest, expiry, revocation, prior use, and intended association.
- Store only a secure digest of claim secrets; raw secrets may appear only in the one-time QR delivery path and never in logs.
- Confirmed clinical content must not be overwritten in place.
- Android local persistence must retain already synchronized reminders temporarily offline and preserve local history when future reminders are removed.

# Security and privacy requirements

- Treat documents, structured prescriptions, identity, and patient-prescription relationships as health data.
- Encrypt transport, persisted health data, documents, and backups; make provider and key-management choices replaceable until architecture selection.
- Validate file signatures and limits, isolate document processing, and treat OCR output as untrusted.
- Rate-limit and audit authentication, invite redemption, token lookup, claim attempts, revocation, and access-control failures.
- Prevent clinical data, identity data, claim tokens, and medication details from leaking through QR payloads, URLs, logs, analytics, crash reports, referrers, lock screens, or watch notifications.
- Add negative authorization tests proving one doctor cannot access another doctor's prescriptions, documents, versions, or claim controls.
- Production release remains gated by GDPR, retention, residency, regulatory classification, and operational-control decisions.

# Testing strategy

- Domain unit tests for state machines, schedule validation, immutable versioning, and reminder transitions.
- Persistence/integration tests for transaction boundaries, replay races, expiry, revocation, ownership, and synchronization.
- Contract tests shared by backend and clients.
- Security tests for cross-doctor access, token leakage, enumeration, unsafe uploads, and logs.
- Android tests for offline startup, reboot, timezone/DST change, scheduling, cancellation, and local-history preservation.
- PWA and Android journey tests for import-to-confirmation and claim-to-schedule flows.
- Wear tests for disconnected behavior and phone-authoritative reconciliation.
- End-to-end acceptance tests covering every criterion in PD-001 after integration.

# Technical uncertainties

These require implementation-time architecture decisions or focused spikes, not new product behavior:

- backend language/framework, API style, database, and migration tooling;
- monorepo structure and build/test conventions;
- identity provider versus first-party identity;
- object storage, encryption/KMS, and EU deployment region;
- OCR/AI provider and extraction provenance representation;
- Android UI/persistence/background-work stack and Wear data layer;
- push delivery versus local scheduling and the offline sync protocol;
- audit tamper-evidence, observability, and local database encryption.

Provider choices should remain behind adapters with deterministic fakes so domain implementation and tests are not vendor-blocked.

# Blocking product ambiguities

The following ambiguities are recorded here rather than silently decided by development:

- `PA-001 — Masked identity`: attributes shown, masking rules, mismatch behavior, and correction path. Blocks DEV-009.
- `PA-002 — Scheduling semantics`: supported frequency forms, strict interval behavior, permitted windows/tolerance, duration rules, and the exact effect of `ADIADA`. Blocks DEV-011.
- `PA-003 — Doctor invitation policy`: issuer, expiry duration, replacement behavior, and pilot administration flow. Blocks DEV-019.
- `PA-004 — Account/device recovery`: recovery proof, device/session revocation, and treatment of device-local history. Blocks DEV-020.
- `PA-005 — Incorrect claim recovery`: authorized actor, proof, detach/reissue behavior, and treatment of already synchronized local data. Blocks DEV-021.
- `PA-006 — Retention/deletion`: retention periods, deletion, legal hold, audit preservation, and backup lifecycle. Blocks DEV-023.

These identifiers are local references inside development planning, not approved Product Decisions. Resolution requires the product workflow before the blocked task can be replanned.

# Dependency graph

```text
DEV-001 ─┬─ DEV-002 ─┬─ DEV-004 ─┬─ DEV-005 ─ DEV-006 ─ DEV-007 ─┬─ DEV-008 ─ DEV-009 ─ DEV-010
         │           │           │                               │
         │           │           └───────────────────────────────┼─ DEV-016
         │           └─ DEV-011 ─────────────────────────────────┼─ DEV-012 ─ DEV-013 ─ DEV-014 ─┬─ DEV-015
         │                                                       │                                └─ DEV-018
         └─ DEV-003 ─┬─ DEV-004                                  └─ DEV-017
                     ├─ DEV-008
                     ├─ DEV-019
                     └─ DEV-020

DEV-008 + DEV-010 ─ DEV-021
DEV-007 + DEV-012 + DEV-014 ─ DEV-015
DEV-010 + DEV-011 + DEV-012 ─ DEV-017
DEV-013 + DEV-014 ─ DEV-018
DEV-022 ─┬─ DEV-023
DEV-002 ─┤
DEV-005 ─┘
```

# Parallelization plan

- DEV-001 and DEV-022 have no technical dependency and may eventually run independently, but both remain `PLANNED`.
- After DEV-001, contracts (DEV-002) and identity foundation (DEV-003) may proceed in parallel.
- Document ingestion and scheduling-policy work use separate surfaces after their shared contracts stabilize.
- PWA, Android, and Wear work starts only after the relevant contracts and domain behavior exist.
- Shared contracts and schemas should be integrated before downstream parallel client implementation to avoid divergent models.

# Scope control

This plan excludes monetization, stock management, manual patient-entered medication, adherence monitoring, autonomous clinical interpretation, iOS/watchOS, production deployment, and final vendor selection unless a later approved decision adds them.

# Planned deliverables

Task specifications are stored in `.ai/development/tasks/DEV-001-*.md` through `.ai/development/tasks/DEV-023-*.md`. No task is assigned, started, branched, implemented, integrated, or advanced to human testing by this planning action.
