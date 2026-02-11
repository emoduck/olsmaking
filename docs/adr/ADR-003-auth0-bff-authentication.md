# ADR-003: Auth0 authentication with BFF-managed session

## Status
Accepted

## Context
Olsmaking needs authentication for event creation, joining, and review workflows. The app is delivered as a single deployable unit: ASP.NET Core BFF host + React frontend. We need a secure, low-complexity approach that fits this architecture and keeps browser-side auth handling minimal.

Requirements shaping the decision:
- Standard user signup/login through Auth0 (free tier).
- One elevated role named `admin` using Auth0 `admin-scope`.
- Event-scoped authorization for owner/member access rules.
- Minimal security risk from token storage in browser JavaScript.

## Decision
Use Auth0 with OpenID Connect in the .NET BFF and manage authenticated session via secure HTTP-only cookies.

Policy details:
- Authentication is performed by the BFF (`challenge`/`callback`/`logout` flow).
- Frontend calls same-origin BFF endpoints and does not directly store access tokens in local storage/session storage.
- App user identity is anchored to Auth0 subject (`sub`).
- `admin` access is granted based on Auth0 permission/claim mapping for `admin-scope`.
- Event authorization is enforced server-side by event membership/ownership checks.

## Consequences

### Positive
- Reduces browser token handling risk.
- Keeps frontend implementation simpler and focused on product flows.
- Fits single-unit BFF architecture cleanly.
- Enables centralized authorization checks in one backend layer.

### Negative
- Requires OIDC/cookie configuration in backend and environment setup in Auth0.
- Requires callback/logout URL management per environment.
- Adds dependency on Auth0 availability for login flows.

## Alternatives Considered
- SPA-managed Auth0 tokens in frontend only: simpler initial frontend integration, but more browser-side token handling risk and duplicated auth logic.
- Custom identity implementation in app database: higher implementation and maintenance burden, unnecessary for MVP.
- Azure AD B2C/Entra External ID: viable later, but adds migration complexity and is not selected for current MVP timeline.

## Cost / Operational Impact
- Cost posture impact: low initial cost using Auth0 free tier for MVP scale.
- Operational complexity impact: medium; requires claim mapping, cookie/session config, and environment URL coordination.

## Rollback / Exit Strategy
If Auth0 no longer fits requirements, migrate identity provider behind the same BFF session boundary:
1. Keep internal app authorization model and data schema (`AppUser` linked by external subject).
2. Introduce new OIDC provider configuration.
3. Map incoming subject/claims to existing app users.
4. Remove Auth0-specific claim mapping once migration is complete.
