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

Dev proxy behavior:
- Vite proxies `/api`, `/signin-oidc`, and `/signout-callback-oidc` to `http://localhost:5287`.
- Start the BFF host before testing login or API calls from `http://localhost:5173`.

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

## Styling Conventions
- Standard: CSS Modules are the default approach for component and feature styles.
- File naming: use `*.module.css` and import as `styles` in React components.
- Global CSS: keep it limited to app-wide primitives only (reset/base/theme tokens), currently in `src/index.css`.
- Inline style usage: allow only very minor one-off presentational tweaks, typically `<= 2` declarations.
- Use CSS Modules instead of inline styles when styling is reused, conditional, stateful, responsive, themed, or more than trivial.
- Migration policy: touch-and-migrate existing legacy global CSS to modules when modifying affected files.
- Source of truth: `docs/adr/ADR-002-css-styling-standard.md`.
