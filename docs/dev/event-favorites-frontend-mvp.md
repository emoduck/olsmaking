# Event Favorites Frontend MVP

## Purpose
Add event workspace support for marking beers as favorites so users can quickly save and revisit preferred beers during a tasting.

## Scope

### In Scope
- Call favorites endpoints from the frontend API client.
- Load current-user favorites when an event workspace is selected.
- Show favorite state in beer rows and allow toggling favorite on/off per beer.
- Keep the interaction mobile-first, minimal, and accessible with clear button labels.

### Out of Scope
- Dedicated favorites page/tab showing cross-event favorites.
- Routing or navigation refactors.

## UI / Behavior Notes
- Beer rows show a `Favoritt` status label when a beer is currently favorited.
- Each beer row exposes a favorite toggle button with accessible `aria-label` text.
- Favorite toggles show pending state (`Lagrer...`) and success/error feedback via existing app messages.
- Favorites are refreshed from backend each time a new event workspace is loaded.

## Backend / API Impact
- Uses existing backend endpoints:
  - `GET /api/events/{eventId}/favorites/me`
  - `POST /api/events/{eventId}/beers/{beerId}/favorite`
  - `DELETE /api/events/{eventId}/beers/{beerId}/favorite`
- No backend contract changes.

## Dependencies / Assumptions
- User is authenticated and has access to selected event.
- Favorite endpoints remain idempotent and return `204 No Content` for add/remove actions.
- Beer IDs returned by favorites endpoint match IDs in event beer list.

## Open Questions
- Should favorite state eventually be included directly in `GET /api/events/{eventId}/beers` payload to reduce one request per workspace load?
