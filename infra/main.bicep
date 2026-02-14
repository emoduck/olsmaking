targetScope = 'resourceGroup'

@allowed([
  'prod'
])
param environmentName string = 'prod'

param location string = resourceGroup().location
param appServicePlanName string
param webAppName string
param sqlServerName string
param sqlDatabaseName string
param sqlAdministratorLogin string

@secure()
param sqlAdministratorLoginPassword string

@secure()
param sqlConnectionString string

param auth0Domain string
param auth0ClientId string

@secure()
param auth0ClientSecret string

param auth0Audience string = ''

module appServicePlan 'modules/appservice-plan.bicep' = {
  name: '${environmentName}-appservice-plan'
  params: {
    name: appServicePlanName
    location: location
  }
}

module sql 'modules/sql.bicep' = {
  name: '${environmentName}-sql'
  params: {
    serverName: sqlServerName
    databaseName: sqlDatabaseName
    location: location
    administratorLogin: sqlAdministratorLogin
    administratorLoginPassword: sqlAdministratorLoginPassword
  }
}

module webApp 'modules/webapp.bicep' = {
  name: '${environmentName}-webapp'
  params: {
    name: webAppName
    location: location
    appServicePlanId: appServicePlan.outputs.id
    sqlConnectionString: sqlConnectionString
    auth0Domain: auth0Domain
    auth0ClientId: auth0ClientId
    auth0ClientSecret: auth0ClientSecret
    auth0Audience: auth0Audience
  }
}

output webAppName string = webApp.outputs.name
output defaultHostName string = webApp.outputs.defaultHostName
output sqlServerName string = sql.outputs.serverName
output sqlDatabaseName string = sql.outputs.databaseName
