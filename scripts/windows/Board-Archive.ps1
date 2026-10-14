$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function New-VerifiedBoardArchive {
  param(
    [Parameter(Mandatory)][string]$SourcePath,
    [Parameter(Mandatory)][string]$ArchivePath,
    [string[]]$ExcludedDirectories = @(),
    [string[]]$ExcludedFiles = @()
  )
  $source = (Resolve-Path -LiteralPath $SourcePath).Path.TrimEnd('\', '/')
  $archiveFullPath = [IO.Path]::GetFullPath($ArchivePath)
  # Destination may be the source's excluded backups directory.
  $relativeArchive = if ($archiveFullPath.StartsWith($source + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { $archiveFullPath.Substring($source.Length + 1) } else { $null }
  if ($relativeArchive -and $ExcludedDirectories -notcontains $relativeArchive.Split([IO.Path]::DirectorySeparatorChar)[0]) {
    throw 'The archive destination must be outside the included source folders.'
  }
  $files = [Collections.Generic.List[IO.FileInfo]]::new()
  $pending = [Collections.Generic.Stack[string]]::new()
  $pending.Push($source)
  while ($pending.Count -gt 0) {
    $directory = $pending.Pop()
    foreach ($item in Get-ChildItem -LiteralPath $directory -Force) {
      if ($directory -eq $source -and $item.PSIsContainer -and $ExcludedDirectories -contains $item.Name) { continue }
      if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Cannot safely archive a linked path: $($item.FullName)" }
      if ($item.PSIsContainer) { $pending.Push($item.FullName); continue }
      $excluded = $false
      foreach ($pattern in $ExcludedFiles) { if ($item.Name -like $pattern) { $excluded = $true; break } }
      if (-not $excluded) { $files.Add($item) }
    }
  }
  if ($files.Count -eq 0) { throw 'Nothing was found to back up.' }
  $manifest = [Collections.Generic.List[object]]::new()
  $archive = [IO.Compression.ZipFile]::Open($archiveFullPath, [IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($file in $files) {
      $relative = $file.FullName.Substring($source.Length + 1).Replace('\', '/')
      $expectedHash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relative, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
      $manifest.Add([pscustomobject]@{ path = $relative; sha256 = $expectedHash; bytes = $file.Length })
    }
  } finally { $archive.Dispose() }

  $archive = [IO.Compression.ZipFile]::OpenRead($archiveFullPath)
  try {
    foreach ($record in $manifest) {
      $entry = $archive.GetEntry($record.path)
      if (-not $entry -or $entry.Length -ne $record.bytes) { throw "Backup entry missing or incomplete: $($record.path)" }
      $stream = $entry.Open()
      $sha = [Security.Cryptography.SHA256]::Create()
      try { $actualHash = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '') }
      finally { $stream.Dispose(); $sha.Dispose() }
      if ($actualHash -ne $record.sha256) { throw "Backup verification failed: $($record.path)" }
    }
  } finally { $archive.Dispose() }
  Write-Host "Verified $($manifest.Count) files in $archiveFullPath" -ForegroundColor Green
  return $archiveFullPath
}
