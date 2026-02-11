# Skill: github-actions-cicd

## Purpose
Keep GitHub Actions workflows minimal, deterministic, and aligned with the React + .NET + Azure delivery model.

## Conventions
- Separate build/test from deploy jobs where possible.
- Cache dependencies intentionally (npm/NuGet) with stable keys.
- Fail fast on lint/typecheck/test/build failures.
- Keep secrets in GitHub/Azure secret stores only.
- Minimize permissions per workflow/job.

## Validation
- Confirm workflow YAML syntax and job dependency order.
- Validate command parity with local build/test commands.

## Output Requirements
- State which workflows changed and why.
- Include rollback-safe guidance for deploy-related edits.
