# Beer Review Multi-Score Star Rating

## Purpose
Allow tasters to score each beer with separate 1-6 scores for color, smell, and taste, plus an independently chosen total score. This improves review quality by capturing key sensory dimensions without forcing the total score to be computed from sub-scores.

## Scope

### In Scope
- Replace single `rating` in beer reviews with:
  - `colorScore`
  - `smellScore`
  - `tasteScore`
  - `totalScore`
- Enforce integer `1-6` validation for all four score fields in create/update APIs and persistence.
- Update review create/get/patch response contracts to return the four score fields.
- Replace the current numeric range input with reusable star-step controls (6 increments) for each score field.
- Update backend and frontend tests for the new payload and UI behavior.
- Migrate existing rows by seeding all four new score fields from legacy `Rating`.

### Out of Scope
- Group analytics/averages for reviews.
- Changes to favorites, event lifecycle, or auth behavior.
- Any infrastructure or deployment topology changes.

## UI / Behavior Notes
- Review form shows four labeled score controls:
  - `Farge`
  - `Lukt`
  - `Smak`
  - `Total`
- Each control uses a star-step slider with six discrete values (`1-6`).
- Selected value is shown as text (`<label>: X / 6`) and updates immediately on interaction.
- `Total` is user-entered and independent. It is not auto-calculated from other scores.
- Controls must remain keyboard accessible and retain clear focus-visible styles.
- Existing note fields remain unchanged.

## Backend / API Impact
- Endpoints affected:
  - `POST /api/events/{eventId}/beers/{beerId}/reviews`
  - `GET /api/events/{eventId}/beers/{beerId}/reviews/me`
  - `PATCH /api/events/{eventId}/beers/{beerId}/reviews/me`
- Request/response contract changes:
  - remove `rating`
  - add `colorScore`, `smellScore`, `tasteScore`, `totalScore`
- Data model changes:
  - `BeerReview` replaces `Rating` with four integer score columns.
  - Add DB constraints requiring each score to be between `1` and `6`.
- Migration strategy:
  - Add new non-null score columns.
  - Backfill from legacy `Rating` for all existing rows.
  - Drop legacy `Rating` and its check constraint.
- Auth/authz behavior remains unchanged.

## Dependencies / Assumptions
- React + TypeScript frontend with CSS Modules remains the UI standard.
- Existing API clients in this repo are updated in the same change.
- Legacy rows, if any, have valid `Rating` values; fallback value of `3` is used only as a guardrail for unexpected invalid data.

## Open Questions
- None for this implementation slice.

## Validation Plan
- Frontend: `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, `npm run build`
- Backend: `dotnet build`, `dotnet test`
- Integration: frontend build integrated into host, then `dotnet publish`

## ADR Needed?
- No
- This is a bounded data-contract and UI-control evolution within existing architecture.
