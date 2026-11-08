$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\scripts\windows\Stop-UpgradeRunner.ps1') -LibraryOnly

$script:runner = [pscustomobject]@{ ProcessId=100; CreationDate=[datetime]'2026-01-01' }
$script:candidates = @([pscustomobject]@{ProcessId=101})
$script:owned = $true
$script:killed = $false
function Get-ManagedBoardRunner { param($Root) return $script:runner }
function Get-InstalledBoardProcesses { param($Root) return $script:candidates }
function Test-BoardProcessTree { param($ProcessId, $Runner) return $script:owned }
function Get-UpgradeProcessTree { param($Runner) return @($Runner) }
function Wait-UpgradeProcessTree { param($Processes) }
function taskkill.exe { $script:killed = $true; $global:LASTEXITCODE = 0 }

Stop-UpgradeRunner -Root 'C:\TestBoard' -RequireRunner
if (-not $script:killed) { throw 'The verified process tree was not stopped.' }

$script:killed = $false; $script:owned = $false
try { Stop-UpgradeRunner -Root 'C:\TestBoard' -RequireRunner; throw 'Expected an orphan to be rejected.' }
catch { if ($_.Exception.Message -eq 'Expected an orphan to be rejected.') { throw } }
if ($script:killed) { throw 'An unverified process must prevent any termination.' }

$script:runner = $null; $script:candidates = @()
try { Stop-UpgradeRunner -Root 'C:\TestBoard' -RequireRunner; throw 'Expected missing runner to be rejected.' }
catch { if ($_.Exception.Message -eq 'Expected missing runner to be rejected.') { throw } }
if ($script:killed) { throw 'A missing runner must not trigger a termination.' }

Stop-UpgradeRunner -Root 'C:\TestBoard'
if ($script:killed) { throw 'A stopped board must not trigger a termination.' }
Write-Host 'PASS: upgrade shutdown stops only a verified process tree and rejects an unverified runner or orphan.'
