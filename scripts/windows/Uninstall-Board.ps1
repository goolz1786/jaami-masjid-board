[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$serviceTaskName = 'Jaami Masjid Display Service'
$kioskTaskName = 'Jaami Masjid Display Kiosk'
$firewallRuleName = 'Jaami Masjid Display Board (TCP 3000)'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host 'Windows will ask for administrator permission once.' -ForegroundColor Yellow
  $elevated = Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`""
  ) -Wait -PassThru
  exit $elevated.ExitCode
}

Stop-ScheduledTask -TaskName $serviceTaskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $serviceTaskName -Confirm:$false -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $kioskTaskName -Confirm:$false -ErrorAction SilentlyContinue
Get-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
& (Join-Path $PSScriptRoot 'Stop-Board.ps1')

Write-Host 'Windows autostart was removed.' -ForegroundColor Green
Write-Host 'The application, database, uploaded media and backups were retained.'
