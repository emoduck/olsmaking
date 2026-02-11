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
