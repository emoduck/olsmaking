# Beer Style Presets

## Purpose
Improve beer registration consistency and speed by replacing free-text style entry with a curated preset list, while still allowing uncommon styles through an `Annet` fallback.

## Scope

### In Scope
- Replace the add-beer style free-text input with a preset dropdown.
- Use a Norwegian, simplified BJCP-inspired style list.
- Keep style optional with an empty default option (`Velg stil (valgfritt)`).
- Support `Annet` with a conditional custom-text input.
- Send selected preset/custom value through existing `style` API field.
- Add frontend tests for preset and `Annet` flows.

### Out of Scope
- Backend contract/database changes for beer style.
- New taxonomy/versioning for style catalogs.
- Autocomplete/search/filtering for styles.

## UI / Behavior Notes
- Entry point: `Legg til øl` form inside arrangement workspace.
- Style dropdown starts empty and shows `Velg stil (valgfritt)`.
- If a predefined style is selected, that value is sent as `style`.
- If `Annet` is selected, show `Egendefinert stil` input and require non-empty value before submit.
- If no style is selected, submit `style: null`.
- Existing ABV/name validation behavior remains unchanged.

## Backend / API Impact
- No endpoint changes.
- Existing `CreateEventBeerRequest.style?: string | null` remains in use.
- Existing backend style length validation (max 100 chars) continues to apply.
- No auth/authz changes.

## Dependencies / Assumptions
- Current BFF + React client request shape remains unchanged.
- Norwegian copy conventions remain the UI baseline.
- Existing frontend tests and fetch mocks are used for regression coverage.

## Open Questions
- Should style presets eventually be centrally defined and shared between frontend and backend metadata endpoints?

## Validation Plan
- Frontend: `npm run test -- --runInBand App.test.tsx`

## ADR Needed?
- No
- If yes, target path: `docs/adr/<adr-name>.md`
