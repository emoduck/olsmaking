# BFF + ClientApp Bootstrap

## Purpose
Establish a single deployable web application unit using a .NET 10 BFF host with an embedded React + TypeScript `ClientApp`.

## Scope

### In Scope
- ASP.NET Core Web API host scaffold (`.NET 10`).
- React + TypeScript `ClientApp` scaffold using Vite and npm.
- Static asset hosting integration from BFF.
- Local Storybook setup for simple view components.

### Out of Scope
- Production Storybook hosting.
- Advanced infra topology beyond single App Service unit.
- Enterprise authn/authz patterns.

## UI / Behavior Notes
- Frontend is served by the BFF as static assets.
- Storybook is local-only for component development/testing.

## Backend / API Impact
- BFF host exposes API endpoints and serves SPA assets.
- Publish pipeline includes frontend build artifacts in host output.

## Dependencies / Assumptions
- .NET 10 SDK
- Node.js/npm for `ClientApp`
- Azure App Service as hosting target

## Open Questions
- Final API boundary shape between BFF controllers and frontend data hooks.
- Whether future component sharing requires hosted Storybook previews.

## Validation Plan
- Frontend: `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, `npm run build`
- Backend: `dotnet build`, `dotnet test`
- Integration: frontend build integrated into host, then `dotnet publish`

## ADR Needed?
- Yes
- `docs/adr/ADR-001-storybook-github-pages-option.md` tracks Storybook hosting direction.
