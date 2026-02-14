using '../main.bicep'

param environmentName = 'prod'
param location = 'westeurope'
param appServicePlanName = 'olsmaking-prod-plan'
param webAppName = 'olsmaking-prod-app'
param sqlServerName = 'olsmaking-prod-sql'
param sqlDatabaseName = 'olsmaking'
param sqlAdministratorLogin = 'olsmakingadmin'
param sqlAdministratorLoginPassword = 'REPLACE_IN_GITHUB_SECRET'
param sqlConnectionString = 'REPLACE_IN_GITHUB_SECRET'
param auth0Domain = 'REPLACE_IN_GITHUB_SECRET'
param auth0ClientId = 'REPLACE_IN_GITHUB_SECRET'
param auth0ClientSecret = 'REPLACE_IN_GITHUB_SECRET'
param auth0Audience = ''

// Replace placeholder values at deploy time via secure pipeline inputs.
