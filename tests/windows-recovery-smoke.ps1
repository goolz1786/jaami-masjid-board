$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('jaami-recovery-test-' + [Guid]::NewGuid().ToString('N'))
$child = $null
$lock = $null
$originalPath = $env:Path
try {
  $runtime = Join-Path $fixture '.board-runtime'
  New-Item -ItemType Directory -Path $runtime, (Join-Path $fixture 'scripts\windows'), (Join-Path $fixture 'bin') -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $root 'scripts\windows\Run-Board.ps1') -Destination (Join-Path $fixture 'scripts\windows\Run-Board.ps1')
  [IO.File]::WriteAllText((Join-Path $fixture '.env'), 'SYNTHETIC=1')
  [IO.File]::WriteAllText((Join-Path $fixture 'bin\npx.cmd'), "@echo off`r`necho SYNTHETIC_WRANGLER_STARTED`r`necho SYNTHETIC_WARNING 1>&2`r`necho AFTER_WARNING`r`nexit /b 0`r`n")
  $oldLog = Join-Path $runtime 'board.log'
  [IO.File]::WriteAllText($oldLog, 'OLD-LOG-KEEP')
  $lock = [IO.File]::Open($oldLog, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  $env:Path = (Join-Path $fixture 'bin') + ';' + $originalPath
  $runner = Join-Path $fixture 'scripts\windows\Run-Board.ps1'
  $child = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',"`"$runner`"") -WorkingDirectory $fixture -WindowStyle Hidden -RedirectStandardOutput (Join-Path $fixture 'stdout.txt') -RedirectStandardError (Join-Path $fixture 'stderr.txt') -PassThru
  $null = $child.Handle
  if (-not $child.WaitForExit(20000)) { throw 'Isolated runner did not finish.' }
  if ($child.ExitCode -ne 1) {
    $details = @(Get-ChildItem -LiteralPath $runtime -Filter 'board-*.log' | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw -ErrorAction SilentlyContinue }) -join "`n"
    throw "The unexpectedly stopped worker must make the runner fail for Task Scheduler retry; exit code [$($child.ExitCode)]: $([IO.File]::ReadAllText((Join-Path $fixture 'stderr.txt'))) $details"
  }
  $newLogs = @(Get-ChildItem -LiteralPath $runtime -Filter 'board-*.log' | Where-Object { $_.Name -ne 'board-error.log' })
  if (-not $newLogs.Count) { throw 'No separate instance log was created.' }
  if (-not (@($newLogs | Where-Object { (Get-Content -LiteralPath $_.FullName -Raw) -match 'SYNTHETIC_WRANGLER_STARTED' -and (Get-Content -LiteralPath $_.FullName -Raw) -match 'SYNTHETIC_WARNING' -and (Get-Content -LiteralPath $_.FullName -Raw) -match 'AFTER_WARNING' }).Count)) { throw 'Synthetic worker did not continue after a warning or its output was not captured.' }
  [IO.File]::WriteAllText((Join-Path $fixture 'bin\npx.cmd'), "@echo off`r`necho SYNTHETIC_FAILURE 1>&2`r`nexit /b 7`r`n")
  $child = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',"`"$runner`"") -WorkingDirectory $fixture -WindowStyle Hidden -RedirectStandardOutput (Join-Path $fixture 'stdout2.txt') -RedirectStandardError (Join-Path $fixture 'stderr2.txt') -PassThru
  $null = $child.Handle
  if (-not $child.WaitForExit(20000) -or $child.ExitCode -ne 7) { throw "A real worker failure must retain its exit code; received [$($child.ExitCode)]." }
  $lock.Dispose(); $lock = $null
  if ([IO.File]::ReadAllText($oldLog) -ne 'OLD-LOG-KEEP') { throw 'The old log changed.' }
  Write-Host 'PASS: old log lock does not block startup; native warnings are captured and unexpected clean exit requests a restart.'
} finally {
  $env:Path = $originalPath
  if ($lock) { $lock.Dispose() }
  if ($child -and -not $child.HasExited) { $child.Kill(); $child.WaitForExit() }
  if (Test-Path -LiteralPath $fixture) {
    $resolved = (Resolve-Path -LiteralPath $fixture).Path
    $temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $resolved.StartsWith($temporaryRoot, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path $resolved -Leaf) -notlike 'jaami-recovery-test-*') { throw 'Unsafe fixture cleanup path.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
  }
}
