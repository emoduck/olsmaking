param name string
param location string
param appServicePlanId string

@secure()
param sqlConnectionString string

param auth0Domain string
param auth0ClientId string

@secure()
param auth0ClientSecret string

param auth0Audience string = ''

resource webApp 'Microsoft.Web/sites@2022-09-01' = {
  name: name
  location: location
  kind: 'app'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlanId
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: {
      alwaysOn: false
      ftpsState: 'Disabled'
      healthCheckPath: '/api/health'
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      appSettings: [
        {
          name: 'ASPNETCORE_ENVIRONMENT'
          value: 'Production'
        }
        {
          name: 'ASPNETCORE_FORWARDEDHEADERS_ENABLED'
          value: 'true'
        }
        {
          name: 'ConnectionStrings__DefaultConnection'
          value: sqlConnectionString
        }
        {
          name: 'Auth0__Domain'
          value: auth0Domain
        }
        {
          name: 'Auth0__ClientId'
          value: auth0ClientId
        }
        {
          name: 'Auth0__ClientSecret'
          value: auth0ClientSecret
        }
        {
          name: 'Auth0__Audience'
          value: auth0Audience
        }
      ]
    }
  }
}

output name string = webApp.name
output defaultHostName string = webApp.properties.defaultHostName
