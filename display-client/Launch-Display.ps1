$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$installDirectory = Split-Path -Parent $PSCommandPath
$configPath = Join-Path $installDirectory 'display-client.json'
$profilePath = Join-Path $installDirectory 'EdgeProfile'
$logPath = Join-Path $installDirectory 'display-client.log'

function Write-ClientLog([string]$Message) {
  "$(Get-Date -Format o) $Message" | Add-Content -LiteralPath $logPath -Encoding utf8
}

function Get-EdgePath {
  $candidates = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
  )
  return $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}

function Wait-ForServer([string]$StateUrl, [int]$Seconds = 300) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  do {
    try {
      if ((Invoke-WebRequest -UseBasicParsing -Uri $StateUrl -TimeoutSec 5).StatusCode -eq 200) { return $true }
    } catch { }
    Start-Sleep -Seconds 3
  } until ((Get-Date) -ge $deadline)
  return $false
}

function Wait-ForSecondMonitor([int]$Seconds = 180) {
  Add-Type -AssemblyName System.Windows.Forms
  $deadline = (Get-Date).AddSeconds($Seconds)
  do {
    $screen = [System.Windows.Forms.Screen]::AllScreens |
      Where-Object { -not $_.Primary } |
      Sort-Object DeviceName |
      Select-Object -First 1
    if ($screen) { return $screen }
    Start-Sleep -Seconds 3
  } until ((Get-Date) -ge $deadline)
  return $null
}

if (-not (Test-Path -LiteralPath $configPath)) { throw "Display client configuration is missing: $configPath" }
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$edge = Get-EdgePath
if (-not $edge) { throw 'Microsoft Edge is not installed.' }
New-Item -ItemType Directory -Path $profilePath -Force | Out-Null

while ($true) {
  if (-not (Wait-ForServer $config.stateUrl)) {
    Write-ClientLog "Server unavailable: $($config.stateUrl)"
    exit 1
  }
  $screen = Wait-ForSecondMonitor
  if (-not $screen) {
    Write-ClientLog 'A second monitor was not detected within three minutes.'
    exit 1
  }

  $bounds = $screen.Bounds
  Write-ClientLog "Opening $($config.displayUrl) on $($screen.DeviceName) at $($bounds.X),$($bounds.Y), size $($bounds.Width)x$($bounds.Height)."
  $arguments = @(
    "--kiosk=$($config.displayUrl)",
    '--edge-kiosk-type=fullscreen',
    "--window-position=$($bounds.X),$($bounds.Y)",
    "--window-size=$($bounds.Width),$($bounds.Height)",
    "--user-data-dir=`"$profilePath`"",
    '--no-first-run',
    '--disable-session-crashed-bubble',
    '--overscroll-history-navigation=0'
  )
  Start-Process -FilePath $edge -ArgumentList $arguments | Out-Null
  Start-Sleep -Seconds 5
  do {
    $edgeIsRunning = Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.CommandLine -and $_.CommandLine.Contains($profilePath) } |
      Select-Object -First 1
    if ($edgeIsRunning) { Start-Sleep -Seconds 10 }
  } while ($edgeIsRunning)
  Write-ClientLog 'The dedicated Edge window closed; restarting the display in five seconds.'
  Start-Sleep -Seconds 5
}
