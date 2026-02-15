# Responsive Primary Navigation

## Purpose
Align primary navigation with device expectations by using a fixed, centered bottom tab bar on small screens and a standard top navigation bar on large screens.

## Scope

### In Scope
- Center and stabilize the bottom navigation layout for small displays.
- Add a top primary navigation bar for larger screens.
- Show only one primary navigation location at a time based on viewport width.

### Out of Scope
- Adding or removing tabs from primary navigation.
- Implementing the disabled "Smakinger" section.
- Route-level refactoring of tab state management.

## UI / Behavior Notes
- Small screens use a fixed, centered bottom menu for thumb-friendly navigation.
- Large screens show a top menu under the header and hide the bottom menu.
- Tab behavior and active state remain unchanged across breakpoints.
- Existing hint/spacer used for the mobile bottom bar are hidden on large screens.

## Backend / API Impact
- No backend or API changes.

## Dependencies / Assumptions
- Existing breakpoint conventions in the app are preserved (`768px` as desktop switch).
- Current tab state remains local in `App.tsx` and is reused for both menu placements.
- CSS module token system continues to provide spacing, color, and typography values.

## Open Questions
- Route-based navigation follow-up is tracked in `docs/dev/spa-routing-foundation.md` and `docs/adr/ADR-007-spa-tab-routing-and-deep-link-support.md`.
- Should the disabled "Smakinger" tab remain visible in desktop navigation or be hidden until available?

## Validation Plan
- Frontend: `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, `npm run build`
- Backend: no change expected
- Integration: no change expected

## ADR Needed?
- No
