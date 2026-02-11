# Skill: bicep-infra-conventions

## Purpose
Guide Bicep changes for predictable, environment-safe Azure provisioning.

## Conventions
- Parameterize environment-specific values.
- Use clear module boundaries and outputs.
- Keep naming deterministic and policy-compliant.
- Avoid embedding secrets in templates or params files committed to source.

## Validation
- `az bicep build --file <path>`
- `az deployment group what-if ...` (or equivalent scope)

## Review Checklist
- Resource changes are least-privilege and cost-aware.
- Changes are documented under `docs/infra/` when behavior/topology changes.
