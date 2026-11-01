# MedsUp AI Workflow

This directory is the persistent source of truth for product and delivery
handoffs. Chat messages are notifications only; agents must read the referenced
artefact before acting.

## Product decisions

Product Decisions live in `.ai/product/decisions/PD-<id>-<slug>.md` and use
the states `READY_FOR_HUMAN_REVIEW`, `APPROVED_FOR_DEVELOPMENT`, `REJECTED`,
or `SUPERSEDED`.

Only an explicit instruction naming a Product Decision may move it from
`READY_FOR_HUMAN_REVIEW` to `APPROVED_FOR_DEVELOPMENT`.

## Protocol

Use `hermes-team-protocol` for coordination. Persist full evidence here, then
send a compact event containing the artefact reference, delta, and next owner.

## Future locations

- `.ai/product/questions/` — unresolved product questions.
- `.ai/development/tasks/` — DEV tasks created from approved decisions.
- `.ai/development/handoffs/` — developer handoffs.
- `.ai/development/integration/` — integration handoffs.
- `.ai/reviews/` — independent review records.
