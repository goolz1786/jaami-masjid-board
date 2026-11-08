$ErrorActionPreference = 'Stop'
$script:events = [Collections.Generic.List[string]]::new()
$script:taskState = 'Ready'
$script:healthy = $false
$script:listening = $false
$script:managed = $null
$script:validTask = $true
$script:descendant = $false
$script:unverifiedRunner = $false
$script:simulateNewRun = $false
$script:lastRunTime = (Get-Date).AddMinutes(-10)
. (Join-Path $PSScriptRoot '..\scripts\windows\Watch-Board.ps1') -LibraryOnly

function Test-BoardResponse { return $script:healthy }
function Get-BoardListeners { if ($script:listening) { return [pscustomobject]@{ OwningProcess = 999 } } }
function Get-ScheduledTask { param($TaskName, $ErrorAction) return [pscustomobject]@{ State = $script:taskState } }
function Get-ScheduledTaskInfo { param($TaskName, $ErrorAction) return [pscustomobject]@{ LastRunTime = $script:lastRunTime } }
function Test-BoardTaskDefinition { param($Task, $Root) return $script:validTask }
function Get-ManagedBoardRunner { param($Root) return $script:managed }
function Get-BoardRunnerCandidates { param($Root) if ($script:unverifiedRunner) { return [pscustomobject]@{ ProcessId=2222 } } }
function Stop-ManagedBoardRunner { param($Process) $script:events.Add("stop-pid-$($Process.ProcessId)"); $script:listening = $false; if ($script:simulateNewRun) { $script:lastRunTime = Get-Date } }
function Test-BoardProcessTree { param($ProcessId, $Runner) return $script:descendant }
function Stop-ScheduledTask { param($TaskName, $ErrorAction) $script:events.Add('stop-task'); $script:taskState = 'Ready' }
function Start-ScheduledTask { param($TaskName, $ErrorAction) $script:events.Add('start-task'); $script:taskState = 'Running' }
function Write-WatchdogLog { param($Message) $script:events.Add("log-$Message") }

$script:healthy = $true
Invoke-BoardRecovery -Root 'C:\TestBoard'
if ($script:events.Count) { throw 'Healthy boards must not be restarted.' }

$script:healthy = $false
$script:listening = $true
Invoke-BoardRecovery -Root 'C:\TestBoard'
if (@($script:events | Where-Object { $_ -in @('stop-task','start-task') }).Count) { throw 'A listener of unknown ownership must never be stopped.' }

$script:events.Clear(); $script:listening = $false; $script:taskState = 'Ready'
$script:managed = [pscustomobject]@{ ProcessId = 2372 }
Invoke-BoardRecovery -Root 'C:\TestBoard'
if (($script:events -join ',') -notmatch 'stop-pid-2372.*start-task') { throw 'An identified orphan must be stopped before restarting the board.' }

$script:events.Clear(); $script:taskState = 'Running'; $script:managed = $null
Invoke-BoardRecovery -Root 'C:\TestBoard'
if (@($script:events | Where-Object { $_ -in @('stop-task','start-task') }).Count) { throw 'An unverified running task must be left alone.' }

$script:events.Clear(); $script:taskState = 'Running'; $script:managed = [pscustomobject]@{ ProcessId = 1234 }
Invoke-BoardRecovery -Root 'C:\TestBoard'
if (($script:events -join ',') -notmatch 'stop-pid-1234.*stop-task.*start-task') { throw 'A verified unresponsive board task should be restarted.' }

$script:events.Clear(); $script:taskState = 'Ready'; $script:managed = $null; $script:validTask = $false
Invoke-BoardRecovery -Root 'C:\TestBoard'
if (@($script:events | Where-Object { $_ -in @('stop-task','start-task') }).Count) { throw 'An unexpected task definition must not be started.' }
$script:validTask = $true

$script:events.Clear(); $script:taskState = 'Ready'; $script:managed = $null; $script:unverifiedRunner = $true
Invoke-BoardRecovery -Root 'C:\TestBoard'
if (@($script:events | Where-Object { $_ -like 'stop-pid-*' -or $_ -in @('stop-task','start-task') }).Count) { throw 'An unverified board runner must not be killed or duplicated.' }
$script:unverifiedRunner = $false

$script:events.Clear(); $script:taskState = 'Running'; $script:managed = [pscustomobject]@{ ProcessId=1234 }; $script:listening = $true; $script:descendant = $true
Invoke-BoardRecovery -Root 'C:\TestBoard'
if (($script:events -join ',') -notmatch 'stop-pid-1234.*stop-task.*start-task') { throw 'An unresponsive listener owned by the verified board must be recovered.' }
$script:events.Clear(); $script:taskState = 'Running'; $script:listening = $true; $script:descendant = $false
Invoke-BoardRecovery -Root 'C:\TestBoard'
if (@($script:events | Where-Object { $_ -like 'stop-pid-*' -or $_ -in @('stop-task','start-task') }).Count) { throw 'An unknown listening process must never be stopped.' }
$script:listening = $false

$script:events.Clear(); $script:taskState = 'Running'; $script:managed = [pscustomobject]@{ ProcessId=1234 }; $script:simulateNewRun = $true
Invoke-BoardRecovery -Root 'C:\TestBoard'
if (@($script:events | Where-Object { $_ -in @('stop-task','start-task') }).Count) { throw 'A task that restarted during recovery must be left alone.' }
$script:simulateNewRun = $false; $script:lastRunTime = (Get-Date).AddMinutes(-10)

Write-Host 'PASS: watchdog restarts only verified board processes, leaves healthy boards and unknown listeners alone.'

# Exercise the monitoring loop's failure threshold, cooldown and retry cap.
$state = New-BoardWatchState
$script:cycleHealthy = $false
$script:recoveries = 0
function Test-BoardResponse { return $script:cycleHealthy }
function Invoke-BoardRecovery { param($Root) $script:recoveries++; return $true }
function Write-WatchdogLog { param($Message) }
$instant = [DateTime]'2030-01-01T12:00:00'
Invoke-BoardWatchCycle -State $state -Root 'C:\TestBoard' -Now $instant
Invoke-BoardWatchCycle -State $state -Root 'C:\TestBoard' -Now $instant.AddSeconds(30)
if ($script:recoveries -ne 0) { throw 'A transient failure must not trigger recovery.' }
Invoke-BoardWatchCycle -State $state -Root 'C:\TestBoard' -Now $instant.AddSeconds(60)
if ($script:recoveries -ne 1) { throw 'Three consecutive failures must trigger one recovery.' }
for ($seconds = 90; $seconds -le 150; $seconds += 30) { Invoke-BoardWatchCycle -State $state -Root 'C:\TestBoard' -Now $instant.AddSeconds($seconds) }
if ($script:recoveries -ne 1) { throw 'Recovery cooldown must prevent rapid restarts.' }
$script:cycleHealthy = $true
Invoke-BoardWatchCycle -State $state -Root 'C:\TestBoard' -Now $instant.AddSeconds(180)
if ($state.Failures -ne 0) { throw 'A healthy response must reset consecutive failures.' }
$script:cycleHealthy = $false
$state.Attempts = @($instant, $instant.AddMinutes(1), $instant.AddMinutes(2))
$state.NextAttempt = [DateTime]::MinValue
$state.Failures = 2
Invoke-BoardWatchCycle -State $state -Root 'C:\TestBoard' -Now $instant.AddMinutes(4)
if ($script:recoveries -ne 1) { throw 'Recovery must stop after three restarts within an hour.' }
Write-Host 'PASS: monitoring waits for repeated failures and limits recovery attempts.'

# Run the real identity check against a disposable PowerShell process, not a Windows task.
. (Join-Path $PSScriptRoot '..\scripts\windows\Watch-Board.ps1') -LibraryOnly
$script:healthBody = '{"settings":{},"contentItems":[]}'
function Invoke-WebRequest {
  param($UseBasicParsing, $Uri, $TimeoutSec)
  if ($TimeoutSec -ne 15) { throw 'Health checks must allow the Islamic-date refresh to time out first.' }
  return [pscustomobject]@{ StatusCode=200; Content=$script:healthBody }
}
if (-not (Test-BoardResponse)) { throw 'A valid board response was rejected.' }
$script:healthBody = '{"unrelated":true}'
if (Test-BoardResponse) { throw 'An unrelated HTTP 200 response must not be treated as a healthy board.' }
Write-Host 'PASS: health checks validate the board response and allow time for the Islamic-date refresh.'
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('jaami-watchdog-test-' + [Guid]::NewGuid().ToString('N'))
$child = $null
try {
  New-Item -ItemType Directory -Path (Join-Path $fixture 'scripts\windows'), (Join-Path $fixture '.board-runtime') -Force | Out-Null
  $runner = Join-Path $fixture 'scripts\windows\Run-Board.ps1'
  [IO.File]::WriteAllText($runner, '& powershell.exe -NoProfile -NonInteractive -Command "Start-Sleep -Seconds 40"')
  $child = Start-Process powershell.exe -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',"`"$runner`"") -WindowStyle Hidden -PassThru
  $null = $child.Handle
  $pidFile = Join-Path $fixture '.board-runtime\board.pid.json'
  @{ pid=$child.Id; startedAt=$child.StartTime.ToUniversalTime().ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath $pidFile -Encoding utf8
  $match = Get-ManagedBoardRunner -Root $fixture
  if (-not $match -or $match.ProcessId -ne $child.Id) { throw 'The real matching board runner was not recognized.' }
  $descendant = $null
  for ($attempt = 0; $attempt -lt 20 -and -not $descendant; $attempt++) {
    Start-Sleep -Milliseconds 200
    $descendant = Get-CimInstance Win32_Process -Filter "ParentProcessId=$($child.Id)" | Select-Object -First 1
  }
  if (-not $descendant -or -not (Test-BoardProcessTree -ProcessId $descendant.ProcessId -Runner $match)) { throw 'A real board child process was not recognized.' }
  if (Test-BoardProcessTree -ProcessId $PID -Runner $match) { throw 'An unrelated ancestor must not be treated as a board child.' }
  Write-Host 'PASS: watchdog verifies real descendant ownership and rejects unrelated processes.'
  @{ pid=$child.Id; startedAt=$child.StartTime.ToUniversalTime().AddHours(-1).ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath $pidFile -Encoding utf8
  if (Get-ManagedBoardRunner -Root $fixture) { throw 'A mismatched process creation time must not be trusted.' }
  Write-Host 'PASS: watchdog identity validation accepts the matching runner and rejects stale PID records.'
  $taskDefinition = [pscustomobject]@{
    Actions = @([pscustomobject]@{ Execute = (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'); WorkingDirectory = $fixture; Arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$runner`"" })
    Principal = [pscustomobject]@{ UserId = 'S-1-5-19' }
  }
  if (-not (Test-BoardTaskDefinition -Task $taskDefinition -Root $fixture)) { throw 'The valid board task definition was rejected.' }
  $taskDefinition.Actions[0].Arguments = "-Command unexpected -File `"$runner`""
  if (Test-BoardTaskDefinition -Task $taskDefinition -Root $fixture) { throw 'Extra commands must not be trusted.' }
  $taskDefinition.Actions[0].Execute = 'C:\Unexpected\other.exe'
  if (Test-BoardTaskDefinition -Task $taskDefinition -Root $fixture) { throw 'An unexpected executable must not be trusted.' }
  Write-Host 'PASS: watchdog validates the scheduled task action and service identity.'
  function Test-BoardTaskDefinition { param($Task, $Root) return $true }
  @{ pid=$child.Id; startedAt=$child.StartTime.ToUniversalTime().ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath $pidFile -Encoding utf8
  $projectRoot = $fixture
  $script:taskState = 'Ready'
  $script:events.Clear()
  function Test-BoardResponse { return $false }
  function Get-BoardListeners { }
  function Get-BoardRunnerCandidates { param($Root) return @() }
  function Write-WatchdogLog { param($Message) $script:events.Add("log-$Message") }
  $recovered = Invoke-BoardRecovery -Root $fixture
  $child.Refresh()
  if (-not $recovered -or -not $child.HasExited -or -not ($script:events -contains 'start-task')) { throw 'The verified isolated orphan was not stopped and the task was not restarted.' }
  Write-Host 'PASS: recovery terminated only the real disposable runner and requested a task restart.'
} finally {
  if ($child -and -not $child.HasExited) { $child.Kill(); $child.WaitForExit() }
  if (Test-Path -LiteralPath $fixture) {
    $resolved = (Resolve-Path -LiteralPath $fixture).Path
    $temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $resolved.StartsWith($temporaryRoot, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path $resolved -Leaf) -notlike 'jaami-watchdog-test-*') { throw 'Unsafe fixture cleanup path.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
  }
}
