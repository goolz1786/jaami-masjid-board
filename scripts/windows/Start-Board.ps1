$ErrorActionPreference = 'Stop'
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $ProjectRoot
$runtime = Join-Path $ProjectRoot '.board-runtime'
$pidFile = Join-Path $runtime 'board.pid.json'
New-Item -ItemType Directory -Path $runtime -Force | Out-Null

try {
  if ((Invoke-WebRequest -UseBasicParsing 'http://localhost:3000/api/state' -TimeoutSec 3).StatusCode -eq 200) {
    Write-Host 'Board is already running: http://localhost:3000/display/main' -ForegroundColor Green
    exit 0
  }
} catch { }

if (-not (Test-Path 'dist\server\index.js')) { throw 'Production build is missing. Run Setup-Board.ps1.' }
if (-not (Test-Path '.env')) { throw '.env is missing. Run Setup-Board.ps1.' }
$stdout = Join-Path $runtime 'board.log'
$stderr = Join-Path $runtime 'board-error.log'
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
  throw "The board did not start. Review $stderr"
}
Write-Host 'Jaami Masjid board is running.' -ForegroundColor Green
Write-Host 'Display: http://localhost:3000/display/main'
Write-Host 'Admin:   http://localhost:3000/admin/login'
