# ClientApp

React + TypeScript frontend for the .NET BFF host.

## Local Quickstart

Run commands from this `ClientApp` directory unless noted otherwise.

1) Install frontend dependencies

```bash
npm install
```

2) Start Vite dev server

```bash
npm run dev
```

Open:
- `http://localhost:5173`

3) In a separate terminal, start the backend host from repo root

```bash
dotnet run --project src/Olsmaking.Bff/Olsmaking.Bff.csproj
```

Backend URLs:
- `http://localhost:5287`
- `https://localhost:7006`

Health check:
- `http://localhost:5287/api/health`

## Local Commands
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run storybook`
- `npm run build-storybook`

## Storybook Scope
- Storybook is local-only for now.
- Focus stories on simple/presentational view components.
- Do not treat container/page components as Storybook targets by default.
