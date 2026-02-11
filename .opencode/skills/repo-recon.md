# Skill: repo-recon

## Purpose
Quickly map repository structure, conventions, and execution paths with minimal churn.

## Inputs
- Task goal
- Relevant root folders and config files

## Procedure
1. Identify top-level projects (frontend, backend/host, infra, CI).
2. Locate entry points (`package.json`, `.sln`/`.csproj`, workflow YAML, Bicep files).
3. Capture build/test/deploy commands and expected artifacts.
4. Note convention risks (missing docs, unclear ownership, inconsistent naming).

## Output Requirements
- Keep findings concise and actionable.
- Include touched paths as `none` for research-only runs.
- Include confidence and risk rating with brief rationale.
