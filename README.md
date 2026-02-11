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

## Run Locally

### Prerequisites
- .NET 10 SDK
- Node.js 20+ and npm

### 1) Install dependencies
```bash
dotnet restore Olsmaking.slnx
npm install --prefix src/Olsmaking.Bff/ClientApp
```

### 2) Start the backend (.NET BFF host)
```bash
dotnet run --project src/Olsmaking.Bff/Olsmaking.Bff.csproj
```

Backend URLs:
- `http://localhost:5287`
- `https://localhost:7006`

Backend health check:
- `http://localhost:5287/api/health`

### 3) Start the frontend (Vite) in a second terminal
```bash
npm run dev --prefix src/Olsmaking.Bff/ClientApp
```

Frontend URL:
- `http://localhost:5173`

### 4) (Optional) Start Storybook in a third terminal
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
