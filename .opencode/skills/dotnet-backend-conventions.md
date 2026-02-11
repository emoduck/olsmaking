# Skill: dotnet-backend-conventions

## Purpose
Keep .NET backend/host changes consistent, testable, and safe for single-unit deployment.

## Conventions
- Prefer clear separation between API, application logic, and infrastructure concerns.
- Validate inputs and return explicit error responses.
- Keep configuration environment-driven; avoid hardcoded secrets.
- Keep contract changes backward-compatible unless feature scope allows breaking changes.

## Validation
- `dotnet build`
- `dotnet test` (if tests exist)

## Review Checklist
- Error handling covers expected failure paths.
- Logging is useful and non-sensitive.
- API changes are reflected in docs/dev when behavior changes.
