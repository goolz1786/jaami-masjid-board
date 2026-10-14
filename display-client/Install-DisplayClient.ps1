[CmdletBinding()]
param(
  [string]$ServerAddress,
  [ValidateSet('Main', 'Community')]
  [string]$DisplayProfile
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$sourceLauncher = Join-Path $PSScriptRoot 'Launch-Display.ps1'

function Get-EdgePath {
  $candidates = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
  )
  return $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}

function Get-DisplayUrls([string]$Address, [string]$Profile) {
  $candidate = $Address.Trim()
  if ([string]::IsNullOrWhiteSpace($candidate)) { throw 'A server IP address or hostname is required.' }
  $hasScheme = $candidate -match '^https?://'
  if (-not $hasScheme) { $candidate = "http://$candidate" }
  try { $builder = [UriBuilder]::new($candidate) } catch { throw 'Enter a valid server IP address, hostname, or URL.' }
  if ($builder.Scheme -notin @('http', 'https') -or [string]::IsNullOrWhiteSpace($builder.Host)) {
    throw 'Only an HTTP or HTTPS server address is supported.'
  }
  $originalAuthority = ([uri]$candidate).Authority
  if ($builder.Scheme -eq 'http' -and $originalAuthority -notmatch ':\d+$') { $builder.Port = 3000 }
  $route = if ($Profile -eq 'Community') { '/display/community' } else { '/display/main' }
  $builder.Path = $route
  $builder.Query = ''
  $builder.Fragment = ''
  $displayUrl = $builder.Uri.AbsoluteUri.TrimEnd('/')
  $builder.Path = '/api/state'
  return @{ displayUrl = $displayUrl; stateUrl = $builder.Uri.AbsoluteUri.TrimEnd('/') }
}

if (-not (Test-Path -LiteralPath $sourceLauncher)) { throw "Missing launcher: $sourceLauncher" }
$edge = Get-EdgePath
if (-not $edge) { throw 'Microsoft Edge is required. Install Edge and run this setup again.' }

if ([string]::IsNullOrWhiteSpace($ServerAddress)) {
  $ServerAddress = Read-Host 'Enter the display-board server IP address or hostname'
}
if ([string]::IsNullOrWhiteSpace($DisplayProfile)) {
  do {
    $profileChoice = (Read-Host 'Choose display type: M for Main (landscape) or C for Community (portrait)').Trim().ToUpperInvariant()
  } until ($profileChoice -in @('M', 'C'))
  $DisplayProfile = if ($profileChoice -eq 'C') { 'Community' } else { 'Main' }
}

$profileSlug = $DisplayProfile.ToLowerInvariant()
$taskName = "Jaami Masjid $DisplayProfile Display Client"
$installDirectory = Join-Path $env:LOCALAPPDATA "JaamiMasjidDisplayClient-$profileSlug"
$installedLauncher = Join-Path $installDirectory 'Launch-Display.ps1'
$configPath = Join-Path $installDirectory 'display-client.json'
$profilePath = Join-Path $installDirectory 'EdgeProfile'
$urls = Get-DisplayUrls $ServerAddress $DisplayProfile

Write-Host "Checking $($urls.stateUrl)..." -ForegroundColor Cyan
try {
  $response = Invoke-WebRequest -UseBasicParsing -Uri $urls.stateUrl -TimeoutSec 15
  if ($response.StatusCode -ne 200) { throw "HTTP $($response.StatusCode)" }
} catch {
  throw "The server could not be reached at $($urls.stateUrl). Confirm the IP address, firewall, and server installation, then try again."
}

Add-Type -AssemblyName System.Windows.Forms
$screens = [System.Windows.Forms.Screen]::AllScreens
if ($screens.Count -lt 2) {
  Write-Host 'Only one monitor is currently detected. Setup will continue; the launcher will wait for a second monitor at logon.' -ForegroundColor Yellow
} else {
  $target = $screens | Where-Object { -not $_.Primary } | Sort-Object DeviceName | Select-Object -First 1
  Write-Host "Second monitor detected: $($target.DeviceName), $($target.Bounds.Width)x$($target.Bounds.Height) at $($target.Bounds.X),$($target.Bounds.Y)." -ForegroundColor Green
}

Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine.Contains($profilePath) } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null
Copy-Item -LiteralPath $sourceLauncher -Destination $installedLauncher -Force
@{
  displayUrl = $urls.displayUrl
  stateUrl = $urls.stateUrl
  displayProfile = $DisplayProfile
  installedAt = (Get-Date).ToString('o')
} | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding utf8

$powerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$action = New-ScheduledTaskAction -Execute $powerShell -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$installedLauncher`"" -WorkingDirectory $installDirectory
$trigger = New-ScheduledTaskTrigger -AtLogOn -User ([Security.Principal.WindowsIdentity]::GetCurrent().Name)
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Keeps the Jaami Masjid $DisplayProfile board fullscreen on the second monitor." -Force | Out-Null

Start-ScheduledTask -TaskName $taskName
Write-Host ''
Write-Host 'Display client setup complete.' -ForegroundColor Green
Write-Host "Display type: $DisplayProfile"
Write-Host "Display URL: $($urls.displayUrl)"
Write-Host 'It will start automatically on the first non-primary monitor whenever this user signs in.'
Write-Host 'Rerun this setup to change the server address or display type.'
