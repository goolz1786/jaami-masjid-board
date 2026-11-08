[CmdletBinding()]
param([string]$InstallPath, [switch]$RequireRunner, [switch]$LibraryOnly)

$ErrorActionPreference = 'Stop'
$asLibrary = $LibraryOnly.IsPresent
. (Join-Path $PSScriptRoot 'Watch-Board.ps1') -LibraryOnly

function Get-InstalledBoardProcesses([string]$Root) {
  $wrangler = Join-Path $Root 'node_modules\wrangler\wrangler-dist\cli.js'
  $runtime = (Join-Path $Root 'node_modules').TrimEnd('\') + '\'
  Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
    ($_.Name -eq 'workerd.exe' -and $_.ExecutablePath -and $_.ExecutablePath.StartsWith($runtime, [StringComparison]::OrdinalIgnoreCase)) -or
    ($_.Name -eq 'node.exe' -and $_.CommandLine -and $_.CommandLine.IndexOf($wrangler, [StringComparison]::OrdinalIgnoreCase) -ge 0) -or
    (Test-BoardRunnerCommandLine -Process $_ -Root $Root)
  }
}

function Get-UpgradeProcessTree($Runner) {
  $processes = @(Get-CimInstance Win32_Process -ErrorAction Stop)
  $byId = @{}
  foreach ($process in $processes) { $byId[[int]$process.ProcessId] = $process }
  $tree = [Collections.Generic.List[object]]::new()
  foreach ($process in $processes) {
    $node = $process; $childDate = $null; $seen = [Collections.Generic.HashSet[int]]::new()
    while ($node -and $seen.Add([int]$node.ProcessId)) {
      if (-not $node.CreationDate -or ($childDate -and $node.CreationDate -gt $childDate)) { break }
      if ($node.ProcessId -eq $Runner.ProcessId) {
        if ($node.CreationDate -eq $Runner.CreationDate) { $tree.Add($process) }
        break
      }
      $childDate = $node.CreationDate
      $node = $byId[[int]$node.ParentProcessId]
    }
  }
  return $tree.ToArray()
}

function Wait-UpgradeProcessTree($Processes) {
  $deadline = (Get-Date).AddSeconds(20)
  do {
    $remaining = @($Processes | Where-Object {
      $current = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$_.ProcessId)" -ErrorAction Stop
      $current -and $current.CreationDate -eq $_.CreationDate
    })
    if ($remaining.Count) { Start-Sleep -Milliseconds 250 }
  } until (-not $remaining.Count -or (Get-Date) -ge $deadline)
  if ($remaining.Count) { throw 'A board process did not stop in time. Upgrade stopped before changing files.' }
}

function Stop-UpgradeRunner([string]$Root, [switch]$RequireRunner) {
  $runner = Get-ManagedBoardRunner -Root $Root
  $candidates = @(Get-InstalledBoardProcesses -Root $Root)
  if ($RequireRunner -and -not $runner) { throw 'The running board has no verified runner. Upgrade stopped before changing files; inspect the running processes.' }
  foreach ($process in $candidates) {
    if (-not $runner -or -not (Test-BoardProcessTree -ProcessId ([int]$process.ProcessId) -Runner $runner)) {
      throw 'An unexpected board process exists. Upgrade stopped before changing files; inspect the running processes.'
    }
  }
  if (-not $runner) { return }
  $current = Get-ManagedBoardRunner -Root $Root
  if (-not $current -or $current.ProcessId -ne $runner.ProcessId -or $current.CreationDate -ne $runner.CreationDate) {
    throw 'The board runner changed during the upgrade check. Nothing was stopped.'
  }
  $tree = @(Get-UpgradeProcessTree -Runner $runner)
  if (-not @($tree | Where-Object { $_.ProcessId -eq $runner.ProcessId -and $_.CreationDate -eq $runner.CreationDate }).Count) {
    throw 'The board process tree changed during the upgrade check. Nothing was stopped.'
  }
  & taskkill.exe /PID $runner.ProcessId /T /F | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'The verified board process tree could not be stopped.' }
  Wait-UpgradeProcessTree -Processes $tree
}

if ($asLibrary) { return }
Stop-UpgradeRunner -Root $InstallPath -RequireRunner:$RequireRunner
