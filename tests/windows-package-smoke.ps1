$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('jaami-package-test-' + [Guid]::NewGuid().ToString('N'))
try {
  $source = Join-Path $fixture 'source'
  $destination = Join-Path $fixture 'result'
  New-Item -ItemType Directory -Path (Join-Path $source 'scripts\windows'), (Join-Path $source 'sites'), (Join-Path $source 'output'), (Join-Path $source 'app\api\media') -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $root 'scripts\windows\Package-Board.ps1'), (Join-Path $root 'scripts\windows\Board-Archive.ps1') -Destination (Join-Path $source 'scripts\windows')
  [IO.File]::WriteAllText((Join-Path $source '.env.example'), 'example')
  [IO.File]::WriteAllText((Join-Path $source '.env'), 'private')
  [IO.File]::WriteAllText((Join-Path $source 'sites\private.txt'), 'unrelated')
  [IO.File]::WriteAllText((Join-Path $source 'output\private.txt'), 'unrelated')
  [IO.File]::WriteAllText((Join-Path $source 'app\api\media\route.ts'), 'application route')
  & (Join-Path $source 'scripts\windows\Package-Board.ps1') -Destination $destination -Name 'board-test'
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [IO.Compression.ZipFile]::OpenRead((Join-Path $destination 'board-test.zip'))
  try {
    $names = @($zip.Entries | ForEach-Object { $_.FullName })
    foreach ($private in @('board-test/.env', 'board-test/sites/private.txt', 'board-test/output/private.txt')) {
      if ($names -contains $private) { throw "Package includes unrelated or private file: $private" }
    }
    if ($names -notcontains 'board-test/app/api/media/route.ts') { throw 'Package omitted application media route.' }
    if ($names -notcontains 'board-test/.env.example') { throw 'Package omitted example configuration.' }
  } finally { $zip.Dispose() }
  Write-Host 'PASS: package excludes local data and unrelated folders while keeping app files.'
} finally {
  if (Test-Path -LiteralPath $fixture) {
    $resolved = (Resolve-Path -LiteralPath $fixture).Path
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $resolved.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path $resolved -Leaf) -notlike 'jaami-package-test-*') { throw 'Unsafe cleanup path.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
  }
}
