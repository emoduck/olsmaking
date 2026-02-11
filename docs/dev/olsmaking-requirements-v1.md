# Olsmaking Requirements v1

## Purpose
Define the MVP product and technical requirements for Olsmaking: a mobile-first beer tasting web app where authenticated users create or join events, add beers, and submit/update beer reviews.

## Scope

### In Scope
- Authentication with Auth0 (free tier), using BFF-managed sign-in/session.
- Role model with `admin` and `user`.
- Event-based collaboration:
  - Any authenticated user can create events.
  - Users join events through event code or link.
  - Event owners can administer their own events.
  - Event owners can remove users from events.
- Beer model:
  - An event contains multiple beers.
  - A beer belongs to exactly one event.
- Review model:
  - A user can create exactly one review per beer per event.
  - The same review can be updated via `PATCH`.
  - Text fields normalize empty/whitespace-only input to `null` where allowed.
- User profile:
  - Persist one app user record per Auth0 identity (`sub`).
  - Persist `email` and `nickname`.
- Language and UX:
  - User-facing UI text in Norwegian Bokmal (`nb-NO`).
  - Mobile-first layout and interaction.
  - CSS Modules for new UI implementation.
- Persistence:
  - Azure SQL Database (lowest practical cost tier) for hosted environments.
  - SQL Server LocalDB for local development.

### Out of Scope
- Email-based invitations.
- Complex social features (followers, feed, comments, reactions).
- Multi-tenant org/account management.
- Advanced public marketplace/catalog features beyond optional open-event listing.
- Payment, subscription, and billing features.

## UI / Behavior Notes

### User Roles and Access
- `admin`: global administrative access.
- `user`: standard access; can create events and manage own event if owner.
- Event owner can remove event participants (revokes further access).
- Removed users keep prior reviews visible in event history but cannot continue editing/adding content in that event.

### Event Visibility and Join Rules
- Events are private by default.
- Platform supports open events and optional listing of open events.
- Join code/link has no automatic expiration.
- Join code/link is invalidated only when event owner refreshes/regenerates it.

### Review Rules
- Rating scale is integer `1-6`.
- `PATCH` is used for partial updates of existing reviews.
- Field behavior for review updates:
  - Omitted field = unchanged.
  - Nullable field set to empty/whitespace = normalized to `null`.
  - Non-nullable field cannot be null.

### Core Acceptance Criteria
- User can sign up/log in with Auth0 and access authenticated app areas.
- User can create an event and receive a join code/link.
- Another authenticated user can join event using code/link.
- Owner/member can add beers within that event.
- User can submit one review per beer and later update it.
- Duplicate review create attempt for same user+beer+event is rejected.
- Owner can remove member; removed member loses access but historical reviews remain visible.

## Backend / API Impact
- Add authenticated APIs for users, events, participants, beers, and reviews.
- Enforce event-scoped authorization on all event resources.
- Persist users from Auth0 principal claims (`sub`, `email`, `nickname`).
- Enforce data constraints:
  - Unique user identity by Auth0 `sub`.
  - Unique event membership per user.
  - Unique review per user+beer+event.

## Dependencies / Assumptions
- React + TypeScript frontend in `ClientApp`.
- .NET BFF host as the single deployable unit.
- Auth0 tenant and application configured with required callback/logout URLs.
- Azure App Service hosting posture remains F1-first unless constraints require documented tradeoff.
- Azure SQL connectivity is available in hosted environments.

## Open Questions
- Which fields can `admin` modify globally in MVP (for example force-close event, remove beer, hide review)?
- Should open-event listing be in MVP launch or behind a feature flag?
- Should removed users be allowed to rejoin if code is still valid, or require owner action?

## Validation Plan
- Frontend: `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, `npm run build`
- Backend: `dotnet build`, `dotnet test`
- Integration: frontend build integrated into host, then `dotnet publish`

## ADR Needed?
- Yes
- Auth decision: `docs/adr/ADR-003-auth0-bff-authentication.md`
- Persistence decision: `docs/adr/ADR-004-persistence-azure-sql-efcore.md`
