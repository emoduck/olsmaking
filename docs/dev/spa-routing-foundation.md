# SPA Routing Foundation

## Implementation Status
- Complete (Phase 1)
- Follow-up execution: `docs/dev/spa-routing-phase-2-event-workspace-deep-links.md`

## Purpose
Enable proper, linkable SPA navigation so primary views can be opened directly from external links and restored through browser history.

## Scope

### In Scope
- Plan route-based navigation for primary tabs: `/oversikt`, `/arrangementer`, `/favoritter`, `/profil`.
- Define URL-as-source-of-truth behavior for active primary tab.
- Define browser history expectations (back/forward/refresh) for tab navigation.
- Keep `/` as default entry that resolves to dashboard-first landing behavior.

### Out of Scope
- Event-workspace deep links (for example auto-opening a specific event from URL) in this phase.
- New API endpoints or backend data model changes.

## UI / Behavior Notes
- Entry points: primary nav controls and direct path navigation.
- Users can open `/oversikt` directly and land in overview without extra clicks.
- Clicking primary nav updates both visible tab and browser URL.
- Browser back/forward restores prior primary tab state.
- Unknown SPA path should resolve to default primary route (`/oversikt`) in the client.
- Existing join form query params (`eventId`, `joinCode`) continue to work on arrangementer flow.

## Backend / API Impact
- No API contract changes.
- Existing .NET SPA fallback (`MapFallbackToFile("index.html")`) remains the host behavior for client routes.
- No auth endpoint changes expected.

## Dependencies / Assumptions
- Current app remains single deployable unit (.NET BFF + React SPA).
- Hosting remains Azure App Service with F1-first posture.
- Primary tab labels and feature boundaries stay unchanged in this phase.
- Route names use Norwegian path slugs aligned with current UI naming.

## Open Questions
- Canonicalization to `/oversikt` is implemented for unknown root states.
- Unknown client paths currently resolve to dashboard-first route.

## Validation Plan
- Frontend: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`
- Backend: `dotnet build src/Olsmaking.Bff/Olsmaking.Bff.csproj`
- Integration: verify direct navigation and refresh for `/oversikt`, `/arrangementer`, `/favoritter`, `/profil` in integrated host

## ADR Needed?
- Yes
- `docs/adr/ADR-007-spa-tab-routing-and-deep-link-support.md`
