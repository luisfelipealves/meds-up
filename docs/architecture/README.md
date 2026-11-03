# Architecture foundation

## Boundaries

- **Backend domain/application:** platform-independent rules and use cases. It depends on ports, never provider SDKs.
- **Backend adapters:** future replaceable implementations of `IdentityPort`, `ConfirmedPrescriptionRepository`, `EphemeralExtractionPort`, `KeyManagementPort`, `NotificationPort`, audit, and clock/identifier ports.
- **Doctor PWA:** browser client for future doctor workflows. It has no persistence mechanism in the foundation. Ephemeral extraction state must remain in memory and disappear on reload, logout, timeout, error, or abandonment.
- **Android:** patient management authority and future encrypted local reminder/history store. Local reminder-response history is excluded from backend contracts and telemetry.
- **Wear OS:** constrained reminder extension. The phone remains management authority.
- **Contracts:** future versioned, platform-neutral schemas shared by generated or hand-written client bindings. Provider types cannot cross this boundary.

## Dependency rule

Runtime surfaces may depend on contracts and surface-local application code. Domain/application code may depend only on explicit ports. Adapters depend inward on those ports. A provider SDK, persistence driver, cloud resource name, or mobile framework type must not appear in domain contracts.

## Health-data invariants

Persistent models may represent only explicitly confirmed structured prescriptions and necessary account, association, claim-digest, version, retention, and security/audit metadata. No source document, image, PDF, scan, raw OCR/AI output, or unconfirmed proposal has a repository interface, durable message type, backup route, shared-cache key, browser storage schema, analytics event, or trace field.

`EphemeralExtractionPort` is request-scoped and streaming/in-memory. It accepts validated bytes without creating a durable locator, returns an untrusted proposal to the active server/browser session, and must release both on completion, failure, timeout, logout, reload, or abandonment. Future provider adapters require retention/training controls and appropriate EU processing terms; no provider is selected here.

## Security defaults

- TLS at every network boundary; no health data in URLs or QR payloads.
- Opaque IDs and one-way digests for claim secrets; authorization in service/query layers.
- Encryption for approved persistent health data and its backups, with replaceable key management.
- Structured allow-listed logging with content redaction; traces and analytics contain no clinical content.
- Least privilege, environment isolation, auditable access, dependency pinning, and negative authorization tests.
- Client compatibility and deletion/retention behavior are contract concerns, not provider behavior.

## Records

- [ADR-0001 — platform and repository structure](adr/0001-platform-and-repository-structure.md)
- [ADR-0002 — health data and ephemeral processing](adr/0002-health-data-and-ephemeral-processing.md)
- [ADR-0003 — API compatibility](adr/0003-api-compatibility.md)
- [ADR-0004 — EU deployment and provider boundaries](adr/0004-eu-deployment-and-provider-boundaries.md)
