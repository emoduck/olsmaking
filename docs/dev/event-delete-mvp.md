# Event Delete MVP

## Purpose
Allow event owners and admins to permanently delete an event when it is no longer needed, while guaranteeing that event-scoped tasting data is removed consistently and users are protected by an explicit confirmation step.

## Scope

### In Scope
- Backend endpoint for deleting an event by id.
- Authorization rule: event `owner` and `admin` can delete.
- Hard-delete behavior for the event and event-scoped dependent data (participants, beers, favorites, reviews).
- Frontend delete action in event workspace.
- Frontend confirmation dialog before delete request is sent.
- Automated tests for authorization, cascade behavior, and confirmation flow.

### Out of Scope
- Soft-delete or restore/undo workflows.
- Multi-step approval or moderator queue for deletion.
- Audit log storage beyond existing application logging.
- Batch deletion or retention policy automation.

## UI / Behavior Notes
- Entry point: event workspace for a selected event.
- Delete action is visible only to users with `owner` or `admin` access for the selected event.
- User must explicitly confirm deletion in a blocking "Are you sure?" dialog.
- Canceling confirmation must not trigger any API request.
- Success behavior: clear selected workspace state, remove deleted event from local lists, and show success feedback.
- Failure behavior: keep current workspace visible and show error feedback.
- Accessibility baseline: confirmation must have clear, irreversible wording.

## Backend / API Impact
- Add endpoint: `DELETE /api/events/{eventId}`.
- Contract behavior:
  - `204 No Content` when deletion succeeds.
  - `404 Not Found` when event does not exist.
  - `403 Forbidden` when caller is neither owner nor admin.
- Data model impact: no new schema required if existing foreign-key delete behavior allows event-root deletion with dependent cleanup.
- Auth/authz impact: aligns with existing owner/admin management actions.

## Dependencies / Assumptions
- Existing authentication and user resolution flow is available.
- Existing EF Core model relationships support required cascade behavior for dependent event data.
- Frontend uses current API client and feedback pattern in `App.tsx`.
- Strings remain `nb-NO` style for user-facing feedback.

## Open Questions
- Should deletion be blocked when event status is `Open`, or allowed regardless of status?
- Should we emit explicit telemetry/log markers for event deletion outcomes?

## Validation Plan
- Frontend: `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, `npm run build`
- Backend: `dotnet build`, `dotnet test`
- Integration: frontend build integrated into host, then `dotnet publish`

## ADR Needed?
- Yes
- Target path: `docs/adr/ADR-006-event-deletion-cascade-and-confirmation.md`
