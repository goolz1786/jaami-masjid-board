$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ('jaami-upgrade-test-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixtureRoot | Out-Null

# Simulate service operations; never touch the real Windows task or firewall.
function Get-ScheduledTask {
  param($TaskName, $ErrorAction)
  if ($global:jaamiUpgradeScenario -in @('precopy-backup-failure', 'unsafe-orphan')) { return [pscustomobject]@{ TaskName=$TaskName; State='Running' } }
  return $null
}
function Stop-ScheduledTask {
  param($TaskName, $ErrorAction)
  if ($TaskName -eq 'Jaami Masjid Display Service') { $global:jaamiServiceStopped = $true }
  if ($TaskName -eq 'Jaami Masjid Display Service' -and $global:jaamiUpgradeScenario -eq 'managed-stop-order' -and -not $global:jaamiTreeStopped) {
    throw 'The scheduled task was stopped before its managed process tree.'
  }
}
function Start-ScheduledTask { param($TaskName, $ErrorAction) if ($null -ne $global:jaamiUpgradeStarts) { $global:jaamiUpgradeStarts.Add($TaskName) } }
function Get-NetTCPConnection { param($LocalPort, $State, $ErrorAction) return $null }
function Assert-Equal($actual, $expected, [string]$message) { if ($actual -ne $expected) { throw $message } }

try {
  foreach ($scenario in @('success', 'installer-failure', 'missing-config', 'precopy-backup-failure', 'managed-stop-order', 'unsafe-orphan')) {
    $global:jaamiUpgradeScenario = $scenario
    $global:jaamiUpgradeStarts = [Collections.Generic.List[string]]::new()
    $global:jaamiTreeStopped = $false
    $global:jaamiServiceStopped = $false
    $scenarioRoot = Join-Path $fixtureRoot $scenario
    $install = Join-Path $scenarioRoot 'installed'
    $source = Join-Path $scenarioRoot 'update'
    foreach ($folder in @($install, $source)) {
      New-Item -ItemType Directory -Path (Join-Path $folder 'scripts\windows'), (Join-Path $folder '.board-data'), (Join-Path $folder 'uploads') -Force | Out-Null
      [IO.File]::WriteAllText((Join-Path $folder 'package.json'), '{"name":"test-board"}')
    }
    [IO.File]::WriteAllText((Join-Path $install '.env'), 'ADMIN_PASSWORD=existing-test-password')
    [IO.File]::WriteAllText((Join-Path $install '.board-data\existing.sqlite'), 'existing notices, users and schedules')
    [IO.File]::WriteAllText((Join-Path $install '.board-data\hidden-blob'), 'existing uploaded blob')
    (Get-Item -LiteralPath (Join-Path $install '.board-data\hidden-blob') -Force).Attributes = [IO.FileAttributes]::Hidden
    [IO.File]::WriteAllText((Join-Path $install 'uploads\poster.pdf'), 'existing uploaded poster')
    [IO.File]::WriteAllText((Join-Path $install 'app-marker.txt'), 'previous app')
    [IO.File]::WriteAllText((Join-Path $install 'scripts\windows\Stop-Board.ps1'), 'return')
    [IO.File]::WriteAllText((Join-Path $source '.env'), 'ADMIN_PASSWORD=must-not-replace')
    [IO.File]::WriteAllText((Join-Path $source '.board-data\existing.sqlite'), 'must-not-replace')
    [IO.File]::WriteAllText((Join-Path $source 'uploads\poster.pdf'), 'must-not-replace')
    [IO.File]::WriteAllText((Join-Path $source 'app-marker.txt'), 'updated app')
    New-Item -ItemType Directory -Path (Join-Path $source 'app\api\media') -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $source 'app\api\media\route.ts'), 'application media route')
    $installer = if ($scenario -eq 'installer-failure') { 'exit 12' } else { 'exit 0' }
    [IO.File]::WriteAllText((Join-Path $source 'scripts\windows\Install-Board.ps1'), $installer)
    # ACL policy is tested separately; this fixture exercises preservation in TEMP.
    [IO.File]::WriteAllText((Join-Path $source 'scripts\windows\Protect-BoardInstallation.ps1'), 'function Assert-BoardInstallPath { param($Path) }')
    [IO.File]::WriteAllText((Join-Path $source 'scripts\windows\Stop-UpgradeRunner.ps1'), 'param($InstallPath) $global:jaamiTreeStopped = $true')
    if ($scenario -eq 'unsafe-orphan') { [IO.File]::WriteAllText((Join-Path $source 'scripts\windows\Stop-UpgradeRunner.ps1'), 'param($InstallPath) throw "Synthetic unexpected board process"') }
    Copy-Item -LiteralPath (Join-Path $root 'scripts\windows\Backup-Board.ps1'), (Join-Path $root 'scripts\windows\Board-Archive.ps1') -Destination (Join-Path $source 'scripts\windows')
    if ($scenario -eq 'precopy-backup-failure') { [IO.File]::WriteAllText((Join-Path $source 'scripts\windows\Backup-Board.ps1'), 'throw "Synthetic backup failure"') }

    # Change only the elevation check in the test copy. Execute all original
    # validation, backup, copy, installer exit handling and error paths.
    $original = Get-Content -LiteralPath (Join-Path $root 'scripts\windows\Upgrade-Board.ps1') -Raw
    $tokens = $null; $errors = $null
    $ast = [Management.Automation.Language.Parser]::ParseInput($original, [ref]$tokens, [ref]$errors)
    $admin = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Test-Administrator' }, $true)
    $testScript = $original.Substring(0, $admin.Extent.StartOffset) + 'function Test-Administrator { return $true }' + $original.Substring($admin.Extent.EndOffset)
    $scriptPath = Join-Path $source 'scripts\windows\Upgrade-Board.ps1'
    [IO.File]::WriteAllText($scriptPath, $testScript)
    if ($scenario -eq 'missing-config') { Remove-Item -LiteralPath (Join-Path $install '.env') }
    $failed = $false
    try { & $scriptPath -InstallPath $install -SourcePath $source } catch { $failed = $true }
    Assert-Equal $failed ($scenario -notin @('success', 'managed-stop-order')) "$scenario returned the wrong success/failure result."
    if ($scenario -eq 'managed-stop-order' -and -not $global:jaamiTreeStopped) { throw 'The upgrade did not stop the managed process tree before the scheduled task.' }
    Assert-Equal ([IO.File]::ReadAllText((Join-Path $install '.board-data\existing.sqlite'))) 'existing notices, users and schedules' "$scenario changed the database."
    Assert-Equal ([IO.File]::ReadAllText((Join-Path $install 'uploads\poster.pdf'))) 'existing uploaded poster' "$scenario changed uploads."
    if ($scenario -in @('missing-config', 'precopy-backup-failure', 'unsafe-orphan')) {
      Assert-Equal ([IO.File]::ReadAllText((Join-Path $install 'app-marker.txt'))) 'previous app' 'Missing credentials must stop before copying.'
      if ($scenario -eq 'precopy-backup-failure') {
        Assert-Equal ($global:jaamiUpgradeStarts -join '|') 'Jaami Masjid Display Service|Jaami Masjid Display Watchdog' 'A pre-copy failure must restart both previously running tasks.'
        Write-Host 'PASS: a pre-copy failure restores the prior board and watchdog tasks.'
      }
      if ($scenario -eq 'unsafe-orphan') {
        if ($global:jaamiServiceStopped) { throw 'An unexpected process must not stop the running board task.' }
        Write-Host 'PASS: unexpected board processes abort before stopping the service or replacing files.'
      }
      continue
    }
    Assert-Equal ([IO.File]::ReadAllText((Join-Path $install '.env'))) 'ADMIN_PASSWORD=existing-test-password' "$scenario replaced credentials."
    Assert-Equal ([IO.File]::ReadAllText((Join-Path $install 'app-marker.txt'))) 'updated app' 'Application update was not copied.'
    Assert-Equal ([IO.File]::ReadAllText((Join-Path $install 'app\api\media\route.ts'))) 'application media route' 'Root upload exclusions must not omit application media routes.'
    $backup = @(Get-ChildItem -LiteralPath (Join-Path $install 'backups') -Filter '*.zip')
    Assert-Equal $backup.Count 1 'Expected exactly one rollback backup.'
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($backup[0].FullName)
    try {
      foreach ($entry in @('.env', '.board-data/existing.sqlite', '.board-data/hidden-blob', 'uploads/poster.pdf', 'app-marker.txt')) {
        if (-not $zip.GetEntry($entry)) { throw "Backup missing $entry" }
      }
      $reader = [IO.StreamReader]::new($zip.GetEntry('app-marker.txt').Open())
      try { Assert-Equal $reader.ReadToEnd() 'previous app' 'Backup did not preserve the previous application.' } finally { $reader.Dispose() }
    } finally { $zip.Dispose() }
    Write-Host "PASS: $scenario retains credentials, database, hidden blobs, uploads and a rollback snapshot."
  }
} finally {
  $resolved = (Resolve-Path -LiteralPath $fixtureRoot).Path
  $temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
  if (-not $resolved.StartsWith($temporaryRoot, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path $resolved -Leaf) -notlike 'jaami-upgrade-test-*') { throw 'Unsafe test cleanup path.' }
  Remove-Item -LiteralPath $resolved -Recurse -Force
}
