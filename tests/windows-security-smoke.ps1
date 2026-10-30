$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\scripts\windows\Protect-BoardInstallation.ps1')

$acl = New-BoardDirectoryAcl
$rules = @($acl.Access | ForEach-Object { @{ Sid = $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value; Rights = $_.FileSystemRights } })
if (-not $acl.AreAccessRulesProtected) { throw 'Installation ACL must block inherited user write grants.' }
if ($rules.Count -ne 3) { throw 'Unexpected installation principals.' }
foreach ($sid in @('S-1-5-18', 'S-1-5-32-544')) {
  if (-not ($rules | Where-Object { $_.Sid -eq $sid -and $_.Rights -eq [Security.AccessControl.FileSystemRights]::FullControl })) { throw 'Administrators and SYSTEM need full access.' }
}
$service = $rules | Where-Object { $_.Sid -eq 'S-1-5-19' }
if (($service.Rights -band [Security.AccessControl.FileSystemRights]::Write) -ne 0) { throw 'Service must not be able to rewrite executable code.' }
$rejected = $false
try { Protect-BoardInstallation -Path $env:TEMP } catch { $rejected = $true }
if (-not $rejected) { throw 'Arbitrary user-writable installation locations must be rejected.' }
Write-Host 'Windows security policy smoke passed; no installation ACLs were changed.'

$fixture = Join-Path ([IO.Path]::GetTempPath()) ('board-link-test-' + [Guid]::NewGuid().ToString('N'))
try {
  New-Item -ItemType Directory -Path (Join-Path $fixture 'target'), (Join-Path $fixture 'installed') -Force | Out-Null
  $link = Join-Path $fixture 'installed\node_modules'
  New-Item -ItemType Junction -Path $link -Target (Join-Path $fixture 'target') | Out-Null
  $rejected = $false
  try { Get-BoardInstallationItems -Path (Join-Path $fixture 'installed') | Out-Null } catch { $rejected = $true }
  if (-not $rejected) { throw 'Links in backup-excluded folders must be rejected in preflight.' }
  Write-Host 'Nested junction preflight passed.'
} finally {
  # Remove the junction itself first; never recursively delete through it.
  if ($link -and (Test-Path -LiteralPath $link)) { [IO.Directory]::Delete($link) }
  $resolved = [IO.Path]::GetFullPath($fixture)
  $temporary = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
  if (-not $resolved.StartsWith($temporary, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path $resolved -Leaf) -notlike 'board-link-test-*') { throw 'Unexpected fixture cleanup path.' }
  Remove-Item -LiteralPath $resolved -Recurse -Force
}
