# ADR-0004: EU deployment and provider boundaries

- Status: Accepted
- Date: 2026-11-01
- Source: PD-007, PD-008, DEV-001

## Context

The pilot is in Portugal and processes special-category health data. No irreversible cloud, identity, OCR/AI, notification, database, or key-management vendor decision is authorized in this task.

## Decision

Keep infrastructure providers behind narrow ports and environment configuration. Production health data, encrypted backups, keys, support access, and processing must remain in approved EU locations; cross-border transfers require documented legal/security approval. Each processor requires due diligence, a data-processing agreement, subprocessor/transfers review, breach/support controls, deletion evidence, and an exit/export plan.

An OCR/AI adapter additionally requires request/response retention disabled or strictly minimized, no provider training, bounded in-request processing, and verified deletion/expiry behavior. A provider that requires durable retry or retains clinical content cannot implement the port.

Production architecture must provide environment and tenant isolation, least-privilege workload identity, customer-controlled or equivalently segregated key references, encryption in transit/at rest, auditable administrative access, deletion-aware encrypted backup expiry for confirmed data only, and tested restore/deletion reconciliation. Logs, metrics, traces, analytics, crash reports, and support tools are non-clinical by construction.

## Consequences

- Local deterministic fakes are the default until separately approved adapters exist.
- Deployment and provider selection require a later reviewed ADR and regulatory/security gate.
- Domain and client contracts remain portable across providers.
- This ADR creates constraints, not production infrastructure or a deployment authorization.
