# Skill: storybook-react-ts

## Purpose
Use Storybook for local-first development and testability of React + TypeScript view components.

## Scope
- Include simple/presentational view components.
- Exclude container/page components unless explicitly requested.

## Conventions
- Use typed stories (CSF) and explicit args.
- Keep stories deterministic and minimal.
- Prefer interaction/play tests for user-level behavior.
- Storybook is local-only by default (no hosted deployment).

## Validation
- `npm run storybook` (manual local check)
- `npm run build-storybook`
