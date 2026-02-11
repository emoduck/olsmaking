# Skill: azure-appservice/hosting

## Purpose
Operate Azure hosting for a single deployable web-app unit (React frontend + .NET host).

## Hosting Model Assumptions
- Frontend artifacts are served by the .NET host (single unit deployment).
- Azure target is App Service (or equivalent single-app host).
- Infrastructure is managed through Bicep.
- Pricing posture is F1-first for all environments, including production.

## Conventions
- Keep environment settings in Azure configuration, not source.
- Preserve deployment slot/rollout safety where available.
- Ensure health checks and startup behavior are explicit.
- Keep deployment workflows coherent with Bicep changes.
- Prefer graceful degradation over tier upgrades when F1 limits are hit.

## Validation
- Build frontend and host, then `dotnet publish`.
- Run infra validation: `az bicep build --file <path>` and `what-if`.
- Verify deployment command path and post-deploy checks.

## Output Requirements
- Include rollback plan for hosting changes.
- Call out any billing/cost posture impact.
