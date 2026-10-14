[CmdletBinding()]
param(
  [string]$InstallPath
)

$ErrorActionPreference = 'Continue'
if (-not $InstallPath) {
  $candidate = Resolve-Path (Join-Path $PSScriptRoot '..\..') -ErrorAction SilentlyContinue
  if ((Test-Path (Join-Path $candidate '.env')) -or (Test-Path (Join-Path $candidate '.board-data'))) {
    $InstallPath = $candidate.Path
  } elseif (Test-Path 'C:\JaamiMasjidBoard') {
    $InstallPath = 'C:\JaamiMasjidBoard'
  } else {
    $InstallPath = $candidate.Path
  }
}
$ProjectRoot = (Resolve-Path -LiteralPath $InstallPath).Path
$runtime = Join-Path $ProjectRoot '.board-runtime'
Write-Host "Inspecting installation: $ProjectRoot" -ForegroundColor Cyan

Write-Host '==== JAAMI MASJID BOARD DIAGNOSTICS ====' -ForegroundColor Cyan
Write-Host ''

$task = Get-ScheduledTask -TaskName 'Jaami Masjid Display Service' -ErrorAction SilentlyContinue
if ($task) {
  $info = $task | Get-ScheduledTaskInfo
  Write-Host "Scheduled task : '$($task.TaskName)' state=$($task.State)"
  Write-Host "  last run     : $($info.LastRunTime)   result=0x$('{0:X}' -f $info.LastTaskResult)  ($($info.LastTaskResult))"
  Write-Host "  next run     : $($info.NextRunTime)"
  Write-Host "  action       : $($task.Actions.Execute) $($task.Actions.Arguments)"
  Write-Host "  working dir  : $($task.Actions.WorkingDirectory)"
} else {
  Write-Host 'Scheduled task  : NOT REGISTERED (the board has no auto-start task).' -ForegroundColor Yellow
}
Write-Host ''

try {
  $response = Invoke-WebRequest -UseBasicParsing 'http://localhost:3000/api/state' -TimeoutSec 5
  Write-Host "Local board    : ANSWERING (HTTP $($response.StatusCode))" -ForegroundColor Green
} catch {
  Write-Host 'Local board    : NOT ANSWERING on http://localhost:3000' -ForegroundColor Red
}
Write-Host ''

$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
  $owner = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
  Write-Host "Port 3000      : LISTENING (pid $($listener.OwningProcess) - $($owner.ProcessName))"
} else {
  Write-Host 'Port 3000      : nobody is listening' -ForegroundColor Yellow
}
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
  $nodeProcesses | ForEach-Object { Write-Host "node process   : pid $($_.Id) started $($_.StartTime)" }
} else {
  Write-Host 'node process   : none running' -ForegroundColor Yellow
}
Write-Host ''

foreach ($file in @('board.log', 'board-error.log')) {
  $path = Join-Path $runtime $file
  Write-Host "---- $file (last 25 lines) ----" -ForegroundColor Cyan
  if (Test-Path -LiteralPath $path) {
    Get-Content -LiteralPath $path -Tail 25
  } else {
    Write-Host '(no such file - the board has not logged yet)'
  }
  Write-Host ''
}
foreach ($file in @('board.log.old', 'board-error.log.old')) {
  $path = Join-Path $runtime $file
  if (Test-Path -LiteralPath $path) {
    Write-Host "---- $file (last 25 lines) ----" -ForegroundColor Cyan
    Get-Content -LiteralPath $path -Tail 25
    Write-Host ''
  }
}

Write-Host '---- Requirements ----' -ForegroundColor Cyan
Write-Host "dist build     : $(Test-Path (Join-Path $ProjectRoot 'dist\server\index.js'))"
Write-Host ".env           : $(Test-Path (Join-Path $ProjectRoot '.env'))"
Write-Host ".board-data    : $(Test-Path (Join-Path $ProjectRoot '.board-data'))"
$node = Get-Command node.exe -ErrorAction SilentlyContinue
if ($node) { Write-Host "node           : $(& $node.Source --version) at $($node.Source)" }
else { Write-Host 'node           : NOT FOUND on PATH' -ForegroundColor Red }
Write-Host ''

Write-Host '---- Network access ----' -ForegroundColor Cyan
$rules = Get-NetFirewallRule -DisplayName '*Jaami Masjid*' -ErrorAction SilentlyContinue
if ($rules) {
  foreach ($rule in $rules) {
    $ports = ($rule | Get-NetFirewallPortFilter).LocalPort -join ','
    Write-Host "Firewall rule  : '$($rule.DisplayName)' enabled=$($rule.Enabled) action=$($rule.Action) direction=$($rule.Direction)"
    Write-Host "  remote       : $($rule | Get-NetFirewallAddressFilter | Select-Object -ExpandProperty RemoteAddress)"
    Write-Host "  ports        : $ports"
  }
} else {
  Write-Host 'Firewall rule  : none found for "Jaami Masjid"' -ForegroundColor Yellow
}
$tailscale = Get-Command tailscale.exe -ErrorAction SilentlyContinue
if ($tailscale) {
  Write-Host 'Tailscale IPs  :'
  & $tailscale.Source ip -4 2>$null | ForEach-Object { Write-Host "  $_" }
  Write-Host '(the firewall rule must list 100.64.0.0/10 to allow Tailscale)'
} else {
  Write-Host 'Tailscale      : tailscale.exe not found on PATH'
}
Write-Host ''
Write-Host 'Diagnostics complete. Copy everything above and send it back.' -ForegroundColor Cyan
