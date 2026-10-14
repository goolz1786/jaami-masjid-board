[CmdletBinding()]
param([string]$Url = 'http://localhost:3000/display/main')

$deadline = (Get-Date).AddMinutes(2)
do {
  try { $ready = (Invoke-WebRequest -UseBasicParsing 'http://localhost:3000/api/state' -TimeoutSec 5).StatusCode -eq 200 } catch { $ready = $false }
  if (-not $ready) { Start-Sleep -Seconds 2 }
} until ($ready -or (Get-Date) -ge $deadline)
if (-not $ready) { throw 'The display service did not become ready within two minutes.' }

$edge = Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe' }
if (-not (Test-Path $edge)) { throw 'Microsoft Edge was not found.' }
Start-Process -FilePath $edge -ArgumentList "--kiosk=$Url", '--edge-kiosk-type=fullscreen', '--no-first-run' -WindowStyle Maximized
