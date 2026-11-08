[CmdletBinding()]
param([switch]$LibraryOnly)

$ErrorActionPreference = 'Stop'
$serviceName = 'Jaami Masjid Display Service'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$watchLog = Join-Path $projectRoot '.board-runtime\watchdog.log'

function Write-WatchdogLog([string]$Message) {
  try { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message" | Add-Content -LiteralPath $watchLog -Encoding utf8 }
  catch { Write-Warning "Unable to write the watchdog log: $($_.Exception.Message)" }
}

function Test-BoardResponse {
  try {
    # The board can spend up to 8 seconds refreshing the Islamic date; allow
    # additional time for the local database before treating a check as failed.
    $response = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:3000/api/state' -TimeoutSec 15
    if ($response.StatusCode -ne 200) { return $false }
    $state = $response.Content | ConvertFrom-Json
    return $null -ne $state.settings -and $state.PSObject.Properties.Name -contains 'contentItems'
  } catch { return $false }
}

function Get-BoardListeners {
  # Query all listeners so a system query failure cannot be confused with an empty port.
  Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -eq 3000 }
}

function Test-BoardRunnerCommandLine($Process, [string]$Root) {
  if (-not $Process -or $Process.Name -ne 'powershell.exe') { return $false }
  $expectedExePath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  if (-not [string]::Equals($Process.ExecutablePath, $expectedExePath, [StringComparison]::OrdinalIgnoreCase)) { return $false }
  $exe = [regex]::Escape($expectedExePath)
  $expected = [regex]::Escape((Join-Path $Root 'scripts\windows\Run-Board.ps1'))
  $pattern = '(?i)^"?' + $exe + '"?\s+-NoProfile\s+(?:-NonInteractive\s+)?-ExecutionPolicy\s+Bypass\s+-File\s+(?:"' + $expected + '"|' + $expected + ')\s*$'
  return $Process.CommandLine -match $pattern
}

function Get-BoardRunnerCandidates([string]$Root) {
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction Stop |
    Where-Object { Test-BoardRunnerCommandLine -Process $_ -Root $Root }
}

function Get-ManagedBoardRunner([string]$Root) {
  $pidFile = Join-Path $Root '.board-runtime\board.pid.json'
  if (-not (Test-Path -LiteralPath $pidFile)) { return $null }
  try {
    $record = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
    $id = [int]$record.pid
    if ($id -le 0) { return $null }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$id" -ErrorAction Stop
    if (-not (Test-BoardRunnerCommandLine -Process $process -Root $Root)) { return $null }
    $started = [DateTimeOffset]::Parse([string]$record.startedAt)
    $created = [DateTimeOffset]$process.CreationDate
    if ([math]::Abs(($started - $created).TotalSeconds) -gt 60) { return $null }
    return $process
  } catch { return $null }
}

function Test-BoardProcessTree([int]$ProcessId, $Runner) {
  $seen = [Collections.Generic.HashSet[int]]::new()
  $childCreated = $null
  for ($depth = 0; $depth -lt 64 -and $ProcessId -gt 0; $depth++) {
    if (-not $seen.Add($ProcessId)) { return $false }
    $node = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction Stop
    if (-not $node -or -not $node.CreationDate) { return $false }
    $created = [DateTime]$node.CreationDate
    if ($childCreated -and $created -gt $childCreated) { return $false }
    if ($node.ProcessId -eq $Runner.ProcessId) { return $created -eq [DateTime]$Runner.CreationDate }
    $childCreated = $created
    $ProcessId = [int]$node.ParentProcessId
  }
  return $false
}

function Test-BoardListenersOwnedByRunner($Listeners, $Runner) {
  if (-not $Runner) { return $false }
  foreach ($listener in $Listeners) {
    if (-not (Test-BoardProcessTree -ProcessId ([int]$listener.OwningProcess) -Runner $Runner)) { return $false }
  }
  return $true
}

function Stop-ManagedBoardRunner($Process) {
  # Recheck immediately before termination to avoid acting on a reused PID.
  $current = Get-ManagedBoardRunner -Root $projectRoot
  if (-not $current -or $current.ProcessId -ne $Process.ProcessId -or $current.CreationDate -ne $Process.CreationDate) {
    throw 'The recorded board process changed before recovery; no process was stopped.'
  }
  & taskkill.exe /PID $Process.ProcessId /T /F | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'The verified board process tree could not be stopped.' }
}

function Test-BoardTaskDefinition($Task, [string]$Root) {
  try {
    $actions = @($Task.Actions)
    if ($actions.Count -ne 1) { return $false }
    $expectedExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    if (-not [string]::Equals([IO.Path]::GetFullPath($actions[0].Execute), $expectedExe, [StringComparison]::OrdinalIgnoreCase)) { return $false }
    if (-not [string]::Equals([IO.Path]::GetFullPath($actions[0].WorkingDirectory).TrimEnd('\'), $Root.TrimEnd('\'), [StringComparison]::OrdinalIgnoreCase)) { return $false }
    $expectedArgs = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + (Join-Path $Root 'scripts\windows\Run-Board.ps1') + '"'
    if (-not [string]::Equals($actions[0].Arguments.Trim(), $expectedArgs, [StringComparison]::OrdinalIgnoreCase)) { return $false }
    $user = [string]$Task.Principal.UserId
    if ($user -eq 'S-1-5-19') { return $true }
    $sid = ([Security.Principal.NTAccount]::new($user)).Translate([Security.Principal.SecurityIdentifier])
    return $sid.Value -eq 'S-1-5-19'
  } catch { return $false }
}

function Invoke-BoardRecovery([string]$Root) {
  # Never touch an unrelated process using the board's port, or a board which recovered.
  if (Test-BoardResponse) { return $false }
  $task = Get-ScheduledTask -TaskName $serviceName -ErrorAction Stop
  if ($task.State -notin @('Ready', 'Running')) { Write-WatchdogLog "Board task is $($task.State); recovery skipped."; return $false }
  if (-not (Test-BoardTaskDefinition -Task $task -Root $Root)) { Write-WatchdogLog 'Board task definition is unexpected; recovery skipped.'; return $false }
  $info = Get-ScheduledTaskInfo -TaskName $serviceName -ErrorAction Stop
  if ($info.LastRunTime -gt (Get-Date).AddMinutes(-2)) { return $false }
  $runner = Get-ManagedBoardRunner -Root $Root
  if ($task.State -eq 'Running' -and -not $runner) { Write-WatchdogLog 'Running task has no verified runner; recovery skipped.'; return $false }
  if (-not $runner -and @(Get-BoardRunnerCandidates -Root $Root).Count) { Write-WatchdogLog 'An unverified board runner exists; recovery skipped.'; return $false }
  $listeners = @(Get-BoardListeners)
  if ($listeners.Count -and -not (Test-BoardListenersOwnedByRunner -Listeners $listeners -Runner $runner)) { Write-WatchdogLog 'Port 3000 has an unknown listener; recovery left it untouched.'; return $false }
  if (Test-BoardResponse) { return $false }
  $listeners = @(Get-BoardListeners)
  if ($listeners.Count -and -not (Test-BoardListenersOwnedByRunner -Listeners $listeners -Runner $runner)) { Write-WatchdogLog 'Port 3000 became occupied by an unknown process; recovery skipped.'; return $false }
  if ($runner) { Stop-ManagedBoardRunner -Process $runner; Start-Sleep -Seconds 2 }
  $currentTask = Get-ScheduledTask -TaskName $serviceName -ErrorAction Stop
  if (-not (Test-BoardTaskDefinition -Task $currentTask -Root $Root)) { Write-WatchdogLog 'Board task changed during recovery; no restart requested.'; return $false }
  $currentInfo = Get-ScheduledTaskInfo -TaskName $serviceName -ErrorAction Stop
  if ($currentInfo.LastRunTime -gt $info.LastRunTime -or (Test-BoardResponse)) { Write-WatchdogLog 'The board restarted during recovery; it was left untouched.'; return $false }
  if ($currentTask.State -eq 'Running') {
    $currentRunner = Get-ManagedBoardRunner -Root $Root
    if ($currentRunner -and (-not $runner -or $currentRunner.ProcessId -ne $runner.ProcessId -or $currentRunner.CreationDate -ne $runner.CreationDate)) {
      Write-WatchdogLog 'A new board runner started during recovery; it was left untouched.'
      return $false
    }
    Stop-ScheduledTask -TaskName $serviceName -ErrorAction Stop
  }
  if (@(Get-BoardListeners).Count) { Write-WatchdogLog 'Port 3000 is still occupied; board was not restarted.'; return $false }
  $currentTask = Get-ScheduledTask -TaskName $serviceName -ErrorAction Stop
  if ($currentTask.State -ne 'Ready' -or -not (Test-BoardTaskDefinition -Task $currentTask -Root $Root)) { Write-WatchdogLog 'Board task is not ready for restart; recovery skipped.'; return $false }
  Start-ScheduledTask -TaskName $serviceName -ErrorAction Stop
  Write-WatchdogLog 'Requested a board restart after repeated failures.'
  return $true
}

function New-BoardWatchState {
  return [pscustomobject]@{ Failures = 0; Attempts = @(); NextAttempt = [DateTime]::MinValue; NextLimitLog = [DateTime]::MinValue }
}

function Invoke-BoardWatchCycle($State, [string]$Root, [DateTime]$Now) {
  if (Test-BoardResponse) { $State.Failures = 0; return }
  $State.Failures++
  $State.Attempts = @($State.Attempts | Where-Object { $_ -gt $Now.AddHours(-1) })
  if ($State.Failures -lt 3 -or $Now -lt $State.NextAttempt) { return }
  if ($State.Attempts.Count -ge 3) {
    if ($Now -ge $State.NextLimitLog) { Write-WatchdogLog 'Recovery limit reached: investigate the board on the server.'; $State.NextLimitLog = $Now.AddMinutes(5) }
    return
  }
  # Throttle even skipped attempts and exceptions to avoid repeated process churn.
  $State.NextAttempt = $Now.AddMinutes(2)
  if (Invoke-BoardRecovery -Root $Root) { $State.Attempts += $Now; $State.Failures = 0 }
}

if ($LibraryOnly) { return }
Write-WatchdogLog 'Watchdog started.'
$state = New-BoardWatchState
while ($true) {
  try { Invoke-BoardWatchCycle -State $state -Root $projectRoot -Now (Get-Date) }
  catch { Write-WatchdogLog "Recovery check failed: $($_.Exception.Message)"; $state.NextAttempt = (Get-Date).AddMinutes(2) }
  Start-Sleep -Seconds 30
}
