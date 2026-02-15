# Event-Based Tasting MVP

## Purpose
Specify the end-to-end MVP behavior for collaborative beer tasting events in Olsmaking, including event lifecycle, participant access, beer management, and review workflows.

## Scope

### In Scope
- Event lifecycle: create, join, active use, close/archive.
- Participant model: owner and members.
- Join model via event code/link.
- Event-scoped beer entries.
- Event-scoped review workflows with one review per user+beer.
- Owner event administration actions:
  - regenerate join code/link
  - remove participant
  - adjust event status (`Open`/`Closed`)
  - delete event (owner/admin only)
- Optional open-event mode and listing support.

### Out of Scope
- Email invitation workflows.
- Real-time websocket collaboration (polling/refresh behavior is acceptable in MVP).
- Rich moderation workflows beyond owner/admin actions.
- Global reusable beer catalog shared across multiple events.

## UI / Behavior Notes

### Core Flow
1. Authenticated user creates an event and becomes owner.
2. Owner shares join code/link.
3. Other authenticated users join and become members.
4. Owner/member adds beers to event.
5. Each participant submits one review per beer (rating `1-6`, optional notes).
6. Participant can update own review via `PATCH`.
7. Owner can close event to stop new joins and optionally stop review edits.

### Event States
- `Draft` (optional pre-open state)
- `Open` (join + tasting active)
- `Closed` (joins blocked; review behavior controlled by policy)
- `Archived` (read-only historical view)

### Visibility and Join Behavior
- Default visibility is private.
- Open visibility can be enabled to allow listing and join discovery.
- Join code/link remains valid until manually regenerated.
- Duplicate join attempts are idempotent and should not create duplicate membership rows.

### Beer Rules
- Beers are created within an event context.
- One beer can only belong to one event.
- Beer removal is limited to event owner or admin.
- Beer removal is blocked when at least one review exists for that beer.
- Beer without reviews can be hard-deleted and should cascade dependent favorites.

### Review Rules
- One review per user+beer+event.
- Initial create uses `POST`.
- Update uses `PATCH` on existing review.
- Rating is integer `1-6`.
- Nullable text fields normalize empty/whitespace-only values to `null`.
- Removed participant's existing reviews remain visible in event history but access is revoked.

### Mobile-First Interaction Notes
- Primary actions are thumb-reachable.
- Event detail page prioritizes: event status, beer list, quick review action.
- Rating control is a large touch slider with immediate numeric feedback (`1-6`).

## Backend / API Impact
- Required resource areas:
  - users/profile
  - events
  - event participants
  - event beers
  - beer reviews
- Suggested endpoint set (MVP):
  - `POST /api/events`
  - `DELETE /api/events/{eventId}`
  - `GET /api/events/{eventId}`
  - `POST /api/events/{eventId}/join`
  - `POST /api/events/{eventId}/regenerate-code`
  - `POST /api/events/{eventId}/beers`
  - `GET /api/events/{eventId}/beers`
  - `DELETE /api/events/{eventId}/beers/{beerId}`
  - `POST /api/events/{eventId}/beers/{beerId}/reviews`
  - `PATCH /api/events/{eventId}/beers/{beerId}/reviews/me`
  - `DELETE /api/events/{eventId}/participants/{userId}`

## Dependencies / Assumptions
- Auth0 identity is available and trusted via BFF authentication.
- SQL persistence with constraints and indexes supports event/member/review queries.
- CSS Modules and current style guide are used for all new feature UI.
- `nb-NO` strings are available for all user-facing labels and messages.

## Policy Defaults (Locked)
- `Closed` events block member review updates by default.
- Removed users cannot rejoin by code; owner/admin must re-add them.
- Open events are listed only when explicit `isListed=true` is set.

## Validation Plan
- Frontend: `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, `npm run build`
- Backend: `dotnet build`, `dotnet test`
- Integration: frontend build integrated into host, then `dotnet publish`

## ADR Needed?
- Yes
- Auth and persistence ADRs are required for this feature set:
  - `docs/adr/ADR-003-auth0-bff-authentication.md`
  - `docs/adr/ADR-004-persistence-azure-sql-efcore.md`
