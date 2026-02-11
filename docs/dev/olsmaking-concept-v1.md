# Olsmaking Concept v1

## Purpose
Capture the product concept and scope baseline for Olsmaking so implementation stays aligned with user value and MVP constraints.

## Scope

### In Scope
- Product concept for event-based collaborative beer tasting.
- Core personas, value proposition, and high-level workflow.
- MVP boundaries and success criteria.

### Out of Scope
- Detailed technical architecture (covered by ADRs and feature docs).
- Long-term roadmap beyond MVP.

## UI / Behavior Notes

### Product Summary
Olsmaking is a mobile-first beer tasting web app where users create or join tasting events, add beers to the event, and record their own ratings and notes while seeing group tasting history.

### Primary Users
- Event owner: creates and manages a tasting event.
- Participant: joins an event, adds beers, and submits reviews.
- Admin: global administrative oversight.

### Core Value Proposition
- Keep event setup simple.
- Make in-event tasting logging fast on mobile.
- Keep review history structured and easy to compare.

### Core Workflow
1. Sign up/log in via Auth0.
2. Create event or join via event code/link.
3. Add beers in the event.
4. Rate beers on a `1-6` scale and write optional notes.
5. Revisit and update own reviews during event lifecycle.

### Product Principles
- Mobile-first and task-oriented.
- Minimal and professional interface.
- Clear ownership and access boundaries per event.
- Fast interactions over visual ornamentation.

## Backend / API Impact
- Requires authenticated user context for all event actions.
- Requires event-scoped entities and authorization checks.
- Requires persistence of users/events/participants/beers/reviews.

## Dependencies / Assumptions
- Auth0 is used for identity and login.
- BFF host enforces authorization and serves frontend.
- Azure SQL is used in hosted environments; LocalDB in local development.
- UI language is Norwegian Bokmal (`nb-NO`).

## Open Questions
- Which admin-only controls should be exposed in MVP UI versus backend-only operations?
- Should open-event discovery be enabled at launch or introduced incrementally?

## Validation Plan
- Product validation: confirm core flow can be completed on mobile in under 2 minutes for first-time user.
- Technical validation: follow standard frontend/backend/integration validation matrix.

## ADR Needed?
- No
- Concept summary only; implementation decisions are tracked in existing ADRs.
