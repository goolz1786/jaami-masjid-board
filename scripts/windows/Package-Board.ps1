[CmdletBinding()]
param(
  [string]$Destination,
  [string]$Name
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

if (-not $Destination) { $Destination = Join-Path $root 'outputs' }
$Destination = [IO.Path]::GetFullPath($Destination)
New-Item -ItemType Directory -Path $Destination -Force | Out-Null

if (-not $Name) {
  $Name = "JaamiMasjidBoard-Update-$(Get-Date -Format 'yyyyMMdd-HHmm')"
}

$staging = Join-Path ([IO.Path]::GetTempPath()) ("jmb-package-" + [Guid]::NewGuid().ToString('N'))
$target = Join-Path $staging $Name
New-Item -ItemType Directory -Path $target -Force | Out-Null

$excludedDirectories = @(
  'node_modules', '.next', '.vinext', '.wrangler', '.board-data',
  '.board-runtime', 'dist', 'tmp', 'work', 'output', 'outputs', 'sites', 'backups', '.git', 'uploads', 'media'
)
$excludedFiles = @('.env', '.env.*', '.dev.vars*', '*.tsbuildinfo', '*.zip')

Write-Host "Collecting application files from $root" -ForegroundColor Cyan
$robocopyArguments = @(
  $root, $target, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/R:1', '/W:1',
  '/XD'
) + @($excludedDirectories | ForEach-Object { Join-Path $root $_ }) + @('/XF') + $excludedFiles
& robocopy.exe @robocopyArguments | Out-Null
if ($LASTEXITCODE -ge 8) {
  throw "Collecting the application files failed (robocopy exit code $LASTEXITCODE)."
}

Copy-Item -LiteralPath (Join-Path $root '.env.example') -Destination (Join-Path $target '.env.example')

$archive = Join-Path $Destination ($Name + '.zip')
if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }

Write-Host 'Creating the ZIP archive...' -ForegroundColor Cyan
. (Join-Path $PSScriptRoot 'Board-Archive.ps1')
# ZipArchive includes hidden configuration/assets that Compress-Archive may omit.
New-VerifiedBoardArchive -SourcePath $staging -ArchivePath $archive | Out-Null
$resolvedStaging = (Resolve-Path -LiteralPath $staging).Path
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
if (-not $resolvedStaging.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path $resolvedStaging -Leaf) -notlike 'jmb-package-*') { throw 'Unexpected staging cleanup path.' }
Remove-Item -LiteralPath $resolvedStaging -Recurse -Force

$sizeMb = [math]::Round((Get-Item -LiteralPath $archive).Length / 1MB, 1)
Write-Host ''
Write-Host "Package created: $archive ($sizeMb MB)" -ForegroundColor Green
Write-Host 'Extract it on the server and run UPGRADE-WINDOWS.cmd (existing install) or INSTALL-WINDOWS.cmd (new PC).'
