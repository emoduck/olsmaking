# ADR-007: SPA tab routing and deep-link support

## Status
Accepted

## Context
The current frontend uses local component state for primary tab selection. This means tab state is not represented in the URL, so external links cannot reliably open a specific tab such as `Oversikt`.

This behavior also weakens expected browser behavior for back/forward navigation and refresh on deep-linked views.

The app is hosted as a single deployable unit (.NET BFF + React SPA). The backend already serves SPA routes through `MapFallbackToFile("index.html")`, so host support for deep links exists and does not require infrastructure changes.

## Decision
Adopt URL-driven client-side routing for primary tab navigation.

Decision details:
- Represent primary tabs with explicit client routes: `/oversikt`, `/arrangementer`, `/favoritter`, `/profil`.
- Treat URL pathname as the source of truth for active primary tab.
- For event workspace deep links, use path-based route shape: `/arrangementer/<eventId>`.
- Treat `eventId` as a route parameter for deep-link hydration; invalid, forbidden, and not-found handling remains unchanged.
- Preserve existing backend route boundaries (`/api`, auth callback paths) and do not route those through client navigation.
- Keep existing BFF SPA fallback behavior so direct open/refresh on client routes resolves correctly.
- Keep current F1-first hosting posture with no additional Azure resources or tier upgrades.

## Consequences

### Positive
- Enables shareable deep links for top-level app views.
- Restores expected browser navigation behavior (back/forward/refresh).
- Reduces ambiguity between visible app state and URL state.
- Improves testability for navigation flows.

### Negative
- Requires migration from direct local tab-state transitions to route-aware navigation helpers.
- Increases route design responsibility (default route, unknown path handling, naming consistency).
- Path parameter parsing adds stricter route-handling requirements in the SPA.

## Alternatives Considered
- Keep local tab state only: simplest now but does not support deep links.
- Query-string event deep links (`/oversikt?eventId=<id>`): workable, but weaker canonical semantics for resource-like deep links.
- Hash routing (`#/oversikt`): avoids server-route concerns but produces lower-quality URLs and is unnecessary with current fallback support.

## Cost / Operational Impact
- Cost posture impact: low; no additional resources and no App Service plan upgrade required.
- Operational complexity impact: medium; requires frontend route conventions and navigation test coverage.

## Rollback / Exit Strategy
If routing introduces unacceptable regressions:
1. Keep route definitions but map unknown or unstable routes back to arrangement-first view.
2. Temporarily restore local tab-state compatibility while route behavior is corrected.
3. Retain backend fallback configuration to avoid deployment topology changes.
4. Update docs and tests before re-enabling strict route-driven behavior.
