# ADR-001: Storybook publishing via GitHub Pages (future option)

## Status
Proposed

## Context
The project uses React + TypeScript in a `ClientApp` hosted inside a .NET BFF and deployed as a single unit to Azure App Service. Storybook is desired for view/simple component development and testing, but the project prioritizes low-cost operations and minimal hosting footprint.

## Decision
Keep Storybook local-only for now. Do not host Storybook in production or public infrastructure at this stage.

Document GitHub Pages publishing as a future option for component preview sharing if collaboration needs increase.

## Consequences

### Positive
- No additional hosting setup or operational overhead now.
- No extra cost surface beyond current app hosting.
- Keeps component workflow simple and local-first.

### Negative
- No always-available remote Storybook URL for asynchronous review.
- Less convenient for non-local stakeholders.

## Alternatives Considered
- Enable GitHub Pages deployment for Storybook now.
- Host Storybook in Azure (separate app/static host).

## Cost / Operational Impact
- Current decision: lowest cost and lowest complexity.
- Future GitHub Pages option: low cost but introduces workflow/publishing maintenance.

## Rollback / Exit Strategy
If local-only Storybook becomes a bottleneck, promote this ADR to `Accepted` with a follow-up implementation plan for GitHub Pages deployment workflow and access model.
