# Olsmaking

Single-unit web app using:

- .NET 10 (ASP.NET Core Web API BFF)
- React + TypeScript (`ClientApp` via Vite)
- GitHub Actions (planned CI/CD)
- Azure App Service hosting (F1-first)
- Bicep infrastructure as code (planned)

## Project Layout
- `src/Olsmaking.Bff` .NET BFF host and static file serving
- `src/Olsmaking.Bff/ClientApp` React + TypeScript frontend
- `docs/dev` feature planning docs
- `docs/infra` infrastructure and cost posture docs
- `docs/adr` architecture decision records
- `.opencode/skills` agent skill guidance

## Local Development Quickstart

### Prerequisites
- .NET 10 SDK
- Node.js 20+ and npm

### Auth0 local setup (required for auth-enabled runs)

Run this once per machine, or whenever your local Auth0 values change.

1) Configure your Auth0 application for local callbacks

- Allowed Callback URLs: `http://localhost:5173/signin-oidc,http://localhost:5287/signin-oidc,https://localhost:7006/signin-oidc`
- Allowed Logout URLs: `http://localhost:5173/signout-callback-oidc,http://localhost:5287/signout-callback-oidc,https://localhost:7006/signout-callback-oidc`
- Allowed Web Origins: `http://localhost:5173,http://localhost:5287,https://localhost:7006`

2) Seed local user-secrets with placeholders or real values

```bash
pwsh -File ./scripts/set-user-secrets.ps1
```

Example with real values:

```bash
pwsh -File ./scripts/set-user-secrets.ps1 \
  -Auth0Domain "your-tenant.eu.auth0.com" \
  -Auth0ClientId "your-client-id" \
  -Auth0ClientSecret "your-client-secret" \
  -Auth0Audience "your-api-audience"
```

3) Verify local secrets are present

```bash
dotnet user-secrets list --project src/Olsmaking.Bff/Olsmaking.Bff.csproj
```

### Frontend + backend dev mode (recommended)

Run these commands from the repository root.

1) Terminal 1: install dependencies

```bash
dotnet restore Olsmaking.slnx
npm install --prefix src/Olsmaking.Bff/ClientApp
```

2) Terminal 2: start the .NET backend (BFF host)

```bash
dotnet run --project src/Olsmaking.Bff/Olsmaking.Bff.csproj
```

Backend URLs:
- `http://localhost:5287`
- `https://localhost:7006`

Backend health check:
- `http://localhost:5287/api/health`

3) Terminal 3: start the Vite frontend

```bash
npm run dev --prefix src/Olsmaking.Bff/ClientApp
```

Open the frontend at:
- `http://localhost:5173`

Note:
- The frontend runs on Vite (`5173`) and proxies `/api`, `/signin-oidc`, and `/signout-callback-oidc` to the BFF host (`5287`). Keep the backend process running while developing.

### Single-host local mode (.NET serves built frontend)

Use this when you want to run the app as one host without Vite.

```bash
npm run build --prefix src/Olsmaking.Bff/ClientApp
dotnet run --project src/Olsmaking.Bff/Olsmaking.Bff.csproj
```

Open the app at:
- `http://localhost:5287`
- `https://localhost:7006`

### Optional: Storybook

```bash
npm run storybook --prefix src/Olsmaking.Bff/ClientApp
```

Storybook URL:
- `http://localhost:6006`

### Helpful local checks

```bash
dotnet build Olsmaking.slnx
npm run typecheck --prefix src/Olsmaking.Bff/ClientApp
npm run lint --prefix src/Olsmaking.Bff/ClientApp
npm run test --prefix src/Olsmaking.Bff/ClientApp
```
