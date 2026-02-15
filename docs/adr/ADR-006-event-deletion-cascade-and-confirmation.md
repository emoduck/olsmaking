# ADR-006: Event deletion cascade and confirmation policy

## Status
Proposed

## Context
The event lifecycle currently supports create/join/manage flows, but lacks a first-class event deletion policy. As a result, users cannot fully remove obsolete events, and there is no documented rule for how event-scoped dependent data (beers, participants, favorites, reviews) should be handled.

Because deletion is irreversible and impacts multiple related records, we need a clear policy for:
- authorization boundaries,
- data cleanup behavior,
- and user confirmation requirements in the UI.

## Decision
Adopt hard-delete event behavior with owner/admin authorization and mandatory client confirmation.

### Authorization
- `admin` can delete any event.
- `owner` can delete owned events.
- Non-owner, non-admin users cannot delete events.

### Deletion Behavior
- Endpoint: `DELETE /api/events/{eventId}`.
- Successful delete removes the event and all event-scoped dependent data.
- Preferred implementation is event-root deletion, relying on existing foreign key relationships and delete behavior.
- If constraints prevent root deletion, service logic may explicitly delete dependents in a single transaction before deleting the event.

### UX Safety Requirement
- Frontend must ask users for explicit destructive confirmation ("Are you sure?") before sending delete request.
- Canceling confirmation must not invoke the API.

## Consequences

### Positive
- Users can clean up obsolete events and keep their workspace manageable.
- Event-scoped data consistency is preserved by deleting related records together.
- Clear, documented destructive-action UX reduces accidental deletions.

### Negative
- Hard delete is irreversible without external backups.
- Requires careful test coverage for authorization and dependent data cleanup.
- Existing favorite/review data tied to deleted events is intentionally lost.

## Alternatives Considered
- Soft delete (`IsDeleted`) with hidden records: reversible, but adds query complexity and policy overhead across all endpoints.
- Archive-only policy with no delete: safer, but does not satisfy explicit cleanup need.
- Owner-only deletion (excluding admin): simpler ownership model, but reduces support/admin operations flexibility.

## Cost / Operational Impact
- Cost posture impact: low; no infrastructure or SKU changes required.
- Operational complexity impact: low to medium; implementation and tests are straightforward but must verify cross-table cleanup.

## Rollback / Exit Strategy
If hard delete is later deemed too risky:
1. Introduce soft-delete fields and filter logic behind feature flags.
2. Keep delete endpoint contract but transition behavior to soft delete.
3. Add migration and API compatibility handling.
4. Update docs/dev and ADR status accordingly.
