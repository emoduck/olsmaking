# Prod Infra Implementation Plan

## Goal
Prepare Azure infrastructure and deployment automation for a single `prod` environment, to be activated after application v1 is considered ready.

## Current Decision
- Infra rollout is intentionally deferred until v1 product scope is stable.
- No Azure provisioning or deployment runs should be executed during active v1 feature iteration.
- Keep infrastructure code and workflows in place so activation later is low-friction.

## Post-v1 Activation Plan

### Activation trigger
- Product owner confirms v1 feature set is complete enough for hosted validation.

### Activation checklist (future)
1. Confirm GitHub Environment `prod` secrets and vars are complete and current.
2. Run local dry checks:
   - `az bicep build --file infra/main.bicep`
   - `az bicep build-params --file infra/params/prod.bicepparam`
   - `dotnet publish src/Olsmaking.Bff/Olsmaking.Bff.csproj --configuration Release`
3. Run hosted `infra-provision` workflow with `apply_changes=false` (what-if only).
4. Review `what-if` output and resolve any naming/permission/policy issues.
5. Run hosted `infra-provision` workflow with `apply_changes=true`.
6. Keep `INFRA_READY=false` until infra validation is complete.
7. Set `INFRA_READY=true` and run `deploy-appservice` manually.
8. Validate `/api/health`, Auth0 login flow, and one DB-backed endpoint.
9. If issues occur, set `INFRA_READY=false` and execute rollback steps.

### Deferred-until-activation items
- No manual Azure CLI deploy commands.
- No workflow runs that apply infrastructure.
- No app deployments to Azure.

## Scope

### In Scope
- Bicep templates and one prod parameter file.
- GitHub Actions workflow updates for infra provisioning and app deployment.
- Safe rollout and rollback steps for a single private environment.

### Out of Scope
- Multi-environment promotion (`dev`/`test`).
- App feature changes unrelated to deployment/infrastructure.
- Cost-tier upgrades unless F1 constraints block required behavior.

## Execution Checklist

### 1) Create Infrastructure Files
Create the following files:

- `infra/main.bicep`
- `infra/modules/appservice-plan.bicep`
- `infra/modules/webapp.bicep`
- `infra/modules/sql.bicep`
- `infra/params/prod.bicepparam`

### 2) Implement Bicep Resource Graph
Define these resources in Bicep:

- App Service Plan (`Microsoft.Web/serverfarms`)
  - SKU: `F1`
  - Tier: `Free`
  - OS: Windows
- App Service Web App (`Microsoft.Web/sites`)
  - HTTPS only enabled
  - Minimum TLS 1.2
  - Health check path: `/api/health`
  - System-assigned managed identity
- Azure SQL logical server (`Microsoft.Sql/servers`)
- Azure SQL database (`Microsoft.Sql/servers/databases`)
  - Lowest practical SKU for private MVP
- SQL firewall rule (`Microsoft.Sql/servers/firewallRules`)
  - Allow Azure services (`0.0.0.0` -> `0.0.0.0`)

Add outputs from `infra/main.bicep`:

- `webAppName`
- `defaultHostName`
- `sqlServerName`
- `sqlDatabaseName`

### 3) Define Prod Parameters (Non-Secret Only)
Populate `infra/params/prod.bicepparam` with non-secret values:

- `environmentName = 'prod'`
- `location`
- `resourceGroupName`
- `appServicePlanName`
- `webAppName`
- `sqlServerName`
- `sqlDatabaseName`

Do not commit passwords, connection strings, or Auth0 secrets.

### 4) Configure GitHub Environment + Secrets
Create one GitHub Environment named `prod` and set:

Secrets:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `SQL_ADMIN_PASSWORD` (if SQL auth is used in infra provisioning)
- `SQL_CONNECTION_STRING`
- `AUTH0_DOMAIN`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`
- `AUTH0_AUDIENCE` (optional)

Vars:

- `INFRA_READY` (start as `false`)
- `AZURE_LOCATION`
- `RESOURCE_GROUP_NAME`
- `WEBAPP_NAME`
- `SQL_SERVER_NAME`
- `SQL_DATABASE_NAME`

### 5) Add Infra Provision Workflow
Add `/.github/workflows/infra-provision.yml`:

- Trigger: `workflow_dispatch`.
- Steps:
  - Checkout
  - Azure login via OIDC (`azure/login`)
  - `az bicep build --file infra/main.bicep`
  - `az deployment group what-if ...`
  - `az deployment group create ...`
- Use GitHub Environment `prod` for secrets/vars.

### 6) Update App Deploy Workflow
Update `/.github/workflows/deploy-appservice.yml`:

- Keep existing `INFRA_READY` gate semantics.
- Replace placeholder deploy job with real jobs that:
  - Build and publish BFF artifact
  - Run EF Core migration against `SQL_CONNECTION_STRING`
  - Apply app settings to App Service:
    - `ASPNETCORE_ENVIRONMENT=Production`
    - `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true`
    - `ConnectionStrings__DefaultConnection`
    - `Auth0__Domain`
    - `Auth0__ClientId`
    - `Auth0__ClientSecret`
    - `Auth0__Audience`
  - Deploy package to App Service
  - Run smoke test on `/api/health`

### 7) Validate Before Enabling Deploy Gate
Run and verify locally (or in CI where applicable):

```bash
az bicep build --file infra/main.bicep
az deployment group what-if --resource-group <rg> --template-file infra/main.bicep --parameters infra/params/prod.bicepparam
dotnet publish src/Olsmaking.Bff/Olsmaking.Bff.csproj --configuration Release
```

### 8) Safe Rollout Steps
1. Keep `INFRA_READY=false` while merging infra/workflow changes.
2. Run `infra-provision` manually and review `what-if` output.
3. Verify provisioned resources and baseline app host status.
4. Set `INFRA_READY=true` in GitHub Environment vars.
5. Run `deploy-appservice` manually.
6. Verify:
   - `https://<webapp>.azurewebsites.net/api/health`
   - Auth login redirect flow
   - At least one DB-backed API endpoint

### 9) Rollback Plan
- App rollback: redeploy previous known-good commit/artifact.
- Infra rollback: deploy previous Bicep revision if safe and compatible.
- Data rollback: restore Azure SQL to point-in-time backup, then cut app back.
- Emergency stop: set `INFRA_READY=false` to block further deploy runs.

## Acceptance Criteria
- Bicep compiles and `what-if` output is clean/expected.
- `prod` infra workflow can provision/update resources idempotently.
- App deploy workflow performs build, migration, deploy, and smoke test.
- No secrets are committed to repo.
- `docs/infra` reflects rollout and rollback behavior.
