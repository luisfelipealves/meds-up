# ADR-0002: Health data and ephemeral document processing

- Status: Accepted
- Date: 2026-11-01
- Source: PD-001, PD-007, PD-008

## Context

Prescription source files and extraction output are health data. PD-008 supersedes earlier retention language: source documents, raw OCR/AI output, and unconfirmed proposals must never become durable.

## Decision

Create no persistence, object-storage, backup, durable-queue, shared-cache, browser-storage, logging, analytics, or tracing path for source documents, images, PDFs, scans, raw OCR/AI responses, or unconfirmed proposals.

A future `EphemeralExtractionPort` will be request-scoped. Its adapter must validate authorization, signature/type, and size before streaming to an approved provider; keep bytes and proposal in process/session memory only; enforce deadline and cancellation; and release data on success, failure, expiry, reload, logout, or abandonment. It returns an explicitly untrusted proposal. Only a separate doctor-confirmation command may validate corrected fields and create a confirmed prescription/version transaction.

Operational evidence for extraction may record an allow-listed non-clinical event type, coarse outcome, timestamp, and pseudonymous security correlation where necessary. It must not contain content, filenames, free text, provider payloads, or identifiers that reveal clinical data.

Confirmed records follow PD-007 retention/deletion controls. They are encrypted, access-controlled, versioned rather than overwritten, and backed up only under deletion-aware lifecycle controls. Private patient reminder-response history remains device-local and outside backend telemetry.

## Consequences

- Review sessions cannot resume after reload or expiry; the doctor uploads again.
- There is intentionally no document repository or retrieval contract.
- Provider retries must remain bounded within the active request, never a durable job.
- Future security tests must inspect persistence schemas and telemetry/log output negatively.
