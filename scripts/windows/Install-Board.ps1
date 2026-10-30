[CmdletBinding()]
param([switch]$SkipPrerequisiteInstall)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$serviceTaskName = 'Jaami Masjid Display Service'
$firewallRuleName = 'Jaami Masjid Display Board (TCP 3000)'

function Test-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Administrator)) {
  Write-Host 'Windows will ask for administrator permission once.' -ForegroundColor Yellow
  $arguments = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', "`"$PSCommandPath`""
  )
  if ($SkipPrerequisiteInstall) { $arguments += '-SkipPrerequisiteInstall' }
  $elevated = Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $arguments -Wait -PassThru
  exit $elevated.ExitCode
}

function Update-ProcessPath {
  $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machinePath;$userPath"
}

function Test-CompatibleNode {
  $node = Get-Command 'node.exe' -ErrorAction SilentlyContinue
  if (-not $node) { return $false }
  try {
    $version = [version]((& $node.Source --version).TrimStart('v'))
    return $version -ge [version]'22.13.0'
  } catch {
    return $false
  }
}

function Test-WorkerdRuntime {
  $workerdPath = Join-Path $projectRoot 'node_modules\@cloudflare\workerd-windows-64\bin\workerd.exe'
  if (-not (Test-Path -LiteralPath $workerdPath)) { return $false }
  try {
    & $workerdPath --version *> $null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  }
}

function Install-WingetPackage([string]$Id, [string]$Label) {
  $winget = Get-Command 'winget.exe' -ErrorAction SilentlyContinue
  if (-not $winget) {
    throw "$Label is required and Windows Package Manager (winget) is unavailable. Install $Label, then run this installer again."
  }
  Write-Host "Installing $Label..." -ForegroundColor Cyan
  & $winget.Source install --id $Id --exact --silent --accept-package-agreements --accept-source-agreements
  $installExitCode = $LASTEXITCODE
  if ($installExitCode -ne 0) {
    & $winget.Source list --id $Id --exact --accept-source-agreements | Out-Null
    if ($LASTEXITCODE -eq 0) {
      Write-Host "$Label is already installed; continuing." -ForegroundColor Green
    } else {
      throw "$Label installation failed with exit code $installExitCode."
    }
  }
  Update-ProcessPath
}

function Wait-ForBoard([int]$Seconds = 120) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  do {
    try {
      if ((Invoke-WebRequest -UseBasicParsing 'http://localhost:3000/api/state' -TimeoutSec 5).StatusCode -eq 200) {
        return $true
      }
    } catch { }
    Start-Sleep -Seconds 2
  } until ((Get-Date) -ge $deadline)
  return $false
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $projectRoot
. (Join-Path $PSScriptRoot 'Protect-BoardInstallation.ps1')
Assert-BoardInstallPath -Path $projectRoot
Stop-ScheduledTask -TaskName $serviceTaskName -ErrorAction SilentlyContinue
Protect-BoardInstallation -Path $projectRoot
Write-Host "Installing Jaami Masjid Display Board from $projectRoot" -ForegroundColor Cyan

Update-ProcessPath
if (-not (Test-CompatibleNode)) {
  if ($SkipPrerequisiteInstall) { throw 'Node.js 22.13 or newer is required.' }
  Install-WingetPackage 'OpenJS.NodeJS.LTS' 'Node.js LTS'
}
if (-not (Test-CompatibleNode)) { throw 'Node.js 22.13 or newer was not found after installation.' }
if (-not $SkipPrerequisiteInstall) {
  Install-WingetPackage 'Microsoft.VCRedist.2015+.x64' 'Microsoft Visual C++ Runtime (x64)'
}

$envPath = Join-Path $projectRoot '.env'
if (Test-Path -LiteralPath $envPath) {
  Write-Host 'Existing .env credentials were preserved.' -ForegroundColor Green
}
& (Join-Path $PSScriptRoot 'Initialize-BoardConfig.ps1') -ProjectRoot $projectRoot

Stop-ScheduledTask -TaskName $serviceTaskName -ErrorAction SilentlyContinue
& (Join-Path $PSScriptRoot 'Stop-Board.ps1')

Write-Host 'Installing application dependencies...' -ForegroundColor Cyan
& npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
if (-not (Test-WorkerdRuntime)) {
  throw 'The Cloudflare Windows runtime could not start. Install or repair Microsoft Visual C++ 2015-2022 Redistributable (x64), restart Windows, and run this installer again.'
}
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'The production build failed.' }

$migrationComplete = $false
$previousCI = $env:CI
$previousMetrics = $env:WRANGLER_SEND_METRICS
$env:CI = 'true'
$env:WRANGLER_SEND_METRICS = 'false'
try {
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    Write-Host "Preparing the local database (attempt $attempt of 3)..." -ForegroundColor Cyan
    & npm.cmd run db:migrate:windows
    if ($LASTEXITCODE -eq 0) {
      $migrationComplete = $true
      break
    }
    if ($attempt -lt 3) {
      Write-Host 'The local database process stopped unexpectedly. Retrying in five seconds...' -ForegroundColor Yellow
      Start-Sleep -Seconds 5
    }
  }
} finally {
  if ($null -eq $previousCI) { Remove-Item Env:CI -ErrorAction SilentlyContinue } else { $env:CI = $previousCI }
  if ($null -eq $previousMetrics) { Remove-Item Env:WRANGLER_SEND_METRICS -ErrorAction SilentlyContinue } else { $env:WRANGLER_SEND_METRICS = $previousMetrics }
}
if (-not $migrationComplete) {
  throw 'The local database process failed three times. Restart Windows and run this installer again. If it still fails, repair Microsoft Visual C++ 2015-2022 Redistributable (x64).'
}

$powerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$runScript = (Resolve-Path (Join-Path $PSScriptRoot 'Run-Board.ps1')).Path
$taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew

$serviceAction = New-ScheduledTaskAction -Execute $powerShell -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$runScript`"" -WorkingDirectory $projectRoot
$serviceTrigger = New-ScheduledTaskTrigger -AtStartup
$servicePrincipal = New-ScheduledTaskPrincipal -UserId 'S-1-5-19' -LogonType ServiceAccount -RunLevel Limited
Register-ScheduledTask -TaskName $serviceTaskName -Action $serviceAction -Trigger $serviceTrigger -Settings $taskSettings -Principal $servicePrincipal -Description 'Runs the Jaami Masjid digital display server when Windows starts.' -Force | Out-Null

Get-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $firewallRuleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -RemoteAddress @('LocalSubnet', '100.64.0.0/10') -Profile Any -Description 'Allows display computers on the local network and Tailscale to reach the Jaami Masjid board.' | Out-Null

Start-ScheduledTask -TaskName $serviceTaskName
if (-not (Wait-ForBoard)) {
  throw "The service task was installed, but the board did not answer in time. Review $projectRoot\.board-runtime\board-error.log."
}

Write-Host ''
Write-Host 'Installation complete.' -ForegroundColor Green
Write-Host 'The server will run invisibly and start automatically with Windows.'
Write-Host 'Nothing will open on this server PC.'
Write-Host ''
Write-Host 'On another PC, open one of these addresses:' -ForegroundColor Cyan
$addresses = Get-NetIPAddress -AddressFamily IPv4 -AddressState Preferred -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254.*' } |
  Select-Object -ExpandProperty IPAddress -Unique
foreach ($address in $addresses) {
  Write-Host "Display: http://${address}:3000/display/main"
  Write-Host "Admin:   http://${address}:3000/admin/login"
}
Write-Host ''
Write-Host 'Server-only local address: http://localhost:3000/admin/login'
