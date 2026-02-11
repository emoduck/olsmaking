# Playbook: Incident Hotfix

## When to Use
Urgent production fix with time-sensitive impact.

## Steps
1. Label context as `HOTFIX`.
2. Contain scope to minimal safe change.
3. Run minimal validation proving fix correctness.
4. Capture risk statement and rollback plan.
5. List deferred docs/tests and create follow-up tasks.

## Guardrails
- Do not bypass security/cost/destructive change escalation.
- Do not expand into unrelated refactors.
