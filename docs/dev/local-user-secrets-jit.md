# Local User Secrets (Just-in-Time)

## Purpose
Define how this repository handles local secrets safely using `dotnet user-secrets` only when a real secret is introduced.

## Scope

### In Scope
- Local development secret handling for the .NET host project.
- Command workflow for initializing and managing user secrets.
- Guidance on when to use user secrets versus non-sensitive config.

### Out of Scope
- Azure production secret storage (for example, Key Vault).
- CI/CD secret management in GitHub Actions.
- Changes to runtime hosting tiers or infrastructure.

## UI / Behavior Notes
- No UI changes.
- No user-facing behavior changes.

## Backend / API Impact
- Project-level metadata change only when initialized (`UserSecretsId` in `src/Olsmaking.Bff/Olsmaking.Bff.csproj`).
- Configuration values are read through the existing ASP.NET Core configuration pipeline in Development.
- No endpoint contract changes.

## Dependencies / Assumptions
- .NET SDK is installed locally.
- Development environment is used when resolving user secrets.
- Secret keys follow hierarchical naming (for example, `Auth0:ClientSecret`).

## Open Questions
- Should we standardize key naming patterns in a central conventions doc as more integrations are added?

## Workflow
1. Initialize user secrets only when a real secret is required:
   - `dotnet user-secrets init --project src/Olsmaking.Bff/Olsmaking.Bff.csproj`
2. Set local Auth0 secrets using the setup script (recommended):
   - `pwsh -File ./scripts/set-user-secrets.ps1`
   - Optional audience placeholder: `pwsh -File ./scripts/set-user-secrets.ps1 -IncludeAudiencePlaceholder`
3. Manual fallback (if script is unavailable):
   - `dotnet user-secrets set "Auth0:Domain" "<tenant-domain>" --project src/Olsmaking.Bff/Olsmaking.Bff.csproj`
   - `dotnet user-secrets set "Auth0:ClientId" "<client-id>" --project src/Olsmaking.Bff/Olsmaking.Bff.csproj`
   - `dotnet user-secrets set "Auth0:ClientSecret" "<client-secret>" --project src/Olsmaking.Bff/Olsmaking.Bff.csproj`
   - `dotnet user-secrets set "Auth0:Audience" "<audience>" --project src/Olsmaking.Bff/Olsmaking.Bff.csproj`
4. Verify local values are present:
   - `dotnet user-secrets list --project src/Olsmaking.Bff/Olsmaking.Bff.csproj`
5. Read settings from configuration in code:
   - `builder.Configuration["Auth0:Domain"]` or typed options binding.
6. Validate auth-enabled local behavior:
   - `dotnet run --project src/Olsmaking.Bff/Olsmaking.Bff.csproj`
   - Health: `http://localhost:5287/api/health`
   - Login endpoint: `http://localhost:5287/api/auth/login?returnUrl=/`

## Guardrails
- Never commit plaintext secrets to `appsettings.json` or `appsettings.Development.json`.
- Keep non-sensitive defaults in appsettings files and place only sensitive values in user secrets.
- If a secret is accidentally committed, rotate it and remove it from tracked files immediately.

## Validation Plan
- Backend: `dotnet build`
- Secrets check: `dotnet user-secrets list --project src/Olsmaking.Bff/Olsmaking.Bff.csproj`
- Runtime check: run in Development and confirm `/api/auth/login` is available when Auth0 secrets are configured.

## ADR Needed?
- No
