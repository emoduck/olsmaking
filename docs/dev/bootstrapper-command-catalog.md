# Bootstrapper Command Catalog

Use this when asked what to work on next or when coordinating delegated work.

## Recon
- Read `docs/dev/` and list planned/incomplete features.
- Check `docs/adr/` for pending `Proposed` decisions that block work.
- Scan `.opencode/skills/` for relevant role guidance.

## Planning
- Select one feature on the critical path.
- Confirm feature document scope and open questions.
- Decide whether delegation threshold is met.

## Execution Pattern (Manager)
1. Delegate repo recon (if needed).
2. Delegate implementation/testing/infra tasks in parallel where independent.
3. Delegate review against checklist and docs gates.
4. Validate with project command matrix.

## Validation Matrix
- Frontend: `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, `npm run build`
- Backend: `dotnet build`, `dotnet test`
- Integration: frontend build integrated into host, then `dotnet publish`
- Infra: `az bicep build --file <path>`, `az deployment group what-if ...`
