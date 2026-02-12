[CmdletBinding()]
param(
    [Parameter()]
    [string]$ProjectPath = "src/Olsmaking.Bff/Olsmaking.Bff.csproj",

    [Parameter()]
    [string]$Auth0Domain = "<AUTH0_DOMAIN>",

    [Parameter()]
    [string]$Auth0ClientId = "<AUTH0_CLIENT_ID>",

    [Parameter()]
    [string]$Auth0ClientSecret = "<AUTH0_CLIENT_SECRET>",

    [Parameter()]
    [string]$Auth0Audience,

    [Parameter()]
    [switch]$IncludeAudiencePlaceholder
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-DotnetUserSecrets {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    & dotnet user-secrets @Arguments | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed: dotnet user-secrets $($Arguments -join ' ') (exit code: $LASTEXITCODE)"
    }
}

function Set-SecretValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Project,

        [Parameter(Mandatory = $true)]
        [string]$Key,

        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "Refusing to set empty value for '$Key'."
    }

    Invoke-DotnetUserSecrets -Arguments @("set", $Key, $Value, "--project", $Project)
    Write-Host "Set user secret key: $Key"
}

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw "The .NET SDK is required but 'dotnet' was not found on PATH."
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $scriptDir "..")).Path

if ([System.IO.Path]::IsPathRooted($ProjectPath)) {
    $projectCandidate = $ProjectPath
}
else {
    $projectCandidate = Join-Path $repoRoot $ProjectPath
}

if (-not (Test-Path -LiteralPath $projectCandidate)) {
    throw "Project file not found: $projectCandidate"
}

$resolvedProjectPath = (Resolve-Path -LiteralPath $projectCandidate).Path

Write-Host "Initializing user secrets for: $resolvedProjectPath"
Invoke-DotnetUserSecrets -Arguments @("init", "--project", $resolvedProjectPath)

Set-SecretValue -Project $resolvedProjectPath -Key "Auth0:Domain" -Value $Auth0Domain
Set-SecretValue -Project $resolvedProjectPath -Key "Auth0:ClientId" -Value $Auth0ClientId
Set-SecretValue -Project $resolvedProjectPath -Key "Auth0:ClientSecret" -Value $Auth0ClientSecret

$setAudience = $false
$audienceValue = $null

if ($PSBoundParameters.ContainsKey("Auth0Audience")) {
    $setAudience = $true
    $audienceValue = $Auth0Audience
}
elseif ($IncludeAudiencePlaceholder) {
    $setAudience = $true
    $audienceValue = "<AUTH0_AUDIENCE>"
}

if ($setAudience) {
    Set-SecretValue -Project $resolvedProjectPath -Key "Auth0:Audience" -Value $audienceValue
}
else {
    Write-Host "Skipped Auth0:Audience (not provided). Use -Auth0Audience or -IncludeAudiencePlaceholder to set it."
}

$placeholderWarnings = @()
foreach ($candidate in @($Auth0Domain, $Auth0ClientId, $Auth0ClientSecret, $audienceValue)) {
    if ($candidate -and $candidate -match '^<AUTH0_.*>$') {
        $placeholderWarnings += $candidate
    }
}

if ($placeholderWarnings.Count -gt 0) {
    Write-Warning "Placeholder values were written. Replace them with real values before auth-dependent testing."
}

Write-Host "Done."
Write-Host "Review current user-secrets with:"
Write-Host "dotnet user-secrets list --project `"$resolvedProjectPath`""
