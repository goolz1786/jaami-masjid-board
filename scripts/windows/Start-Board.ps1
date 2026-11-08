$ErrorActionPreference = 'Stop'
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $ProjectRoot
$runtime = Join-Path $ProjectRoot '.board-runtime'
$pidFile = Join-Path $runtime 'board.pid.json'
New-Item -ItemType Directory -Path $runtime -Force | Out-Null

function Start-BoardWatchdog {
  try {
    $watchdog = Get-ScheduledTask -TaskName 'Jaami Masjid Display Watchdog' -ErrorAction SilentlyContinue
    if ($watchdog -and $watchdog.State -ne 'Running') { Start-ScheduledTask -TaskName $watchdog.TaskName -ErrorAction Stop }
  } catch { Write-Warning 'The watchdog could not be started. Start the watchdog task as administrator.' }
}

try {
  if ((Invoke-WebRequest -UseBasicParsing 'http://localhost:3000/api/state' -TimeoutSec 3).StatusCode -eq 200) {
    Start-BoardWatchdog
    Write-Host 'Board is already running: http://localhost:3000/display/main' -ForegroundColor Green
    exit 0
  }
} catch { }

if (-not (Test-Path 'dist\server\index.js')) { throw 'Production build is missing. Run Setup-Board.ps1.' }
if (-not (Test-Path '.env')) { throw '.env is missing. Run Setup-Board.ps1.' }
$launchId = '{0}-{1}' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), [Guid]::NewGuid().ToString('N').Substring(0, 8)
$stdout = Join-Path $runtime "launcher-$launchId.log"
$stderr = Join-Path $runtime "launcher-error-$launchId.log"
$runner = Join-Path $PSScriptRoot 'Run-Board.ps1'
$process = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$runner`"") -WorkingDirectory $ProjectRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
@{ pid = $process.Id; projectRoot = $ProjectRoot.Path; startedAt = (Get-Date).ToString('o') } | ConvertTo-Json | Set-Content $pidFile -Encoding utf8

$deadline = (Get-Date).AddMinutes(2)
do {
  try { $ready = (Invoke-WebRequest -UseBasicParsing 'http://localhost:3000/api/state' -TimeoutSec 5).StatusCode -eq 200 } catch { $ready = $false }
  if (-not $ready) { Start-Sleep -Seconds 2 }
} until ($ready -or (Get-Date) -gt $deadline -or $process.HasExited)
if (-not $ready) {
  if (Test-Path -LiteralPath $pidFile) { Remove-Item -LiteralPath $pidFile -Force }
  throw "The board did not start. Review $stderr and the newest board-error-*.log in $runtime."
}
Start-BoardWatchdog
Write-Host 'Jaami Masjid board is running.' -ForegroundColor Green
Write-Host 'Display: http://localhost:3000/display/main'
Write-Host 'Admin:   http://localhost:3000/admin/login'
