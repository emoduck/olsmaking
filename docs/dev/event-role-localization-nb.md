# Event Role Localization (Norwegian)

## Purpose
Show human-friendly Norwegian role names in the event workspace so users see clear role labels instead of backend enum values.

## Scope

### In Scope
- Add a client-side mapping for event role values (`owner`, `admin`, `member`) to Norwegian labels.
- Use the mapping when rendering `Din rolle` in event workspace.
- Add unit tests that verify mapping behavior and fallback behavior.

### Out of Scope
- Backend API contract changes for role values.
- Changes to participant-role rendering in other UI areas.
- Full i18n or localization framework adoption.

## UI / Behavior Notes
- `Din rolle: owner` now displays `Din rolle: Arrangør`.
- Known mappings:
  - `owner` -> `Arrangør`
  - `admin` -> `Administrator`
  - `member` -> `Deltaker`
- Unknown or unexpected role values display `Ukjent rolle`.
- Mapping is case-insensitive and trims surrounding whitespace.

## Backend / API Impact
- No endpoint changes.
- No data model changes.
- Auth/authz behavior remains unchanged; this is display-only logic in frontend.

## Dependencies / Assumptions
- Backend continues returning role keys as strings (`owner`, `admin`, `member`).
- Frontend remains the source of display labels for roles.

## Open Questions
- Should participant rows also display localized role labels in a later iteration?

## Validation Plan
- Frontend: `npm run test --prefix src/Olsmaking.Bff/ClientApp`
- Frontend: `npm run typecheck --prefix src/Olsmaking.Bff/ClientApp`
- Frontend: `npm run lint --prefix src/Olsmaking.Bff/ClientApp`
- Frontend: `npm run build --prefix src/Olsmaking.Bff/ClientApp`

## ADR Needed?
- No
- If yes, target path: `docs/adr/<adr-name>.md`
