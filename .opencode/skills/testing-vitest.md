# Skill: testing-vitest

## Purpose
Add focused, reliable frontend tests with Vitest.

## Conventions
- Test behavior, not implementation details.
- Favor user-observable outcomes over brittle snapshots.
- Cover happy path, validation/error path, and one edge case minimum.
- Keep test setup local; extract shared utilities only when repeated.
- For simple view components, pair tests with Storybook stories where practical.
- Do not require Storybook coverage for container/page components by default.

## Validation
- `npm test -- --runInBand`

## Output Requirements
- Document untested paths and why they were skipped.
