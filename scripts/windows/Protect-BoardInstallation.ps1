$ErrorActionPreference = 'Stop'

function New-BoardDirectoryAcl {
  $acl = [Security.AccessControl.DirectorySecurity]::new()
  $acl.SetAccessRuleProtection($true, $false)
  $acl.SetOwner([Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))
  foreach ($sid in @('S-1-5-18', 'S-1-5-32-544', 'S-1-5-19')) {
    $rights = if ($sid -eq 'S-1-5-19') { 'ReadAndExecute' } else { 'FullControl' }
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
      [Security.Principal.SecurityIdentifier]::new($sid), $rights,
      'ContainerInherit,ObjectInherit', 'None', 'Allow'))
  }
  return $acl
}

function Assert-BoardInstallPath {
  param([Parameter(Mandatory)][string]$Path)
  $root = [IO.Path]::GetFullPath($Path).TrimEnd('\')
  $expected = Join-Path ($env:SystemDrive + '\') 'JaamiMasjidBoard'
  if (-not $root.Equals($expected, [StringComparison]::OrdinalIgnoreCase)) {
    throw "The automatic service must be installed at $expected, outside user-writable parent folders. Existing data was not moved."
  }
  $rootItem = Get-Item -LiteralPath $root -Force
  if (($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'The installation folder must not be a link.' }
  # Include folders omitted from backups, such as node_modules and runtime caches.
  Get-BoardInstallationItems -Path $root | Out-Null
}

function Get-BoardInstallationItems {
  param([Parameter(Mandatory)][string]$Path)
  $root = [IO.Path]::GetFullPath($Path).TrimEnd('\')
  # Inspect before changing ACLs. Do not follow links outside the installation.
  $items = [Collections.Generic.List[object]]::new()
  $pending = [Collections.Generic.Stack[string]]::new()
  $pending.Push($root)
  while ($pending.Count -gt 0) {
    foreach ($item in Get-ChildItem -LiteralPath $pending.Pop() -Force) {
      if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Linked installation path is not supported: $($item.FullName)" }
      $items.Add($item)
      if ($item.PSIsContainer) { $pending.Push($item.FullName) }
    }
  }
  return $items
}

function Protect-BoardInstallation {
  param([Parameter(Mandatory)][string]$Path)
  Assert-BoardInstallPath -Path $Path
  $root = [IO.Path]::GetFullPath($Path).TrimEnd('\')
  $items = @(Get-BoardInstallationItems -Path $root)
  Set-Acl -LiteralPath $root -AclObject (New-BoardDirectoryAcl)
  foreach ($item in $items) {
    if ($item.PSIsContainer) { $acl = New-BoardDirectoryAcl }
    else {
      $acl = [Security.AccessControl.FileSecurity]::new()
      $acl.SetOwner([Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))
      $acl.SetAccessRuleProtection($false, $false)
    }
    # Reset explicit child rules too; inherited permissions alone are insufficient.
    Set-Acl -LiteralPath $item.FullName -AclObject $acl
  }
  foreach ($name in @('.board-data', '.board-runtime', '.wrangler')) {
    $directory = Join-Path $root $name
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $acl = New-BoardDirectoryAcl
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
      [Security.Principal.SecurityIdentifier]::new('S-1-5-19'), 'Modify',
      'ContainerInherit,ObjectInherit', 'None', 'Allow'))
    Set-Acl -LiteralPath $directory -AclObject $acl
    # Data descendants inherit service write access; executable folders stay read-only.
    foreach ($item in Get-ChildItem -LiteralPath $directory -Recurse -Force) {
      $acl = if ($item.PSIsContainer) { [Security.AccessControl.DirectorySecurity]::new() } else { [Security.AccessControl.FileSecurity]::new() }
      $acl.SetOwner([Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))
      $acl.SetAccessRuleProtection($false, $false)
      Set-Acl -LiteralPath $item.FullName -AclObject $acl
    }
  }
}
