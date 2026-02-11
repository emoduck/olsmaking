# Olsmaking MVP Tickets

## Purpose
Provide sprint-ready implementation tickets derived from approved concept, requirements, feature scope, and ADR decisions.

## Scope

### In Scope
- Ticketized MVP implementation from foundation through validation.
- Acceptance criteria and dependencies per ticket.
- Suggested sizing and execution order.

### Out of Scope
- Post-MVP enhancements.
- Infrastructure operations runbooks beyond implementation tickets.

## UI / Behavior Notes
- Mobile-first across all frontend tickets.
- UI language is Norwegian Bokmal (`nb-NO`).
- New UI styles must use CSS Modules and shared CSS tokens.

## Ticket Backlog

### Epic A: Authentication and User Bootstrap

#### A1 - Configure Auth0 OIDC in BFF
- Goal: enable login/logout via Auth0 with secure cookie session.
- Acceptance criteria:
  - Authenticated session established via OIDC callback.
  - Logout clears local session and redirects correctly.
  - No access tokens stored in browser local/session storage.
- Dependencies: none.
- Size: M.

#### A2 - Implement app user bootstrap/upsert
- Goal: persist one app user record per Auth0 `sub` with `email` and `nickname`.
- Acceptance criteria:
  - First login creates `AppUser`.
  - Subsequent logins update mutable profile fields.
  - Duplicate `auth0Subject` cannot be created.
- Dependencies: A1.
- Size: M.

#### A3 - Implement `admin` authorization policy
- Goal: enforce global `admin` policy from Auth0 `admin-scope`.
- Acceptance criteria:
  - `admin`-only endpoints reject non-admin users.
  - Claim mapping is documented and test-covered.
- Dependencies: A1.
- Size: S.

### Epic B: Persistence and Data Integrity

#### B1 - Add EF Core SQL Server persistence wiring
- Goal: configure DbContext for LocalDB and Azure SQL.
- Acceptance criteria:
  - App runs locally against LocalDB connection.
  - Hosted configuration supports Azure SQL connection string.
- Dependencies: none.
- Size: M.

#### B2 - Implement domain entities and mappings
- Goal: add `AppUser`, `Event`, `EventParticipant`, `EventBeer`, `BeerReview`.
- Acceptance criteria:
  - Entity relationships compile and migrate.
  - Required fields and nullability align with docs.
- Dependencies: B1.
- Size: L.

#### B3 - Enforce unique constraints and indexes
- Goal: enforce core business constraints in database.
- Acceptance criteria:
  - Unique `AppUser.auth0Subject`.
  - Unique `EventParticipant(eventId, userId)`.
  - Unique `BeerReview(eventId, beerId, userId)`.
- Dependencies: B2.
- Size: M.

#### B4 - Add concurrency + text normalization policy
- Goal: protect review updates and normalize nullable text.
- Acceptance criteria:
  - `rowversion` concurrency on `BeerReview`.
  - Whitespace-only nullable text fields normalize to `null`.
- Dependencies: B2.
- Size: M.

### Epic C: Event and Membership APIs

#### C1 - Create event endpoint
- Goal: allow authenticated user to create event and become owner.
- Acceptance criteria:
  - `POST /api/events` returns event ID and join code/link.
  - Owner membership row created automatically.
- Dependencies: A2, B2.
- Size: M.

#### C2 - Join event by code/link
- Goal: allow authenticated user to join using valid code/link.
- Acceptance criteria:
  - `POST /api/events/{eventId}/join` succeeds for valid join context.
  - Duplicate join is idempotent.
  - Closed events reject join.
- Dependencies: C1, B3.
- Size: M.

#### C3 - Regenerate join code endpoint
- Goal: owner/admin can rotate join code.
- Acceptance criteria:
  - New code invalidates prior code.
  - Only owner/admin can regenerate.
- Dependencies: C1.
- Size: S.

#### C4 - Remove participant endpoint
- Goal: owner/admin can remove a member from event.
- Acceptance criteria:
  - Membership revoked and future access blocked.
  - Existing reviews remain visible in event history.
- Dependencies: C1, C2.
- Size: M.

### Epic D: Beer and Review APIs

#### D1 - Add beers to event
- Goal: owner/member can add beer entries scoped to event.
- Acceptance criteria:
  - Beer created with mandatory `eventId` association.
  - Beer cannot belong to multiple events.
- Dependencies: C1.
- Size: M.

#### D2 - Create review endpoint
- Goal: user submits one review per beer per event.
- Acceptance criteria:
  - Rating accepts integer `1-6` only.
  - Duplicate review create returns conflict behavior.
- Dependencies: D1, B3.
- Size: M.

#### D3 - Patch review endpoint
- Goal: user updates own existing review via partial update.
- Acceptance criteria:
  - `PATCH /api/events/{eventId}/beers/{beerId}/reviews/me` updates only provided fields.
  - Nullable text empty/whitespace input stored as `null`.
  - Concurrency conflict returns appropriate response.
- Dependencies: D2, B4.
- Size: M.

### Epic E: Frontend Mobile MVP

#### E1 - Authenticated app shell and route guards
- Goal: show protected app shell for signed-in users.
- Acceptance criteria:
  - Unauthenticated users are redirected to login flow.
  - Basic profile context available (`email`, `nickname`).
- Dependencies: A1, A2.
- Size: M.

#### E2 - Event list and create screens
- Goal: provide mobile-first list/create flow.
- Acceptance criteria:
  - User sees own events.
  - User can create event from mobile form.
  - CSS Modules used for all new styles.
- Dependencies: C1, E1.
- Size: L.

#### E3 - Join event screen (code/link)
- Goal: allow user to join event from direct link or code entry.
- Acceptance criteria:
  - Successful join updates event membership state in UI.
  - Invalid/expired code messaging in `nb-NO`.
- Dependencies: C2, E1.
- Size: M.

#### E4 - Event detail with participant and beer sections
- Goal: central event workspace on mobile.
- Acceptance criteria:
  - Shows event status, participants, and beers.
  - Owner controls visible only to owner/admin.
- Dependencies: C1, C4, D1.
- Size: L.

#### E5 - Review form with `1-6` slider
- Goal: fast, clear review capture and update.
- Acceptance criteria:
  - Slider min/max/step is `1/6/1`.
  - Selected value is clearly displayed (`x / 6`) and updates immediately.
  - Patch update flow for existing review works.
- Dependencies: D2, D3, E4.
- Size: M.

#### E6 - Favorites behavior
- Goal: allow users to save favorite beers.
- Acceptance criteria:
  - Favorite state can be toggled in beer list/detail.
  - Favorite state persists per user.
- Dependencies: E4.
- Size: M.

### Epic F: Quality and Validation

#### F1 - Backend authz and lifecycle tests
- Goal: cover owner/member/admin checks and event state behavior.
- Acceptance criteria:
  - Tests validate join, remove, and blocked access cases.
- Dependencies: C1-C4, D1-D3.
- Size: M.

#### F2 - Frontend component tests for slider/forms
- Goal: ensure robust mobile interaction and validation.
- Acceptance criteria:
  - Slider interaction and display tested.
  - Review create/update form validation tested.
- Dependencies: E5.
- Size: M.

#### F3 - Validation matrix pass
- Goal: pass repo validation gates for MVP branch.
- Acceptance criteria:
  - `npm run typecheck` passes.
  - `npm run lint` passes.
  - `npm run test -- --runInBand` passes.
  - `npm run build` passes.
  - `dotnet build` passes.
  - `dotnet test` passes.
  - `dotnet publish` passes after frontend build integration.
- Dependencies: A-F implementation complete.
- Size: S.

## Suggested Sprint Packaging
- Sprint 1: A1-A3, B1-B3, C1.
- Sprint 2: C2-C4, D1-D3, E1-E3.
- Sprint 3: E4-E6, F1-F3.

## Risks / Unknowns
- Open/listed event behavior may increase moderation and discovery scope.
- LocalDB is Windows-focused; cross-platform development may need alternate local database option.
- Auth0 claim mapping details may vary by tenant configuration and require environment-specific validation.

## Validation Plan
- Frontend: `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, `npm run build`
- Backend: `dotnet build`, `dotnet test`
- Integration: frontend build integrated into host, then `dotnet publish`

## ADR Needed?
- No
- This document operationalizes accepted ADRs and feature docs.
