[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$clients = @(
  @{ Task = 'Jaami Masjid Main Display Client'; Directory = 'JaamiMasjidDisplayClient-main' },
  @{ Task = 'Jaami Masjid Community Display Client'; Directory = 'JaamiMasjidDisplayClient-community' },
  @{ Task = 'Jaami Masjid Display Client'; Directory = 'JaamiMasjidDisplayClient' }
)

foreach ($client in $clients) {
  $installDirectory = Join-Path $env:LOCALAPPDATA $client.Directory
  $profilePath = Join-Path $installDirectory 'EdgeProfile'
  Stop-ScheduledTask -TaskName $client.Task -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $client.Task -Confirm:$false -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine.Contains($profilePath) } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

  if (Test-Path -LiteralPath $installDirectory) {
    Remove-Item -LiteralPath $installDirectory -Recurse -Force
  }
}
Write-Host 'The automatic Main and Community display clients were removed.' -ForegroundColor Green
