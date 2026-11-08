$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('jaami-backup-watch-test-' + [Guid]::NewGuid().ToString('N'))
$global:jaamiTestStarts = [Collections.Generic.List[string]]::new()
$global:jaamiPortBusy = $false
$global:jaamiServiceStartFails = $false
function Get-ScheduledTask {
  param($TaskName, $ErrorAction)
  return [pscustomobject]@{ TaskName=$TaskName; State='Running' }
}
function Start-ScheduledTask {
  param($TaskName, $ErrorAction)
  $global:jaamiTestStarts.Add($TaskName)
  if ($global:jaamiServiceStartFails -and $TaskName -eq 'Jaami Masjid Display Service') { throw 'Synthetic service start failure' }
}
function Get-NetTCPConnection { param($LocalPort, $State, $ErrorAction) if ($global:jaamiPortBusy) { return [pscustomobject]@{ LocalPort=3000 } } }
try {
  New-Item -ItemType Directory -Path (Join-Path $fixture 'scripts\windows'), (Join-Path $fixture '.board-data') -Force | Out-Null
  [IO.File]::WriteAllText((Join-Path $fixture '.env'), 'SYNTHETIC=1')
  [IO.File]::WriteAllText((Join-Path $fixture '.board-data\example.sqlite'), 'SYNTHETIC BOARD DATA')
  [IO.File]::WriteAllText((Join-Path $fixture 'scripts\windows\Stop-Board.ps1'), 'Write-Host "Synthetic stop"')
  Copy-Item -LiteralPath (Join-Path $root 'scripts\windows\Backup-Board.ps1'), (Join-Path $root 'scripts\windows\Board-Archive.ps1') -Destination (Join-Path $fixture 'scripts\windows')
  $backup = Join-Path $fixture 'scripts\windows\Backup-Board.ps1'
  & $backup -InstallPath $fixture | Out-Null
  if (($global:jaamiTestStarts -join '|') -ne 'Jaami Masjid Display Service|Jaami Masjid Display Watchdog') { throw 'Backup must restart both previously running tasks in order.' }
  if ([IO.File]::ReadAllText((Join-Path $fixture '.board-data\example.sqlite')) -ne 'SYNTHETIC BOARD DATA') { throw 'Backup changed board data.' }
  $global:jaamiTestStarts.Clear()
  & $backup -InstallPath $fixture -NoRestart | Out-Null
  if ($global:jaamiTestStarts.Count) { throw 'NoRestart must not restart either task.' }
  $global:jaamiTestStarts.Clear(); $global:jaamiServiceStartFails = $true; $failed = $false
  try { & $backup -InstallPath $fixture | Out-Null } catch { $failed = $true }
  if (-not $failed -or ($global:jaamiTestStarts -join '|') -ne 'Jaami Masjid Display Service|Jaami Masjid Display Watchdog') { throw 'If board startup fails, watchdog startup must still be attempted.' }
  $global:jaamiServiceStartFails = $false
  $global:jaamiTestStarts.Clear(); $global:jaamiPortBusy = $true; $failed = $false
  try { & $backup -InstallPath $fixture | Out-Null } catch { $failed = $true }
  if (-not $failed) { throw 'An occupied port must stop the backup.' }
  if (($global:jaamiTestStarts -join '|') -ne 'Jaami Masjid Display Service|Jaami Masjid Display Watchdog') { throw 'A pre-backup failure must restore previously running tasks.' }
  Write-Host 'PASS: backups restore the prior service and watchdog state, honor NoRestart and preserve data.'
} finally {
  if (Test-Path -LiteralPath $fixture) {
    $resolved = (Resolve-Path -LiteralPath $fixture).Path
    $temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $resolved.StartsWith($temporaryRoot, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path $resolved -Leaf) -notlike 'jaami-backup-watch-test-*') { throw 'Unsafe fixture cleanup path.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
  }
}
