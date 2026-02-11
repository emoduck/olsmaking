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
- Secret keys follow hierarchical naming (for example, `ExternalApi:ApiKey`).

## Open Questions
- Should we standardize key naming patterns in a central conventions doc as more integrations are added?

## Workflow
1. Initialize user secrets only when a real secret is required:
   - `dotnet user-secrets init --project src/Olsmaking.Bff/Olsmaking.Bff.csproj`
2. Set secret values:
   - `dotnet user-secrets set "ExternalApi:ApiKey" "<value>" --project src/Olsmaking.Bff/Olsmaking.Bff.csproj`
3. Verify local values are present:
   - `dotnet user-secrets list --project src/Olsmaking.Bff/Olsmaking.Bff.csproj`
4. Read settings from configuration in code:
   - `builder.Configuration["ExternalApi:ApiKey"]` or typed options.

## Guardrails
- Never commit plaintext secrets to `appsettings.json` or `appsettings.Development.json`.
- Keep non-sensitive defaults in appsettings files and place only sensitive values in user secrets.
- If a secret is accidentally committed, rotate it and remove it from tracked files immediately.

## Validation Plan
- Backend: `dotnet build`
- Runtime check: run in Development and confirm secret-backed settings resolve.

## ADR Needed?
- No
