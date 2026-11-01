# Environments

MedsUp uses four isolated environment classes. Data, credentials, encryption keys, identity tenants, callback URLs, and network boundaries must never be shared across classes.

| Class | Purpose | Data policy |
| --- | --- | --- |
| `local` | Developer machine | Synthetic data only; loopback defaults |
| `test` | Automated validation | Deterministic synthetic fixtures only |
| `staging` | Pre-production verification | Synthetic or formally approved anonymized data only |
| `production` | Portugal pilot | EU-resident services and approved operational controls |

`MEDSUP_ENV` must be explicit outside local use. Production startup must fail closed when required server secrets or deployment controls are absent; later implementation tasks own that runtime guard.

Mobile variants use `debug` for local/test integrations and `release` for signed production artifacts. A release build must not embed server credentials, provider secrets, production health records, or environment files. Endpoint selection must be build-time allow-listed and authenticated at runtime.

There is no deployment configuration in DEV-001. Production topology, provider selection, data-processing agreements, disaster recovery, and regulatory release approval remain later gated decisions.
