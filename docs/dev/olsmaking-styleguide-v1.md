# Olsmaking Styleguide v1

## Purpose
Define a mobile-first, clean, professional, and minimal UI standard for Olsmaking so the product stays consistent, fast to use, and easy to implement across React + TypeScript screens.

## Scope

### In Scope
- Mobile-first visual and interaction standards for core user flows: browse beers, view beer details, log tastings, rate beers, and save favorites.
- Color, typography, spacing, layout, and component behavior standards.
- CSS Modules implementation conventions and token usage.
- Accessibility baseline requirements for interactive components.

### Out of Scope
- Brand marketing assets (logos, campaigns, social graphics).
- Experimental themes, decorative visual effects, or playful UI patterns.
- Full design system tooling decisions (for example, Figma libraries or token build pipelines).

## UI / Behavior Notes

### Product Direction
- Style goals: clean, professional, minimal, usability-first.
- Avoid decorative or playful visuals.
- UI language: Norwegian Bokmal (`nb-NO`) for all user-facing text.
- Rating system: dice-like `1-6` scale.

### Design Principles
1. Clarity first: each screen has one primary task and clear hierarchy.
2. Readability first: high contrast, restrained typography, short labels.
3. Fast interaction: common actions reachable quickly on mobile.
4. Consistency first: repeated patterns for states, spacing, and controls.
5. Mobile ergonomics: thumb-friendly controls and bottom navigation.

### CSS Tokens
Define app-wide tokens in a single global stylesheet (for example `src/index.css`) and consume values from component-level CSS Modules.

```css
:root {
  --color-primary-700: #1f3a5f;
  --color-primary-600: #2b4b75;
  --color-primary-500: #3a5f8f;

  --color-gray-900: #111827;
  --color-gray-800: #1f2937;
  --color-gray-700: #374151;
  --color-gray-600: #4b5563;
  --color-gray-500: #6b7280;
  --color-gray-400: #9ca3af;
  --color-gray-300: #d1d5db;
  --color-gray-200: #e5e7eb;
  --color-gray-100: #f3f4f6;
  --color-gray-50: #f9fafb;

  --color-bg-app: #f9fafb;
  --color-bg-surface: #ffffff;
  --color-bg-subtle: #f3f4f6;

  --color-border-default: #e5e7eb;
  --color-border-strong: #d1d5db;

  --color-success: #166534;
  --color-success-bg: #ecfdf3;
  --color-error: #b42318;
  --color-error-bg: #fef3f2;

  --color-text-primary: #111827;
  --color-text-secondary: #4b5563;
  --color-text-muted: #6b7280;
  --color-text-on-primary: #ffffff;

  --font-family-base: Inter, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-size-12: 0.75rem;
  --font-size-14: 0.875rem;
  --font-size-16: 1rem;
  --font-size-18: 1.125rem;
  --font-size-20: 1.25rem;
  --font-size-24: 1.5rem;
  --line-height-tight: 1.25;
  --line-height-normal: 1.5;

  --space-8: 8px;
  --space-16: 16px;
  --space-24: 24px;
  --space-32: 32px;
  --space-40: 40px;
  --space-48: 48px;

  --radius-8: 8px;
  --radius-12: 12px;
  --shadow-sm: 0 1px 2px rgba(17, 24, 39, 0.06);
}
```

### Color Usage Rules
- Use primary colors for key actions, active nav state, and slider active track.
- Use neutral palette for text, surfaces, and separators.
- Keep surfaces flat and restrained; no gradients for product UI.
- Use success/error colors only for feedback and validation states.

### Typography Rules
- Primary font: Inter with system fallbacks.
- Body text default: `16px`; metadata can be `14px`.
- Keep headings restrained and practical.
- Ratings and ABV values use `font-variant-numeric: tabular-nums`.

### Layout and Spacing
- Mobile-first baseline at `320px` width.
- Single-column layouts by default on mobile.
- Breakpoints: `480px`, `768px`, `1024px`, `1280px`.
- Use 8px spacing system for all paddings, gaps, and margins.

### Core Components

#### Beer Card
- Content order: name, brewery/style, ABV, rating, actions.
- Card padding: `16px`; internal spacing: `8px`.
- Border: `1px solid var(--color-border-default)`.
- Keep action row separated by spacing or subtle divider.

#### Rating Slider (`1-6`)
- Range: `1` to `6`, step `1`.
- Label example: `Vurdering (1-6)`.
- Minimum touch area: `44px` height.
- Show selected value clearly (for example `4 / 6`) with immediate update while dragging.
- Active track uses primary color; inactive track uses neutral border tone.

#### Buttons
- Primary: filled primary background, white text, minimum height `44px`.
- Secondary: neutral surface, border, primary text.
- Disabled: muted colors, non-interactive semantics.

#### Search Field
- Minimum height `44px`, input text `16px`.
- Optional leading icon.
- Show clear action when input has value.
- Debounce search updates (`200-300ms`) for mobile responsiveness.

#### Bottom Navigation
- Fixed bottom navigation for primary app sections.
- Maximum 5 items.
- Active item uses primary color; inactive item uses neutral text.
- Each item touch target must be at least `44x44px`.

### CSS Modules Conventions
- New component/feature styles must use `*.module.css` files.
- Keep global CSS limited to resets, base primitives, and token declarations.
- Prefer simple class names scoped by module file (`container`, `title`, `meta`, `actions`).
- Do not add new broad global selectors for feature styling.
- Use module classes for state variants (`.isActive`, `.isDisabled`) instead of page-wide selectors.

### Component Folder Structure Conventions
- Place each reusable component in its own folder under `ClientApp/src/components/<ComponentName>/`.
- Co-locate the component, styles, story, and test files in that folder (for example `InfoCard.tsx`, `InfoCard.module.css`, `InfoCard.stories.tsx`, `InfoCard.test.tsx`).
- Add `index.ts` in each component folder and re-export from it.
- Maintain a root `ClientApp/src/components/index.ts` that re-exports each component and related public types.
- Prefer imports through the component barrel (`./components`) or folder barrel (`./components/<ComponentName>`) rather than direct deep file paths.

### Accessibility Baseline
- Touch targets: minimum `44x44px`.
- Contrast targets: WCAG AA (`4.5:1` normal text; `3:1` large text).
- Minimum body text size: `16px`.
- Slider supports keyboard input and clear value announcement.
- Do not communicate state by color alone; include text/icon cues.

## Backend / API Impact
- No direct backend API changes required for this style guide.
- Frontend copy and labels should align with API validation constraints (for example rating range `1-6`).

## Dependencies / Assumptions
- Existing frontend stack: React + TypeScript + Vite.
- CSS Modules is the established styling standard.
- Auth and product copy are Norwegian Bokmal (`nb-NO`).

## Open Questions
- Should error and success microcopy follow a strict phrase library in `nb-NO` now, or evolve during MVP and standardize in v2?

## Validation Plan
- Frontend: `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, `npm run build`
- Backend: `dotnet build`, `dotnet test`
- Integration: frontend build integrated into host, then `dotnet publish`

## ADR Needed?
- No
- Existing styling decision is already covered by `docs/adr/ADR-002-css-styling-standard.md`.
