# Secrets convention

1. Commit names and safe local defaults only in `.env.example`; never put a usable credential in an example.
2. Keep local server overrides in ignored `.env` files. Keep Android SDK paths in ignored `local.properties`.
3. Inject staging/production secrets at runtime from a replaceable secret-management adapter. Do not bake secrets into images, JavaScript bundles, APKs, source, Gradle properties, CI logs, or command arguments.
4. Separate secrets by environment and least-privilege workload identity. Rotation must not require domain-code changes.
5. Logs and errors may contain secret field names, but never values. Claim secrets, session tokens, identity credentials, key material, prescription content, and OCR input/output are always redacted.
6. Use opaque key references at the domain boundary; cryptographic material remains under the key-management adapter.

Before committing, inspect `git diff --cached` and run `make static-check`. Automated scanning is additive and does not replace review.
