# Profile Logout Action MVP

## Purpose
Replace the account action label and behavior from `Bytt konto` to a profile-oriented `Logg ut` action so users get a clear and expected sign-out flow.

## Scope

### In Scope
- Update account action copy from `Bytt konto` to `Logg ut` in profile/account surfaces.
- Trigger sign-out from the current authenticated session when the action is selected.
- Ensure post-logout behavior returns users to the app's unauthenticated/default entry state.

### Out of Scope
- Redesigning profile navigation or account menu structure.
- Adding account-switching support for multiple signed-in identities.
- Changing authentication provider configuration.

## UI / Behavior Notes
- Entry point is moved from the top header to the `Profil` panel.
- Label shown to users is `Logg ut`.
- Selecting `Logg ut` ends the current session and routes to the expected signed-out state.
- If sign-out fails, show existing error handling pattern for auth actions.
- Action remains keyboard-accessible and screen-reader discoverable as a sign-out control.

## Decision
- Replace `Bytt konto` with `Logg ut` and remove `Bytt konto` from the header.
- Implement logout from the profile page as a POST form to `/api/auth/logout` with `returnUrl` set to the current route.

## Backend / API Impact
- No new backend endpoints expected.
- Existing auth/logout endpoint or host-level logout flow is reused.
- No data model changes expected.
- BFF OpenID Connect sign-out redirect includes `client_id` to ensure Auth0 validates `post_logout_redirect_uri` against the correct application.

## Dependencies / Assumptions
- Existing authentication/logout mechanism is already implemented and callable from the frontend.
- Current localization approach allows replacing `Bytt konto` with `Logg ut` without new i18n infrastructure.
- No Azure hosting tier changes required (F1-first posture unchanged).

## Open Questions
- None for MVP.

## Validation Plan
- Frontend: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
- Backend: `dotnet build src/Olsmaking.Bff/Olsmaking.Bff.csproj`
- Integration: verify logout from integrated host and confirm signed-out landing behavior

## Local Dev Notes
- Vite dev server now runs with increased HTTP header size to avoid `431 Request Header Fields Too Large` during OIDC callback flows (`/signin-oidc`) when temporary auth cookies are large.

## ADR Needed?
- No
