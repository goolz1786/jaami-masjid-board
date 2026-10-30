[CmdletBinding()]
param(
  [string]$InstallPath = 'C:\JaamiMasjidBoard',
  [string]$SourcePath
)

$ErrorActionPreference = 'Stop'
$serviceTaskName = 'Jaami Masjid Display Service'

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
    '-File', "`"$PSCommandPath`"",
    '-InstallPath', "`"$InstallPath`""
  )
  if ($SourcePath) { $arguments += @('-SourcePath', "`"$SourcePath`"") }
  $elevated = Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $arguments -Wait -PassThru
  exit $elevated.ExitCode
}

if (-not $SourcePath) {
  $SourcePath = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}
$SourcePath = (Resolve-Path -LiteralPath $SourcePath).Path

if (-not (Test-Path -LiteralPath (Join-Path $SourcePath 'package.json'))) {
  throw "The update folder does not look like the board package (no package.json in $SourcePath)."
}
if (-not (Test-Path -LiteralPath (Join-Path $SourcePath 'scripts\windows\Install-Board.ps1'))) {
  throw "The update folder is missing scripts\windows\Install-Board.ps1 ($SourcePath)."
}

if (-not (Test-Path -LiteralPath $InstallPath)) {
  throw "No existing installation was found at $InstallPath. On a new server, run INSTALL-WINDOWS.cmd from the extracted package instead."
}
$install = (Resolve-Path -LiteralPath $InstallPath).Path
. (Join-Path $SourcePath 'scripts\windows\Protect-BoardInstallation.ps1')
Assert-BoardInstallPath -Path $install
if (-not (Test-Path -LiteralPath (Join-Path $install 'package.json'))) {
  throw "$install does not look like a Jaami Masjid board installation."
}

if ($install -eq $SourcePath -or $SourcePath.StartsWith($install.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Extract the update to a separate folder outside the installed board, then run UPGRADE-WINDOWS.cmd there. This preserves the previous version for rollback.'
}
foreach ($required in @('.env', '.board-data')) {
  if (-not (Test-Path -LiteralPath (Join-Path $install $required))) { throw "Existing $required is missing. Upgrade stopped to avoid creating a blank installation." }
}
$envHash = (Get-FileHash -LiteralPath (Join-Path $install '.env') -Algorithm SHA256).Hash
Write-Host "Upgrading the board at $install" -ForegroundColor Cyan
$backup = $null
$filesChanged = $false
$previousTask = Get-ScheduledTask -TaskName $serviceTaskName -ErrorAction SilentlyContinue
$wasRunning = ($previousTask -and $previousTask.State -eq 'Running') -or [bool](Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)
try {
  Write-Host 'Stopping the display service...' -ForegroundColor Cyan
  Stop-ScheduledTask -TaskName $serviceTaskName -ErrorAction SilentlyContinue
  & (Join-Path $install 'scripts\windows\Stop-Board.ps1')
  if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
    throw 'Port 3000 is still in use. Upgrade stopped before copying or modifying data.'
  }
  Write-Host 'Creating and verifying the rollback backup...' -ForegroundColor Cyan
  $backup = & (Join-Path $SourcePath 'scripts\windows\Backup-Board.ps1') -InstallPath $install -NoRestart
  if (-not $backup -or -not (Test-Path -LiteralPath $backup)) { throw 'No verified backup was returned. Upgrade stopped.' }

  Write-Host 'Copying the new application files...' -ForegroundColor Cyan
  $excludedDirectories = @(
    'node_modules', '.next', '.vinext', '.wrangler', '.board-data',
    '.board-runtime', 'dist', 'tmp', 'work', 'output', 'outputs', 'sites', 'backups', '.git', 'uploads', 'media'
  )
  $excludedFiles = @('.env', '.env.*', '.dev.vars*', '*.tsbuildinfo', '*.zip')
  $robocopyArguments = @(
    $SourcePath, $install, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/R:1', '/W:1', '/XD'
  ) + @($excludedDirectories | ForEach-Object { Join-Path $SourcePath $_ }) + @('/XF') + $excludedFiles
  $filesChanged = $true
  & robocopy.exe @robocopyArguments | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "Copying the update failed (robocopy exit code $LASTEXITCODE)." }
  if ((Get-FileHash -LiteralPath (Join-Path $install '.env') -Algorithm SHA256).Hash -ne $envHash) {
    throw 'Existing .env changed unexpectedly. The upgrade was stopped.'
  }
  Write-Host 'Installing dependencies, building and restarting the service...' -ForegroundColor Cyan
  # Run in a child process so installer exit codes cannot terminate the upgrade's error handling.
  $powerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  & $powerShell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $install 'scripts\windows\Install-Board.ps1')
  if ($LASTEXITCODE -ne 0) { throw 'The installer failed.' }
  if ((Get-FileHash -LiteralPath (Join-Path $install '.env') -Algorithm SHA256).Hash -ne $envHash) { throw 'Existing .env changed unexpectedly.' }
} catch {
  if ($filesChanged) {
    Stop-ScheduledTask -TaskName $serviceTaskName -ErrorAction SilentlyContinue
    try { & (Join-Path $install 'scripts\windows\Stop-Board.ps1') } catch { Write-Warning "Could not stop the failed board process: $_" }
    Write-Host "Upgrade failed. Keep the installation and this rollback backup: $backup" -ForegroundColor Red
    Write-Host 'Use the restore steps in UPDATE-EXISTING-WINDOWS-SERVER.txt. Do not rerun a fresh install or delete the data.' -ForegroundColor Yellow
  } else {
    # No app/data changes occurred; return the previous service to operation.
    if ($wasRunning) {
      if ($previousTask) { Start-ScheduledTask -TaskName $serviceTaskName -ErrorAction SilentlyContinue }
      else { & (Join-Path $install 'scripts\windows\Start-Board.ps1') }
    }
  }
  throw
}
Write-Host ''
Write-Host 'Upgrade complete.' -ForegroundColor Green
Write-Host 'Existing credentials, database, uploads and content were preserved.'
Write-Host "Rollback backup: $backup"
Write-Host 'Sign in again: legacy sessions were invalidated by the security update.'
