$ErrorActionPreference = 'Stop'
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $ProjectRoot
if (-not (Test-Path '.env')) { throw 'Run Setup-Board.ps1 first.' }
$runtime = Join-Path $ProjectRoot '.board-runtime'
$pidFile = Join-Path $runtime 'board.pid.json'
$instanceId = '{0}-{1}-{2}' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), $PID, [Guid]::NewGuid().ToString('N').Substring(0, 8)
$logFile = Join-Path $runtime "board-$instanceId.log"
$errorFile = Join-Path $runtime "board-error-$instanceId.log"
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
"===== Board start $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') (pid $PID) =====" |
  Add-Content -LiteralPath $logFile -Encoding utf8
@{ pid = $PID; projectRoot = $ProjectRoot.Path; startedAt = (Get-Date).ToString('o') } |
  ConvertTo-Json | Set-Content $pidFile -Encoding utf8

$exitCode = 1
try {
  # Wrangler's local explorer can read and modify D1/R2 without app login.
  $env:X_LOCAL_EXPLORER = 'false'
  $env:X_LOCAL_OBSERVABILITY = 'false'
  $env:WRANGLER_LOG_PATH = Join-Path $runtime 'wrangler-logs'
  $env:MINIFLARE_REGISTRY_PATH = Join-Path $ProjectRoot '.wrangler\registry'
  $env:WRANGLER_SEND_METRICS = 'false'
  # Native stderr may contain ordinary warnings. In Windows PowerShell 5,
  # ErrorActionPreference=Stop would otherwise abort this launcher on stderr.
  $previousErrorPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    npx.cmd wrangler dev --config wrangler.local.jsonc --ip 0.0.0.0 --port 3000 --persist-to .board-data --env-file .env --show-interactive-dev-session false --log-level warn 2>&1 |
      Out-File -LiteralPath $logFile -Encoding utf8 -Append
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorPreference
  }
  "===== Board exited (pid $PID, exit code $exitCode) $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') =====" |
    Add-Content -LiteralPath $logFile -Encoding utf8
  # The board should run continuously. Even a clean worker exit is unexpected;
  # report failure so the scheduled task's configured restart policy applies.
  if ($exitCode -eq 0) {
    $exitCode = 1
    'Worker exited unexpectedly; returning failure for scheduled-task recovery.' |
      Add-Content -LiteralPath $logFile -Encoding utf8
  }
} catch {
  $_ | Out-String | Add-Content -LiteralPath $errorFile -Encoding utf8
  "===== Board crashed (pid $PID) $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') =====" |
    Add-Content -LiteralPath $logFile -Encoding utf8
} finally {
  if (Test-Path -LiteralPath $pidFile) {
    try {
      $record = Get-Content $pidFile -Raw | ConvertFrom-Json
      if ([int]$record.pid -eq $PID) { Remove-Item -LiteralPath $pidFile -Force }
    } catch { }
  }
}
exit $exitCode
