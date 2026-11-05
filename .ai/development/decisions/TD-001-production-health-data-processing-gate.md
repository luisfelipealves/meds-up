---
id: TD-001
type: architecture-decision-gate
title: Production health-data backend, deployment, and OCR processing boundary
status: OPEN
source: [PD-001, PD-007, PD-008, DEV-005]
created_at: 2026-11-05T09:47:39Z
updated_at: 2026-11-05T09:47:39Z
owner: architecture-security-privacy
---

# Decision required

Select and approve the production backend/deployment model and OCR processing
boundary before any real prescription document or other health data enters a
MedsUp-operated path. This gate does not block provider-neutral interfaces,
local deterministic fakes, content-free tests, or other implementation that
cannot process real health data.

# Unresolved choices

The decision must jointly resolve:

- backend runtime, deployment topology, operational ownership, isolation, and
  whether document processing uses a dedicated short-lived worker;
- OCR/AI processor and contract terms, including subprocessors, data locations,
  transfer mechanisms, support access, request/response retention, deletion
  evidence, and an enforceable prohibition on training;
- an EU/Portugal-compatible primary region and any failover, telemetry, support,
  disaster-recovery, or backup regions that may receive personal or health data;
- the network boundary from authenticated ingress to the processor, including
  private egress where available, outbound allow-listing, TLS policy, workload
  identity, denial-of-service controls, and confirmation that no public source
  document URL is created;
- KMS/key ownership, envelope-encryption boundaries for persistent confirmed
  data, key rotation/revocation, workload access, and separation of application
  secrets from source code and build artifacts; and
- provider retention/training guarantees, auditability, incident response,
  deletion/expiry verification, DPA/SCC and transfer assessment where relevant,
  exit assistance, and provider-change portability.

# Viable options

## A — Major cloud managed services in one approved EU region

Run a managed backend plus an isolated ephemeral worker in an approved EU
region, use the cloud KMS and workload identity, and call an OCR provider only
through private or tightly allow-listed egress.

- **Impact:** fastest route to mature IAM, KMS, monitoring, and operational
  controls, subject to a full data-flow and subprocessor review.
- **Lock-in:** medium to high for identity, KMS, networking, and managed runtime;
  reduced by the provider-neutral application and processor ports.
- **Cost:** moderate usage cost and lower initial operations cost; privacy,
  security, and legal review remain material.

## B — EU-headquartered/sovereign managed platform and OCR processor

Use providers contractually and operationally restricted to EU jurisdictions,
with equivalent isolated processing and managed key controls.

- **Impact:** may simplify transfer risk and public-sector/customer assurance,
  but capability, private networking, OCR quality, and operational maturity
  need evidence.
- **Lock-in:** medium; service breadth may make later migration harder despite
  portable application ports.
- **Cost:** potentially higher unit and integration cost, with possibly lower
  transfer-assessment overhead.

## C — Self-managed backend and OCR stack in an EU facility

Operate the runtime, document worker, keys or HSM integration, and OCR stack
without an external OCR API.

- **Impact:** maximum direct control and no external OCR disclosure, but creates
  substantial patching, model, capacity, availability, security, and incident
  response obligations.
- **Lock-in:** lower commercial-provider lock-in but high operational and
  specialist-team lock-in.
- **Cost:** highest engineering and ongoing operations cost for an MVP.

# Recommendation for the decision process

Evaluate A and B first with the same evidence matrix and retain C only if no
managed option can meet PD-008. Prefer one approved EU primary region, an
isolated short-lived document-processing worker with no durable input/output
store, workload identity, tightly controlled egress, provider-neutral ports,
and KMS-backed secrets/key references. Approval must be based on verified
contracts and technical controls, not provider marketing. A concrete vendor or
region is not selected by this request.

# Narrow blocking boundary

Until this gate is resolved and independently reviewed, all of the following
remain blocked:

- connection of the ingestion gateway to a real OCR/AI processor;
- deployment of a document ingress or processor capable of receiving real
  health data;
- production credentials, provider adapters, cloud networking, KMS/key setup,
  or production secrets for this path; and
- pilot or production operation with real prescription documents, OCR output,
  or clinical proposals.

Provider-neutral local code, deterministic fakes, malformed-file tests,
authorization tests, timeout/discard tests, and content-free observability tests
may proceed. Those tests are not evidence that a production provider or
health-data deployment is approved.

# Affected delivery work

- **DEV-005:** local/provider-neutral implementation may be integrated; no real
  health-data operation is authorized.
- **DEV-006:** its provider-neutral proposal adapter may be designed separately,
  but any concrete OCR provider, provider credential, network call, or real
  health-data test is blocked by TD-001.
- **DEV-016:** doctor upload UI may use local/test boundaries only until the
  deployed ingress is approved.
- **DEV-022 and DEV-023:** must incorporate the selected processor, region,
  legal basis/contracts, security controls, deletion evidence, and operational
  lifecycle before release readiness.
- Any deployment/release task that could activate source-document or OCR
  processing is blocked at that activation boundary.

# Required approvers and evidence

Architecture, security/privacy, and the accountable human product/operator
owner must record the selected option and exact region/provider boundaries.
Required evidence includes a data-flow diagram, threat model, DPA/subprocessor
and transfer review, retention/training settings and contract terms, network
and workload-identity design, KMS/secrets design, deletion/expiry verification,
incident/support-access controls, cost estimate, exit plan, and an independent
review. TD-001 remains `OPEN`; this document claims no approval.
