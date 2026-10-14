[CmdletBinding()]
param([switch]$OpenDisplay)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $ProjectRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 22.13 or newer is required.' }
$nodeMajor = [int]((node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 22) { throw 'Node.js 22.13 or newer is required.' }

if (-not (Test-Path '.env')) {
  Copy-Item '.env.example' '.env'
  $secretBytes = New-Object byte[] 48
  $randomNumberGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $randomNumberGenerator.GetBytes($secretBytes)
  } finally {
    $randomNumberGenerator.Dispose()
  }
  $secret = [Convert]::ToBase64String($secretBytes)
  (Get-Content '.env' -Raw).Replace('replace-with-a-long-random-value', $secret) | Set-Content '.env' -Encoding utf8
  Write-Host 'Created .env. Change ADMIN_PASSWORD before other people can access this PC.' -ForegroundColor Yellow
}

npm ci
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'The production build failed.' }
npm run db:migrate:windows
if ($LASTEXITCODE -ne 0) { throw 'The database migration failed.' }
& (Join-Path $PSScriptRoot 'Start-Board.ps1')
if ($OpenDisplay) { & (Join-Path $PSScriptRoot 'Start-Kiosk.ps1') }
