[CmdletBinding()]
param([string]$Destination, [string]$InstallPath, [switch]$NoRestart)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Board-Archive.ps1')
if (-not $InstallPath) { $InstallPath = Join-Path $PSScriptRoot '..\..' }
$projectRoot = (Resolve-Path -LiteralPath $InstallPath).Path
$dataPath = Join-Path $projectRoot '.board-data'
if (-not (Test-Path -LiteralPath $dataPath -PathType Container)) { throw 'No Windows board data exists yet.' }
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot '.env') -PathType Leaf)) { throw 'The existing .env configuration is missing. Backup stopped.' }
if (-not $Destination) { $Destination = Join-Path $projectRoot 'backups' }
$backupDirectory = [IO.Path]::GetFullPath($Destination)
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
$archive = Join-Path $backupDirectory ("jaami-masjid-board-$(Get-Date -Format 'yyyyMMdd-HHmmss')-$([Guid]::NewGuid().ToString('N').Substring(0,8)).zip")

$task = Get-ScheduledTask -TaskName 'Jaami Masjid Display Service' -ErrorAction SilentlyContinue
$wasRunning = $task -and $task.State -eq 'Running'
$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($listener) { $wasRunning = $true }
if ($wasRunning) { & (Join-Path $projectRoot 'scripts\windows\Stop-Board.ps1') }
if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
  throw 'Port 3000 is still in use. Stop the board before creating its backup.'
}
try {
  $snapshot = New-VerifiedBoardArchive -SourcePath $projectRoot -ArchivePath $archive -ExcludedDirectories @(
    'node_modules', '.git', '.wrangler', '.board-runtime', 'outputs', 'backups', 'tmp', 'work', '.next', '.vinext'
  )
} finally {
  if ($wasRunning -and -not $NoRestart) {
    if ($task) { Start-ScheduledTask -TaskName $task.TaskName }
    else { & (Join-Path $projectRoot 'scripts\windows\Start-Board.ps1') }
  }
}
Write-Host 'Backup contains .env, .board-data, uploaded files and the previous application/build. Keep it private.' -ForegroundColor Yellow
Write-Output $snapshot
