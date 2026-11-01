# ADR-0001: Platform and repository structure

- Status: Accepted
- Date: 2026-11-01
- Source: DEV-001, PD-001

## Context

The greenfield product needs independently deployable backend/PWA code and separately shipped Android/Wear clients, with shared compatibility conventions and low setup cost.

## Decision

Use one repository with explicit `apps/backend`, `apps/pwa`, `apps/android`, and `apps/wear` roots. Use Node.js ES modules and built-in test tooling for the initial backend and PWA shells; use Android Gradle Plugin projects written in Java for Android and Wear foundations. Pin dependency graphs with `package-lock.json`, the Gradle wrapper, and explicit plugin versions.

This is a foundation choice, not a permanent framework or cloud selection. Later tasks may introduce a backend/PWA framework behind existing contracts when justified. Mobile framework types stay surface-local. `make` provides discoverable per-surface entry points, while native package tools remain directly usable.

## Consequences

- Node and mobile toolchains remain independently buildable.
- Contracts and architecture rules can be validated before feature code exists.
- Android SDK installation is required for mobile builds; no SDK is vendored.
- Adding shared production code requires an explicit module and dependency-direction review.
