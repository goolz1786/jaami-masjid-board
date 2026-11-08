$ErrorActionPreference = 'Stop'
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('jaami-lock-test-' + [Guid]::NewGuid().ToString('N'))
$runner = $null
try {
  $scripts = Join-Path $fixture 'scripts\windows'
  $runtime = Join-Path $fixture '.board-runtime'
  $data = Join-Path $fixture '.board-data'
  New-Item -ItemType Directory -Path $scripts, $runtime, $data -Force | Out-Null
  $db = Join-Path $data 'metadata.sqlite'
  [IO.File]::WriteAllText($db, 'test notices')
  $holder = @'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$file = [IO.File]::Open((Join-Path $root '.board-data\metadata.sqlite'), [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
try { Set-Content -LiteralPath (Join-Path $root '.board-runtime\locked') -Value $PID; Start-Sleep -Seconds 90 } finally { $file.Dispose() }
'@
  [IO.File]::WriteAllText((Join-Path $scripts 'Hold-TestFile.ps1'), $holder)
  $runnerText = @'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
@{pid=$PID; projectRoot=$root; startedAt=(Get-Date).ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root '.board-runtime\board.pid.json')
$holder = Join-Path $PSScriptRoot 'Hold-TestFile.ps1'
Start-Process powershell.exe -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',"`"$holder`"") -WindowStyle Hidden | Out-Null
Start-Sleep -Seconds 90
'@
  $run = Join-Path $scripts 'Run-Board.ps1'
  [IO.File]::WriteAllText($run, $runnerText)
  $runner = Start-Process powershell.exe -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',"`"$run`"") -WorkingDirectory $fixture -WindowStyle Hidden -PassThru
  $deadline = (Get-Date).AddSeconds(20)
  while (-not (Test-Path -LiteralPath (Join-Path $runtime 'locked')) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 250 }
  if (-not (Test-Path -LiteralPath (Join-Path $runtime 'locked'))) { throw 'The disposable database lock did not start.' }
  $locked = $false
  try { Get-FileHash -LiteralPath $db -Algorithm SHA256 -ErrorAction Stop | Out-Null } catch { $locked = $true }
  if (-not $locked) { throw 'The disposable database was not actually locked.' }
  $holderPid = [int](Get-Content -LiteralPath (Join-Path $runtime 'locked'))
  $holderProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$holderPid"
  Write-Host "Disposable lock holder: PID $holderPid, parent $($holderProcess.ParentProcessId); runner PID $($runner.Id)."
  & (Join-Path $PSScriptRoot '..\scripts\windows\Stop-UpgradeRunner.ps1') -InstallPath $fixture -RequireRunner
  Get-FileHash -LiteralPath $db -Algorithm SHA256 -ErrorAction Stop | Out-Null
  if ([IO.File]::ReadAllText($db) -ne 'test notices') { throw 'The database contents changed.' }
  Write-Host 'PASS: stopping the verified runner releases a real locked database without changing its contents.'
} finally {
  if ($runner) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($runner.Id)" -ErrorAction SilentlyContinue
    if ($process -and $process.CommandLine -like "*$fixture*Run-Board.ps1*") { & taskkill.exe /PID $runner.Id /T /F | Out-Null }
  }
  if (Test-Path -LiteralPath $fixture) {
    $resolved = (Resolve-Path -LiteralPath $fixture).Path
    $temp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $resolved.StartsWith($temp, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path $resolved -Leaf) -notlike 'jaami-lock-test-*') { throw 'Unsafe test cleanup path.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
  }
}
