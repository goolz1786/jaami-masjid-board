$ErrorActionPreference = 'Stop'
$root = Join-Path ([IO.Path]::GetTempPath()) ('board-start-test-' + [guid]::NewGuid().ToString('N'))
$scripts = Join-Path $root 'scripts\windows'
New-Item -ItemType Directory -Path $scripts -Force | Out-Null
try {
  $source = Get-Content -LiteralPath (Join-Path $PSScriptRoot '..\scripts\windows\Start-Board.ps1') -Raw
  $mocks = @'
function Invoke-WebRequest { param([switch]$UseBasicParsing, $Uri, $TimeoutSec) [pscustomobject]@{ StatusCode = 200 } }
function Get-ScheduledTask { param($TaskName, $ErrorAction) [pscustomobject]@{ TaskName = $TaskName; State = 'Ready' } }
function Start-ScheduledTask { param($TaskName, $ErrorAction) Set-Content -LiteralPath (Join-Path $PSScriptRoot '..\..\watchdog-started.txt') -Value $TaskName }
'@
  $script = Join-Path $scripts 'Start-Board.ps1'
  Set-Content -LiteralPath $script -Value ($mocks + "`r`n" + $source) -Encoding UTF8
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script
  if ($LASTEXITCODE -ne 0) { throw "Start helper failed with $LASTEXITCODE" }
  $marker = Join-Path $root 'watchdog-started.txt'
  if (-not (Test-Path -LiteralPath $marker)) { throw 'Already running board did not start the watchdog.' }
  if ((Get-Content -LiteralPath $marker -Raw).Trim() -ne 'Jaami Masjid Display Watchdog') { throw 'Wrong task was started.' }
  Write-Host 'Already running board starts watchdog: PASS'
} finally {
  if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
}
