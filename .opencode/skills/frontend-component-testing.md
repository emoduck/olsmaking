# Skill: frontend-component-testing

## Purpose
Keep frontend component testing focused, maintainable, and aligned with view/component boundaries.

## Target Components
- Test simple presentational/view components.
- Prefer explicit props and observable behavior.

## Non-Targets by Default
- Container components with orchestration-heavy logic.
- Page-level integration behavior (unless task explicitly includes it).

## Approach
- Add or update Storybook stories for target components.
- Add Vitest/RTL tests for behavioral assertions.
- Cover empty/loading/error states when relevant.
