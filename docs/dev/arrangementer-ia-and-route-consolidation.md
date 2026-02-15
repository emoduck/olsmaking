# Arrangementer IA and Route Consolidation

## Purpose
Clarify information architecture by making `Oversikt` a dashboard and consolidating event browsing and workspace navigation under `Arrangementer`.

## Scope

### In Scope
- Rename primary event route from `/arrangement` to `/arrangementer`.
- Use `/arrangementer/<eventId>` as the single-event workspace route.
- Keep `Oversikt` as dashboard-only content.
- Reuse one shared event-list UI component in both dashboard and arrangementer list page.
- Remove disabled `Smakinger` tab from primary navigation.

### Out of Scope
- Backend API changes.
- New event sharing flows.
- New domain concepts beyond existing event/workspace model.

## UI / Behavior Notes
- `Oversikt` shows dashboard summary and embedded event list.
- `Arrangementer` shows full event list plus create/join forms.
- `Arrangementer/<eventId>` shows only the selected workspace and a back button to `/arrangementer`.
- Legacy query route `/oversikt?eventId=<id>` is ignored and renders plain `/oversikt`.

## Backend / API Impact
- No endpoint changes.
- Existing SPA fallback in BFF continues to support deep links.

## Dependencies / Assumptions
- Existing route-state handling in `App.tsx` remains custom (no router dependency added).
- Existing workspace hydration endpoints remain stable.

## Open Questions
- Should dashboard include additional aggregated metrics beyond event and favorite counts?
- Should event list filters be shared state between dashboard and arrangementer page in a future iteration?
