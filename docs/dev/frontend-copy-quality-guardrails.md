# Frontend Copy Quality Guardrails

## Purpose
Prevent regressions where Norwegian user-facing copy is transliterated (for example, replacing `\u00e5`/`\u00f8` with plain ASCII) by adding an automated frontend check in local workflows and CI.

## Scope

### In Scope
- Add a lightweight copy quality script in `src/Olsmaking.Bff/ClientApp/scripts/check-copy.mjs`.
- Support a focused allowlist in `src/Olsmaking.Bff/ClientApp/scripts/check-copy.allowlist.json` for intentional exceptions.
- Scan frontend source files that are likely to contain UI copy.
- Block common transliteration mistakes (`for a`, `pa`, `Apne`, `Apen`, `Olsmaking`, `ma`, `vare`, `enna`, `na`, `forst`, `ol`).
- Add npm script wiring and CI step so regressions are caught before merge.
- Ensure repository-level UTF-8 editor guidance exists via `.editorconfig`.

### Out of Scope
- Full i18n framework migration.
- Backend localization changes.
- Grammar/style linting beyond the explicit blocked transliteration patterns.

## UI / Behavior Notes
- No runtime UI behavior changes.
- Developers run `npm run check:copy --prefix src/Olsmaking.Bff/ClientApp` locally.
- CI now fails if blocked transliteration patterns are found in scanned frontend copy.
- Check output includes file path and line number to speed up fixes.

### Allowlist Usage
- Keep allowlist entries minimal and explicit to avoid masking real regressions.
- Entry format:

```json
[
  {
    "path": "src/some-file.tsx",
    "ruleId": "ol",
    "text": "Example text to ignore for this rule",
    "reason": "Technical identifier, not user-facing text",
    "expiresOn": "2026-03-31"
  }
]
```

- `path` is relative to `src/Olsmaking.Bff/ClientApp`.
- `ruleId` must match the checker rule id.
- `text` must match the full string segment where the issue appears.
- `reason` is required so each exception is traceable.
- `expiresOn` is required (`YYYY-MM-DD`); expired entries fail the check.

## Backend / API Impact
- None.

## Dependencies / Assumptions
- Node.js runtime is available where frontend checks execute.
- Frontend user-facing copy remains primarily in `ClientApp/src` string literals or JSX text.
- Test/story files are excluded to reduce false positives for fixture data.
- Allowlist should remain small; if many entries are needed, refine the detection rule instead.

## Open Questions
- Should the checker eventually scan selected markdown-based user help content in addition to frontend source?

## Validation Plan
- Frontend: `npm run check:copy --prefix src/Olsmaking.Bff/ClientApp`
- CI workflow: verify `Frontend copy quality check` step runs in `.github/workflows/ci.yml`

## ADR Needed?
- No
- If yes, target path: `docs/adr/<adr-name>.md`
