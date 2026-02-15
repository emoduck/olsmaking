# Event Beer Scoring Accordion

## Purpose
Move scoring into each beer entry so tasters can review in context, reduce scrolling, and make it clearer which beer a score/comment belongs to.

## Scope

### In Scope
- Replace the static bottom review section in event workspace with an accordion list inside the beer list.
- Allow zero or one accordion item open at a time.
- Keep existing review API flow and score/comment fields unchanged.
- Preserve favorite actions per beer in the new list layout.
- Collapse the add-beer form by default and toggle it with a compact `+` / `X` button.
- Update frontend tests for accordion behavior and inline review submit behavior.

### Out of Scope
- Backend/API contract changes for reviews.
- Any scoring model changes (still color/smell/taste/total + notes fields).
- Favorites domain behavior changes.

## UI / Behavior Notes
- Each beer row acts as an accordion item with a trigger and an inline review panel.
- Clicking a closed item opens it and closes the currently open item.
- Clicking the currently open item collapses it, resulting in zero open items.
- Review form lives inside the open beer panel and reuses the existing score controls and notes fields.
- Existing review hydration remains tied to selected beer; collapsing clears visible form state.
- Accordion trigger exposes `aria-expanded` and `aria-controls` for accessibility.
- Add-beer form is hidden by default, opens with a `+` icon, collapses with a `-` icon, and stays open after successful submit for rapid multi-add.

## Backend / API Impact
- No endpoint changes.
- Existing endpoints remain:
  - `GET /api/events/{eventId}/beers/{beerId}/reviews/me`
  - `PATCH /api/events/{eventId}/beers/{beerId}/reviews/me`
  - `POST /api/events/{eventId}/beers/{beerId}/reviews` (fallback path)
- No data model or auth changes.

## Dependencies / Assumptions
- Existing `selectedBeerId` state remains the source of truth for which panel is open.
- Existing `StarScoreSlider` accessibility behavior remains valid in accordion context.
- Current event workspace still auto-selects first beer on load; users can then collapse to zero-open.

## Open Questions
- Should unsaved edits be preserved when switching beers, or always replaced by hydrated data?

## Validation Plan
- Frontend: `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, `npm run build`
- Backend: not required (frontend-only behavior)
- Integration: not required for this UI-only change

## ADR Needed?
- No
- UI interaction refactor within existing architecture and API contracts.
