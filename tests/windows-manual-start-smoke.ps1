$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('jaami-manual-start-test-' + [Guid]::NewGuid().ToString('N'))
$starter = $null; $lock = $null; $managedPid = $null
$originalPath = $env:Path
try {
  $probe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
  $probe.Start(); $port = $probe.LocalEndpoint.Port; $probe.Stop()
  $runtime = Join-Path $fixture '.board-runtime'
  New-Item -ItemType Directory -Path $runtime, (Join-Path $fixture 'scripts\windows'), (Join-Path $fixture 'bin'), (Join-Path $fixture 'dist\server') -Force | Out-Null
  [IO.File]::WriteAllText((Join-Path $fixture '.env'), 'SYNTHETIC=1')
  [IO.File]::WriteAllText((Join-Path $fixture 'dist\server\index.js'), 'synthetic build marker')
  $runSource = [IO.File]::ReadAllText((Join-Path $root 'scripts\windows\Run-Board.ps1')).Replace('--port 3000', "--port $port")
  [IO.File]::WriteAllText((Join-Path $fixture 'scripts\windows\Run-Board.ps1'), $runSource)
  $startSource = [IO.File]::ReadAllText((Join-Path $root 'scripts\windows\Start-Board.ps1')).Replace('localhost:3000', "127.0.0.1:$port")
  $startSource = "function Get-ScheduledTask { param(`$TaskName, `$ErrorAction) return `$null }`r`n" + $startSource
  $startScript = Join-Path $fixture 'scripts\windows\Start-Board.ps1'
  [IO.File]::WriteAllText($startScript, $startSource)
  $fakeWorker = "console.error('SYNTHETIC WARNING'); require('http').createServer((req,res)=>{res.writeHead(200,{'content-type':'application/json'});res.end('{`"settings`":{},`"contentItems`":[]}')}).listen($port,'127.0.0.1');"
  [IO.File]::WriteAllText((Join-Path $fixture 'bin\worker.cjs'), $fakeWorker)
  [IO.File]::WriteAllText((Join-Path $fixture 'bin\npx.cmd'), "@echo off`r`nnode `"%~dp0worker.cjs`"`r`nexit /b %ERRORLEVEL%`r`n")
  $oldLog = Join-Path $runtime 'board.log'
  [IO.File]::WriteAllText($oldLog, 'OLD-LOG-KEEP')
  $lock = [IO.File]::Open($oldLog, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  $env:Path = (Join-Path $fixture 'bin') + ';' + $originalPath
  $starter = Start-Process powershell.exe -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',"`"$startScript`"") -WorkingDirectory $fixture -WindowStyle Hidden -RedirectStandardOutput (Join-Path $fixture 'starter-out.txt') -RedirectStandardError (Join-Path $fixture 'starter-err.txt') -PassThru
  $null = $starter.Handle
  if (-not $starter.WaitForExit(30000)) { throw 'Synthetic manual start timed out.' }
  if ($starter.ExitCode -ne 0) { throw "Synthetic manual start failed: $([IO.File]::ReadAllText((Join-Path $fixture 'starter-err.txt')))" }
  $record = Get-Content -LiteralPath (Join-Path $runtime 'board.pid.json') -Raw | ConvertFrom-Json
  $managedPid = [int]$record.pid
  $managed = Get-CimInstance Win32_Process -Filter "ProcessId=$managedPid"
  if (-not $managed -or $managed.CommandLine -notlike "*$fixture*Run-Board.ps1*") { throw 'The fixture runner identity could not be verified.' }
  $response = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$port/api/state" -TimeoutSec 5
  if ($response.StatusCode -ne 200) { throw 'Synthetic board did not answer.' }
  if (-not @(Get-ChildItem -LiteralPath $runtime -Filter 'launcher-*.log').Count) { throw 'Separate launcher logs were not created.' }
  Write-Host 'PASS: manual start survives a locked old log and a native warning, and the synthetic board answers HTTP.'
} finally {
  $env:Path = $originalPath
  if ($lock) { $lock.Dispose() }
  if ($starter -and -not $starter.HasExited) { $starter.Kill(); $starter.WaitForExit() }
  if (-not $managedPid -and (Test-Path -LiteralPath (Join-Path $fixture '.board-runtime\board.pid.json'))) {
    try { $managedPid = [int]((Get-Content -LiteralPath (Join-Path $fixture '.board-runtime\board.pid.json') -Raw | ConvertFrom-Json).pid) } catch { }
  }
  if ($managedPid) {
    $managed = Get-CimInstance Win32_Process -Filter "ProcessId=$managedPid" -ErrorAction SilentlyContinue
    if ($managed -and $managed.CommandLine -like "*$fixture*Run-Board.ps1*") { & taskkill.exe /PID $managedPid /T /F | Out-Null }
  }
  if (Test-Path -LiteralPath $fixture) {
    $resolved = (Resolve-Path -LiteralPath $fixture).Path
    $temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $resolved.StartsWith($temporaryRoot, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path $resolved -Leaf) -notlike 'jaami-manual-start-test-*') { throw 'Unsafe fixture cleanup path.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
  }
}
