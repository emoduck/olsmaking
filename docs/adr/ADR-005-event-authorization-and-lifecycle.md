# ADR-005: Event authorization and lifecycle policy

## Status
Accepted

## Context
Olsmaking is an event-based tasting app where authenticated users collaborate inside event boundaries. We need explicit policy for who can access event resources, how users join, and how event state affects behavior. Without a documented policy, API behavior and UI expectations can drift.

Key product decisions already made:
- Role names are `admin` and `user`.
- Events are private by default, with optional open/listed behavior.
- Joining is done by event code/link (no email invite flow).
- Event owner can remove participants.
- Removed participant history remains visible, while future access is revoked.

## Decision
Adopt event-scoped authorization and lifecycle rules as follows.

### Authorization Model
- `admin`: global override access across events.
- `owner`: creator of event; can manage event settings, participant membership, and join code regeneration.
- `member`: joined participant with access to event beers/reviews according to event state.
- Non-member: no access to private event resources.

### Join and Membership Policy
- Events are private by default.
- Optional open/listed events are allowed via explicit event setting.
- Joining uses code/link and requires authenticated user.
- Join code does not expire automatically.
- Join code is invalidated only when owner/admin manually regenerates it.
- Duplicate join attempts are idempotent and must not create duplicate membership records.

### Removal Policy
- Owner/admin can remove a participant from event membership.
- Removed participant loses further event access and edit capability.
- Existing reviews from removed participant remain visible in event history.

### Event Lifecycle Policy
- `Open`: joining allowed (subject to visibility and code/link), review creation/updates allowed.
- `Closed`: joining blocked; review update behavior is owner/admin controlled by implementation policy (default: block participant updates).
- `Archived`: read-only historical state.

## Consequences

### Positive
- Clear, enforceable access boundaries at API and UI levels.
- Predictable user experience around join, remove, and event status changes.
- Maintains historical tasting integrity while enabling moderation controls.

### Negative
- Requires careful endpoint-level authorization checks across all event resources.
- Lifecycle transitions add policy branching in service logic.
- Optional open/listed events require additional filtering/discovery logic.

## Alternatives Considered
- Global app-level access without strict event membership checks: simpler but violates privacy and ownership boundaries.
- Email invite/approval workflows: stronger gatekeeping but higher complexity and outside MVP scope.
- Automatic join code expiry: stronger security posture but higher operational overhead and not selected for MVP.

## Cost / Operational Impact
- Cost posture impact: low; no additional infrastructure tier required.
- Operational complexity impact: medium; authorization and lifecycle checks must be consistently enforced and tested.

## Rollback / Exit Strategy
If policy needs to change:
1. Keep event and participant data model intact.
2. Introduce revised authorization policy behind feature flags or versioned service rules.
3. Migrate endpoint behavior with compatibility handling where needed.
4. Update feature docs and tests to match new policy.
