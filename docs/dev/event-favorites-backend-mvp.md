# Event Favorites Backend MVP

## Purpose
Add backend support for event-scoped beer favorites so users can save and retrieve favorites during tasting sessions.

## Scope

### In Scope
- Persist user beer favorites with uniqueness guarantees.
- Add API endpoints for reading, adding, and removing current-user favorites in an event.
- Enforce existing event access checks for all favorites endpoints.
- Validate beer ownership by ensuring the beer belongs to the requested event.

### Out of Scope
- Frontend changes for favorites UI.
- Refactors unrelated to favorites persistence/API.

## UI / Behavior Notes
- Frontend can call `GET /api/events/{eventId}/favorites/me` to hydrate event favorites for the current user.
- Favorite add/remove endpoints are idempotent and return `204 No Content` when repeated.
- Requests to favorite beers not belonging to the event return `404 Not Found`.
- Non-members, non-owners, and non-admins receive `403 Forbidden` through existing event access rules.

## Backend / API Impact
- New table/entity: `BeerFavorite` with `Id`, `EventId`, `BeerId`, `UserId`, and `CreatedUtc`.
- Unique index on `{UserId, BeerId}` prevents duplicate favorites per user+beer.
- Endpoints added:
  - `GET /api/events/{eventId}/favorites/me`
  - `POST /api/events/{eventId}/beers/{beerId}/favorite`
  - `DELETE /api/events/{eventId}/beers/{beerId}/favorite`

## Dependencies / Assumptions
- Existing one-user-per-sub identity mapping remains unchanged.
- Existing `GetEventAccessAsync` authorization guard is reused.
- Event beers use globally unique IDs, while event+beer relationship is validated in endpoint logic.

## Open Questions
- Should favorites eventually be exposed in beer list/detail payloads to reduce round trips?

## Validation Plan
- Backend: `dotnet build`, `dotnet test`
- Migration/update: `dotnet ef migrations add <name>`, `dotnet ef database update`

## ADR Needed?
- No
