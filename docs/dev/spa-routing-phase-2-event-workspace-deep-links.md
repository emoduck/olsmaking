# SPA Routing Phase 2: Event Workspace Deep Links

## Implementation Status
- In progress
- Current implementation target: query-based deep links on overview (`/oversikt?eventId=<id>`)

## Purpose
Plan deep-link support that opens a specific event workspace directly from external links while preserving Phase 1 primary-tab routing behavior.

## Scope

### In Scope
- Define deep-link entry for opening an event workspace from URL.
- Define expected behavior when event access is missing, forbidden, or event is not found.
- Define navigation behavior when entering from direct links and when returning to primary tab routes.
- Define test and validation expectations for deep-link boot and refresh.

### Out of Scope
- New sharing/invite UX redesign.
- Backend endpoint additions or contract changes.
- Route model changes outside event workspace entry and hydration.

## UI / Behavior Notes
- Entry points include external links and manual URL entry.
- Primary route remains URL-driven from Phase 1 (`/oversikt`, `/arrangement`, `/favoritter`, `/profil`).
- Phase 2 deep-link target should open overview context with event workspace loaded for the specified `eventId`.
- Chosen shape in this phase: `/oversikt?eventId=<id>`.
- On valid access, workspace loads with existing event details/beer/review hydration behavior.
- On not found or forbidden, user sees dedicated deep-link error messaging and remains in overview context.
- On unauthenticated state, login flow should preserve return URL and return user to the deep link.

## Backend / API Impact
- No new endpoints required.
- Existing endpoints are reused (`/api/events/{eventId}`, related workspace hydration endpoints).
- Existing BFF SPA fallback and auth return-url behavior remain unchanged.

## Dependencies / Assumptions
- Phase 1 route foundation is implemented first.
- Existing event authorization rules remain source of truth (`docs/adr/ADR-005-event-authorization-and-lifecycle.md`).
- Existing SPA routing decision remains valid (`docs/adr/ADR-007-spa-tab-routing-and-deep-link-support.md`).
- Event identifier validation is currently backend-driven; client does not enforce strict GUID format in this phase.

## Acceptance Criteria
- Direct-open of `/oversikt?eventId=<id>` hydrates the event workspace when access is valid.
- Selecting or opening an event workspace from UI updates URL to `/oversikt?eventId=<id>`.
- Forbidden deep links show explicit access error text.
- Unauthenticated deep links preserve `returnUrl` through login redirect.
- Existing primary tab routing behavior from Phase 1 continues to work unchanged.

## Open Questions
- Should long-term route shape move from query-based (`/oversikt?eventId=...`) to path-based (`/oversikt/<eventId>`) after Phase 2 stabilization?
- Should successful workspace deep-link hydration update browser title with event name in a later phase?

## Validation Plan
- Frontend: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`
- Backend: `dotnet build src/Olsmaking.Bff/Olsmaking.Bff.csproj`
- Integration:
  - Direct-open `/oversikt?eventId=<guid>` in integrated host and verify workspace hydration
  - Refresh on deep-link URL and verify consistent state
  - Verify forbidden/not-found event links show expected error handling

## ADR Needed?
- No (covered by `docs/adr/ADR-007-spa-tab-routing-and-deep-link-support.md`)
- Create a new ADR only if route shape changes from agreed URL-driven model or requires backend routing/auth contract changes.
