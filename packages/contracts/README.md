# `@medsup/contracts`

Provider-neutral v1 prescription and API contracts. The package contains executable validators/serializers and JSON Schema 2020-12 definitions. It has no runtime dependencies.

## Lifecycle boundaries

- `EphemeralDocumentInput` is request metadata only. The document body is streamed separately and has no locator, repository identifier, filename, durable message, recovery token, or persistence contract.
- `UntrustedPrescriptionProposal` is marked `SESSION_ONLY_UNTRUSTED`, belongs to the active review session, and expires with that session. It has no confirmed prescription ID or recovery path.
- `DoctorConfirmationCommand` requires `decision: CONFIRMED`, the confirming doctor to match the owner, corrected structured content, and an idempotency key. `PrescriptionClinicalChangeCommand` applies the same explicit-confirmation gate to later clinical changes and additionally requires an expected resource version.
- `ConfirmedPrescription` and `PrescriptionVersion` are the only confirmed domain records. They use opaque IDs, UTC timestamps with offsets, positive resource/prescription versions, explicit ownership, and immutable doctor-confirmed clinical versions.
- `AuditReference` permits only an allow-listed event type, coarse outcome, timestamp, and opaque security correlation. It contains no clinical or provider content.

Private patient reminder-response history is not represented by this package. Clinical scheduling grammar is intentionally deferred to DEV-011.

## API conventions

- Every HTTP route starts with `/v1`; version retrieval uses `/v1/prescriptions/{prescriptionId}/versions/{positiveVersion}`.
- Commands that may be retried carry an opaque 16–128 character `idempotencyKey`, scoped by the service to the authenticated actor and command type. Reuse with the same command returns the original resulting resource/version; reuse with different command content returns `IDEMPOTENCY_CONFLICT`.
- Mutations include `expectedResourceVersion`. Stale mutations return `STALE_RESOURCE_VERSION`; successful results expose the resulting `resourceVersion`.
- Status synchronization uses monotonic `serverVersion` values and explicit `SUSPENDED`/`CANCELLED` events. Clients must not recreate future work after either event.
- Request validators reject unknown fields. Response readers ignore unknown additive fields within v1. Removing required fields, changing existing semantics, or introducing an enum value that cannot be handled safely requires a new major API version.
- Errors use the fixed, content-free `ErrorEnvelope`. Provider payloads, clinical values, source-document metadata, and free-form diagnostic details are not allowed.
- AJV tests compile every published definition and exercise valid, invalid, nested-closure, and runtime-parity fixtures. Cross-field comparisons that JSON Schema cannot express (`expiresAt` after `generatedAt`, matching confirming/owner doctor IDs, timestamp ordering, and allowed status-transition pairs) remain explicit application-validator rules and are tested there.

## Usage

```js
import {
  validateDoctorConfirmationCommand,
  parsePrescriptionVersionResponse,
  serializeContract
} from "@medsup/contracts";

const body = serializeContract(command, validateDoctorConfirmationCommand);
const version = parsePrescriptionVersionResponse(responseText);
```

The published schema bundle is exported as `@medsup/contracts/schemas/v1`.
