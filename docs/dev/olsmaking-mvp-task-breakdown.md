# Olsmaking MVP Task Breakdown

## Purpose
Provide a concrete, implementation-ready task list for the Olsmaking MVP based on approved requirements, style guide, and architecture decisions.

## Scope

### In Scope
- Auth0 + BFF authentication setup.
- User bootstrap/profile persistence (`email`, `nickname`).
- Event creation/join and participant management.
- Event-scoped beers and one-review-per-user-per-beer flow.
- Mobile-first frontend implementation using CSS Modules.
- LocalDB + Azure SQL schema and migration path.

### Out of Scope
- Email invitations.
- Realtime websocket updates.
- Broad social features beyond event collaboration.

## Task Plan

### Phase 1: Foundation
1. Add auth configuration model and options binding in backend.
2. Integrate Auth0 OIDC sign-in/logout in BFF with secure cookie auth.
3. Add authorization policy for `admin` based on `admin-scope` claim/permission.
4. Add user bootstrap endpoint/service: create or update `AppUser` by Auth0 `sub`.

### Phase 2: Data Model and Persistence
5. Add EF Core DbContext and SQL Server provider wiring.
6. Implement entities: `AppUser`, `Event`, `EventParticipant`, `EventBeer`, `BeerReview`.
7. Configure constraints/indexes:
   - unique `auth0Subject`
   - unique `(eventId, userId)`
   - unique `(eventId, beerId, userId)`
8. Add `rowversion` concurrency token for mutable entities (minimum `BeerReview`).
9. Create and apply initial migration for LocalDB.

### Phase 3: Event and Membership APIs
10. Implement `POST /api/events` with owner auto-membership.
11. Implement join code generation and storage.
12. Implement `POST /api/events/{eventId}/join` (idempotent behavior).
13. Implement `POST /api/events/{eventId}/regenerate-code` for owner/admin.
14. Implement `DELETE /api/events/{eventId}/participants/{userId}` (owner/admin remove).
15. Enforce remove behavior: historical reviews remain visible; future access revoked.

### Phase 4: Beer and Review APIs
16. Implement `POST /api/events/{eventId}/beers` and `GET /api/events/{eventId}/beers`.
17. Implement review create endpoint with one-review uniqueness check.
18. Implement review update endpoint (`PATCH`) for current user's review.
19. Apply normalization rule: nullable text empty/whitespace -> `null`.
20. Validate rating as integer `1-6` across create/update.

### Phase 5: Frontend MVP Screens (Mobile-First)
21. Build authenticated app shell and route guards.
22. Build event list screen (my events + open events when enabled).
23. Build create event screen.
24. Build join event screen (code/link entry).
25. Build event detail screen (participants, beers, review actions).
26. Build beer detail/review form with slider `1-6` and clear numeric value.
27. Build favorites flow in beer list/detail context.
28. Ensure all new styles use CSS Modules and approved tokens.

### Phase 6: Validation and Hardening
29. Add backend unit/integration tests for authz rules and membership constraints.
30. Add frontend component tests for slider behavior and key forms.
31. Run validation matrix and fix failures.
32. Document local setup for Auth0 + LocalDB in dev docs.

### Phase 7: Routing Follow-Up (Post-MVP)
33. [Done] Implement Phase 1 URL-driven tab routing for `/oversikt`, `/arrangementer`, `/favoritter`, and `/profil`.
34. [Done] Add route-to-tab initialization so direct open on `/oversikt` and other primary routes lands on correct view.
35. [Done] Replace direct `setActiveTab` transitions with a shared navigation helper that updates both UI state and browser history.
36. [Done] Add browser back/forward support (`popstate`) to keep rendered tab in sync with URL history.
37. [Done] Add frontend tests for deep-link boot and history navigation across primary tab routes.
38. [In progress] Implement Phase 2 event workspace deep-link handling using `/arrangementer/<eventId>`.
39. [In progress] Add deep-link error handling for forbidden and not-found event using existing error feedback patterns.
40. [In progress] Add integration checks for deep-link refresh and login return-url behavior to ensure post-auth return lands on the requested deep link.
41. [In progress] Validate path-based deep-link routing with frontend and host build matrix and update docs/dev + ADR-007 references to mark routing phases complete.

## Definition of Done (MVP)
- User can sign in/up via Auth0 and has persisted app profile.
- User can create event and share join code/link.
- Another user can join event.
- Owner/member can add beers to event.
- User can create one review per beer and update via `PATCH`.
- Removed member loses access but prior reviews remain visible.
- UI is mobile-first, `nb-NO`, and CSS Modules compliant.
- Validation matrix passes or has explicit documented exceptions.

## Validation Plan
- Frontend: `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, `npm run build`
- Backend: `dotnet build`, `dotnet test`
- Integration: frontend build integrated into host, then `dotnet publish`
