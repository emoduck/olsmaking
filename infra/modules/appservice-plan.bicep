param name string
param location string

@allowed([
  'F1'
])
param skuName string = 'F1'

resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: name
  location: location
  kind: 'app'
  sku: {
    name: skuName
    tier: 'Free'
    size: skuName
    capacity: 1
  }
  properties: {
    reserved: false
  }
}

output id string = appServicePlan.id
output name string = appServicePlan.name
