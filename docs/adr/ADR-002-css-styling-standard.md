# ADR-002: CSS styling standard for React frontend

## Status
Accepted

## Context
The frontend currently uses plain CSS files imported into React components, with mostly global class selectors. As the UI grows, this can cause naming collisions, unclear ownership of styles, and inconsistent patterns for where styles should live.

We need a clear, low-overhead standard that matches the existing Vite + React + TypeScript stack and keeps complexity and dependency surface small.

## Decision
Adopt **CSS Modules** as the default styling approach for the React frontend.

Policy:
- Use `*.module.css` files for component and feature styling.
- Keep global CSS limited to app-wide concerns only (reset/base primitives/theme tokens).
- Allow inline `style={{ ... }}` only for very minor, one-off presentational tweaks.
- Inline style usage should typically be no more than 2 declarations.
- If styling is reused, conditional, stateful, responsive, themed, or more than trivial, use CSS Modules instead of inline styles.

Migration guidance:
- Existing global CSS is allowed to remain in place.
- Use touch-and-migrate: convert styles to CSS Modules when files/components are modified.

## Consequences

### Positive
- Improves style encapsulation and reduces selector collisions.
- Keeps dependency footprint minimal (no new framework required).
- Provides a simple default that scales with component growth.
- Preserves pragmatic flexibility for tiny one-off tweaks via inline styles.

### Negative
- Some existing styles will remain mixed (global + modules) during migration.
- Developers must apply judgment for what counts as a minor inline tweak.
- Converting legacy global styles is incremental and may take time.

## Alternatives Considered
- Continue with globally scoped CSS only and rely on naming discipline.
- Adopt a utility-first framework (for example, Tailwind CSS).
- Adopt CSS-in-JS as the primary approach.

## Cost / Operational Impact
- Cost posture impact: no expected infrastructure or hosting cost impact.
- Operational complexity impact: low; no additional build/deployment systems required.

## Rollback / Exit Strategy
If CSS Modules prove insufficient for developer productivity or consistency, supersede this ADR with a new decision and migration plan to another approach (for example, utility-first CSS). Existing module files can coexist during transition while standards are updated.
