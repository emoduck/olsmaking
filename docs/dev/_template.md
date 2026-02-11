# <Feature Name>

## Purpose
Describe the user/problem outcome this feature delivers and why it matters now.

## Scope

### In Scope
- 

### Out of Scope
- 

## UI / Behavior Notes
- Entry points (routes, navigation, controls)
- Expected user flows and edge-case behavior
- Error and empty states
- Accessibility considerations

## Backend / API Impact
- Endpoints/contracts added or changed (if any)
- Data model changes (if any)
- Auth/authz implications (if any)

## Dependencies / Assumptions
- Technical dependencies
- Environment/runtime assumptions
- External services and integration assumptions

## Open Questions
- 

## Validation Plan
- Frontend: `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, `npm run build`
- Backend: `dotnet build`, `dotnet test`
- Integration: frontend build integrated into host, then `dotnet publish`

## ADR Needed?
- Yes/No
- If yes, target path: `docs/adr/<adr-name>.md`
