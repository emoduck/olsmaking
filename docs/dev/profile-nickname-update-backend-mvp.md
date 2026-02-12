# Profile Nickname Update Backend MVP

## Purpose
Enable authenticated users to update their profile nickname in-app while keeping email read-only from identity claims.

## Scope

### In Scope
- Add `PATCH /api/users/me` for authenticated nickname updates.
- Validate nickname input (`required`, trimmed non-empty, max 100 chars).
- Persist nickname and refresh `LastSeenUtc`.
- Return response payload aligned with `GET /api/users/me`.
- Add integration tests for success, validation failures, and auth-unconfigured fallback.

### Out of Scope
- Email update endpoint.
- Avatar or profile image updates.
- Database schema changes.

## UI / Behavior Notes
- Profile UI can submit partial profile update requests with `nickname`.
- Whitespace-only nickname input is rejected to prevent blank identity display.
- Validation failures return `400` with field-level errors.

## Backend / API Impact
- Adds `PATCH /api/users/me` in BFF minimal API.
- `GET /api/users/me` keeps persisted nickname for existing users; claim nickname is used only when creating a user record.
- Auth-unconfigured environments return `503` consistently for the new endpoint.

## Dependencies / Assumptions
- Existing Auth0/cookie auth setup remains unchanged.
- Existing `AppUser.Nickname` max length (100) is already configured in EF model.
- Existing integration test infrastructure uses test auth headers.

## Open Questions
- Should nickname uniqueness be enforced globally in a later iteration?

## Validation Plan
- Backend: `dotnet build`, `dotnet test`

## ADR Needed?
- No
