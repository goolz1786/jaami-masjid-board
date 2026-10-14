$ErrorActionPreference = 'Stop'
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $ProjectRoot
if (-not (Test-Path '.env')) { throw 'Run Setup-Board.ps1 first.' }
$runtime = Join-Path $ProjectRoot '.board-runtime'
$pidFile = Join-Path $runtime 'board.pid.json'
$logFile = Join-Path $runtime 'board.log'
$errorFile = Join-Path $runtime 'board-error.log'
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
try {
  if ((Get-Item -LiteralPath $logFile -ErrorAction SilentlyContinue).Length -gt 2MB) {
    Move-Item -LiteralPath $logFile -Destination "$logFile.old" -Force
  }
  if ((Get-Item -LiteralPath $errorFile -ErrorAction SilentlyContinue).Length -gt 2MB) {
    Move-Item -LiteralPath $errorFile -Destination "$errorFile.old" -Force
  }
} catch { }
"===== Board start $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') (pid $PID) =====" |
  Add-Content -LiteralPath $logFile -Encoding utf8
@{ pid = $PID; projectRoot = $ProjectRoot.Path; startedAt = (Get-Date).ToString('o') } |
  ConvertTo-Json | Set-Content $pidFile -Encoding utf8

$exitCode = 1
try {
  npx.cmd wrangler dev --config wrangler.local.jsonc --ip 0.0.0.0 --port 3000 --persist-to .board-data --env-file .env --show-interactive-dev-session false *>> $logFile
  $exitCode = $LASTEXITCODE
  "===== Board exited (pid $PID, exit code $exitCode) $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') =====" |
    Add-Content -LiteralPath $logFile -Encoding utf8
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
