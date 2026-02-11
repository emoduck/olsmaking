# Skill: react-typescript-architecture

## Purpose
Guide React + TypeScript changes so they are typed, maintainable, and integration-friendly with the .NET host.

## Conventions
- Prefer small, composable components with explicit props and return types.
- Keep domain logic out of view components when possible.
- Centralize API contracts and shared types to avoid drift.
- Handle loading, empty, and error states explicitly.
- Maintain accessibility basics (labels, keyboard support, semantic HTML).

## Validation
- `npm run typecheck`
- `npm run lint`
- `npm test -- --runInBand`
- `npm run build`

## Review Checklist
- No `any` without justification.
- Side effects are isolated and cleanup is present.
- UI behavior matches feature doc scope.
