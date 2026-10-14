[CmdletBinding()]
param([switch]$OpenDisplay)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $ProjectRoot
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker Desktop is not installed.' }
docker info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop is not running. Use Setup-Board.ps1 for the native Windows installation.' }
if (-not (Test-Path '.env')) { Copy-Item '.env.example' '.env' }
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { throw 'The Docker board could not be started.' }
if ($OpenDisplay) { & (Join-Path $PSScriptRoot 'Start-Kiosk.ps1') }
