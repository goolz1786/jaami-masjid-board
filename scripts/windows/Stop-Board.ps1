$ErrorActionPreference = 'Stop'
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$pidFile = Join-Path $ProjectRoot '.board-runtime\board.pid.json'
$serviceTask = Get-ScheduledTask -TaskName 'Jaami Masjid Display Service' -ErrorAction SilentlyContinue
if ($serviceTask -and $serviceTask.State -eq 'Running') {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $elevated = Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList @(
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`""
    ) -Wait -PassThru
    exit $elevated.ExitCode
  }
  Stop-ScheduledTask -TaskName $serviceTask.TaskName
  Start-Sleep -Seconds 1
}
if (-not (Test-Path $pidFile)) { Write-Host 'No managed board process is recorded.'; exit 0 }
$record = Get-Content $pidFile -Raw | ConvertFrom-Json
$processInfo = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$record.pid)" -ErrorAction SilentlyContinue
if ($processInfo -and $processInfo.CommandLine -like "*$($ProjectRoot.Path)*Run-Board.ps1*") {
  taskkill.exe /PID $record.pid /T /F | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'The managed board process could not be stopped.' }
  $deadline = (Get-Date).AddSeconds(20)
  do {
    Start-Sleep -Milliseconds 500
    $listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
  } until (-not $listener -or (Get-Date) -gt $deadline)
  if ($listener) { throw 'The board process stopped but port 3000 did not close.' }
}
Remove-Item -LiteralPath $pidFile -Force
Write-Host 'Board stopped. Its database and uploads were retained.' -ForegroundColor Green
