# Event Delete Implementation Plan

## Goal
Implement safe event deletion with owner/admin authorization, dependent data cleanup, and frontend confirmation before execution.

## Why Now
- Product requirement explicitly requests event deletion.
- Current MVP lacks cleanup path for obsolete events.
- Planning and ADR artifacts are required before implementation.

## Scope

### In Scope
- Planning and ADR artifacts for event deletion.
- Backend delete endpoint implementation plan.
- Frontend confirmation UX implementation plan.
- Test and validation strategy.

### Out of Scope
- Performing implementation changes in this planning phase.
- Soft-delete and restore workflows.
- Additional infrastructure or deployment topology changes.

## Plan of Attack
1. **Documentation Gate**
   - Create/update:
     - `docs/dev/event-delete-mvp.md`
     - `docs/adr/ADR-006-event-deletion-cascade-and-confirmation.md`
     - `docs/dev/event-based-tasting-mvp.md` (reflect delete action and endpoint)
2. **Backend Implementation**
   - Add `DELETE /api/events/{eventId}` in `Program.cs`.
   - Enforce authorization (`owner` or `admin`).
   - Return `404` for missing event, `403` for forbidden, `204` for success.
   - Delete event root and validate dependent cleanup behavior.
3. **Frontend Implementation**
   - Add `deleteEvent(eventId)` API client method.
   - Add workspace delete action for `owner`/`admin`.
   - Add confirmation dialog before delete request.
   - On success, clear selected event and refresh local state/messages.
4. **Test Coverage**
   - Backend integration tests for auth and dependent cleanup.
   - Frontend tests for confirmation true/false and API invocation.
5. **Validation Gate**
   - Frontend: typecheck, lint, tests, build.
   - Backend: build, tests.
   - Integration: publish.

## Risks / Unknowns
- Current database constraints may block event-root delete without explicit dependent deletes.
- UI state cleanup after deletion can leave stale references if not fully reset.
- Irreversible action increases impact of UI wording mistakes.

## Definition of Done
- Endpoint and frontend confirmation are implemented and tested.
- Deleting event removes related beers, participants, favorites, and reviews.
- Validation commands complete successfully.
- Docs and ADR are updated and consistent with behavior.
