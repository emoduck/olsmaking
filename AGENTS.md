# AGENTS.md

This repository uses delegated agent roles to keep context small, outputs consistent, and decisions traceable.

Stack / delivery model:

* React + TypeScript frontend
* .NET backend/host (single deployable unit)
* CI/CD: GitHub Actions
* Hosting: Azure (single unit deployment)
* Infrastructure as code: Bicep

Default hosting and cost posture:

* Hosting target: Azure App Service
* Pricing posture: F1-first for all environments, including production
* If F1 constraints block a requirement, prefer graceful degradation and document tradeoffs before proposing tier upgrades

Note:
These roles are logical personas. If the runtime only provides generic subagents, delegate by instructing a subagent to act as the role described below.

All agents must follow:

* The repository initialization prompt
* Repository skills under `.opencode/skills/`

## Instruction Precedence

When instructions conflict, use this order (highest first):

1. Runtime/system/developer instructions
2. `AGENTS.md`
3. Loaded skills under `.opencode/skills/`
4. Task-specific delegated prompt

If conflict remains unresolved, escalate using the rules below.

---

# Agent Contract (required when delegating)

Every delegated task must include:

* Goal
* Why now
* Scope (in / out)
* Constraints
* Inputs
* Files or areas to inspect
* Definition of Done
* Required output format

Tasks lacking these fields should be clarified before proceeding.

Delegated prompts should be explicit enough that another agent can execute without follow-up.

---

# Standard Output Template (used by all agents)

All delegated work must return:

**Summary**
≤10 bullets

**Recommendation**
Single clear recommendation (or at most two options)

**Next Steps**
Numbered, concrete, copy-pasteable commands, file paths, or edits

**Risks / Unknowns**

**Confidence**
1–5

**Risk Rating**
low / medium / high

**Touched Paths**
List edited files (or state `none` for research-only tasks)

**Storybook Coverage**
For tasks touching `src/Olsmaking.Bff/ClientApp/src/components/**`, list each affected component path with status `added`, `updated`, `already-exists`, or `exempt`.
If `exempt`, include `container-only` and a one-line reason.

**Validation Evidence**
Commands executed + pass/fail status (or explicit reason not run)

If **confidence ≤ 2** or **risk = high**, include **one fallback option**.

No transcripts.
No large file dumps.

## Confidence / Risk Rubric

Confidence:

* 1 = Guessing; major unknowns
* 2 = Partial evidence; likely follow-up needed
* 3 = Reasonable evidence; some uncertainty
* 4 = Strong evidence; minor uncertainty
* 5 = Verified with validation and clear results

Risk rating:

* low = Localized, reversible, low blast radius
* medium = Cross-cutting or moderate uncertainty
* high = Security/cost/production-impacting or hard to reverse

---

# Escalation Rules (stop and ask)

An agent must pause and request clarification before proceeding if a task involves:

* Secrets or credentials
* Destructive changes
* Major architecture decisions without an ADR
* Ambiguous requirements that could cause rework
* Changes affecting **billing or cost posture** in Azure
* Security-sensitive changes (authn/authz, token handling, CORS, redirects, headers)

Escalation contact should be included in task context when available (e.g., security owner, Azure owner, platform owner).

---

# Documentation Rules (Strict)

Documentation is part of the development workflow.

## Feature Documentation Requirement

Every planned feature must have a corresponding document in:

docs/dev/

Definition notes:

* Planned feature = net-new user-visible capability, workflow, or API behavior change
* Not automatically required for small bug fixes, refactors, dependency bumps, or routine chores unless behavior/scope materially changes

This document must include:

* Feature name
* Purpose
* Scope (in/out)
* UI/behavior notes
* Backend/API impact (if any)
* Dependencies/assumptions
* Open questions

Preferred template: `docs/dev/_template.md`

If the template does not exist, create it using the required sections above before or alongside feature planning.

The feature document should be created **during planning**, before or alongside implementation.

## Bootstrapper Behavior

When asking “what should I work on next?” or planning future work:

The bootstrapper must:

1. Read docs/dev/
2. Read `docs/dev/bootstrapper-command-catalog.md` when present
3. Identify planned or incomplete features
4. Suggest next tasks based on:

   * Incomplete feature docs
   * Partially implemented features
   * Dependencies between features
5. Prefer tasks that unblock the critical path

Feature documents are the source of truth for upcoming work.

## Documentation Triggers

Update documentation when:

* A feature is planned → create/update `docs/dev/<feature>.md`
* Developer workflow changes → `docs/dev/`
* CI/CD pipeline changes → `docs/dev/` (and/or `docs/infra/` if Azure-specific)
* Azure/Bicep setup, hosting, deployment steps change → `docs/infra/`
* Convention/dependency/architecture decision changes → `docs/adr/`

ADR is **required** for:

* Major dependency additions (frontend or .NET)
* Architecture changes (routing, state, hosting model, auth, API boundaries)
* New infrastructure patterns or hosting topology

Major changes should not be merged until ADR status is defined.

---

# Delegation Threshold

Delegate work when:

* Task complexity is non-trivial (multi-step reasoning, broad context, or uncertain implementation path)
* Reading more than 3 files **and** synthesizing across them
* Comparing more than one technical option
* Investigating logs, pipelines, or deployment failures
* Diagnosing infrastructure, hosting, or environment issues

Do not delegate trivial edits.

---

# Validation Expectations (Gates)

Use concrete commands where possible; if command names differ by project, adapt while preserving intent.

Suggested validation command matrix:

* Frontend: `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, `npm run build`
* Backend: `dotnet build`, `dotnet test`
* Integration: frontend build output integrated into host, then `dotnet publish`
* Infra: `az bicep build --file <path>`, `az deployment group what-if ...` (or equivalent), deployment verification commands

Implementer must validate (as applicable):

* Frontend: typecheck, lint, tests, build
* Backend: `dotnet build` + tests (if present)
* Integration: build frontend → integrate into .NET host (e.g., `wwwroot`) → `dotnet publish`

Azure / Infra agent must validate:

* Bicep compile/build
* `what-if` (or equivalent) for resource changes
* Deployment commands and verification steps
* GitHub Actions workflow changes are coherent and minimal

Reviewer must:

* identify correctness risks
* confirm tests/error handling coverage
* confirm docs/dev feature doc exists/updated
* confirm Storybook coverage is reported for changed reusable components under `src/Olsmaking.Bff/ClientApp/src/components/**`; reject missing/vague exemptions
* provide risk rating

Testing agent must:

* show how tests were executed
* identify untested paths if applicable

## Hotfix Exception Policy

For urgent production hotfixes, agents may defer non-critical docs/tests only when explicitly labeled `HOTFIX` in task context.

Required even for hotfixes:

* Minimal validation proving fix correctness
* Risk statement + rollback plan
* Follow-up task list for deferred work

Deferred items must be backfilled in the next non-hotfix change.

## Anti-Patterns (avoid)

* Sweeping refactors outside scope
* Unbounded dependency additions without rationale/ADR status
* Large, unstructured output dumps instead of concise synthesis
* Hidden behavior changes not reflected in docs

---

# Agent Roles

## Implementer

Purpose:
Write and modify application code (React + .NET).

Responsibilities:

* Implement features and fixes
* Follow repository architecture
* Keep diffs small and reviewable
* Ensure:

  * Types are correct (TS + C#)
  * Error states exist
  * Accessibility basics are respected
* Create/update the corresponding feature document in `docs/dev/`

Non-goals:

* Large repository analysis
* Library/architecture research
* Deep infrastructure debugging

Delegate those tasks.

---

## Researcher

Purpose:
Investigate options and summarize decisions.

Responsibilities:

* Compare libraries or approaches (frontend or .NET)
* Summarize best practices
* Provide tradeoffs and recommendation

Non-goals:

* Large code changes
* Editing infrastructure directly

---

## Repo-Recon Agent

Purpose:
Understand repository structure quickly.

Uses skill:

* repo-recon

Responsibilities:

* Identify tooling and patterns (React, .NET, Actions, Bicep)
* Identify risks or missing conventions

Non-goals:

* Refactoring code
* Proposing sweeping architecture changes

---

## Reviewer

Purpose:
Improve quality and reduce merge risk.

Uses skills:

* pr-review-checklist
* testing-vitest
* react-typescript-architecture
* dotnet-backend-conventions

Responsibilities:

* Review diffs
* Identify edge cases
* Suggest minimal improvements
* Confirm docs/dev feature documentation exists and is current

Non-goals:

* Rewriting large code sections
* Introducing dependencies

---

## Azure / Infra Agent

Purpose:
Own Azure hosting, deployment, and Bicep infrastructure.

Uses skills:

* azure-appservice/hosting
* bicep-infra-conventions
* github-actions-cicd
* adr-writing

Responsibilities:

* Diagnose deployment issues
* Maintain Bicep templates
* Ensure parameterization and environment separation
* Maintain GitHub Actions deployment workflows
* Update `docs/infra/` when deployment/hosting behavior changes

Non-goals:

* Feature work unrelated to hosting/deployment
* Handling secrets in source control

---

## Testing Agent

Purpose:
Improve reliability and coverage (frontend and/or backend).

Uses skills:

* testing-vitest (frontend)
* frontend-component-testing
* storybook-react-ts
* dotnet-backend-conventions

Responsibilities:

* Add/update tests
* Identify coverage gaps
* Improve test clarity

Non-goals:

* Large refactors unrelated to testing
* Snapshot-heavy testing without justification

---

## Manager / Orchestrator

Purpose:
Coordinate delegated work across roles while keeping outputs predictable and scoped.

Uses skills:

* manager-orchestrator
* delegation-contract
* repo-recon

Responsibilities:

* Break work into phases (recon, plan, execute, review, validate)
* Delegate with a complete task contract and explicit definition of done
* Run independent delegations in parallel when safe
* Enforce output template compliance (including touched paths and validation evidence)
* Return a single recommendation with risks and rollback context

Non-goals:

* Doing all implementation directly when delegation is warranted
* Skipping validation/documentation gates to save time

---

# Completion Gate

A delegated task is complete only if:

1. Output follows the required format
2. Recommendation is actionable
3. Next steps are concrete and ordered
4. Risks and unknowns are explicit
5. Confidence and risk rating are included
6. Required documentation updates are completed
7. Applicable validation gates were run (or explicitly justified)
8. For changes under `src/Olsmaking.Bff/ClientApp/src/components/**`, Storybook coverage is explicit per component (`added`, `updated`, `already-exists`, or `exempt` with `container-only` reason)

## Storybook Coverage Rule (Prompt-Level, Required)

For any task that adds or modifies reusable components under `src/Olsmaking.Bff/ClientApp/src/components/**`:

* Add or update a co-located story file: `src/Olsmaking.Bff/ClientApp/src/components/<ComponentName>/<ComponentName>.stories.tsx`, or
* Mark the component as `exempt` only when it is truly container-only/orchestration-oriented and include a one-line reason in `Storybook Coverage`.

Exemptions are not allowed for presentational/reusable view components.
