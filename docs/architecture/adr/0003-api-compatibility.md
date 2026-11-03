# ADR-0003: API and client compatibility

- Status: Accepted
- Date: 2026-11-01
- Source: PD-001, DEV-001

## Context

Backend, browser, phone, and watch have different release cadences. Older offline clients must not recreate future reminders after a prescription is suspended, cancelled, or superseded.

## Decision

Define provider-neutral contracts before feature implementation. HTTP APIs will use an explicit major version prefix and additive evolution within a major version. Schemas use opaque identifiers, UTC timestamps with offsets, explicit resource/version fields, enumerated state transitions, and one stable error envelope. Unknown response fields must be ignored; required-field removal, semantic reinterpretation, and enum changes that break safe handling require a new major version.

Mutating commands that can be retried use scoped idempotency keys and return the resulting resource version. Synchronization uses monotonic server versions/cursors and tombstone/status events for suspension, cancellation, revocation, and supersession. Clients reject stale writes with an explicit conflict response and never infer successful delivery or a clinical action.

The API has no transport fields for source-document recovery, raw OCR/AI output, unconfirmed proposal recovery, or private reminder-response history. QR payloads contain only random one-time claim secrets; APIs persist only their secure digest.

## Consequences

- Contract fixtures and compatibility tests become required before client implementation.
- A deprecation window and supported-client matrix must precede removal.
- Server-side authorization and state/version checks remain authoritative even when clients filter UI.
