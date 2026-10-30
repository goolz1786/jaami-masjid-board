[CmdletBinding()]
param([string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path)
$ErrorActionPreference = 'Stop'
$envPath = Join-Path $ProjectRoot '.env'
if (Test-Path -LiteralPath $envPath) { return }

function Read-PlainPassword([string]$Prompt) {
  $value = Read-Host $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($value)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
function Quote-EnvValue([string]$Value) {
  if ($Value.Contains("`r") -or $Value.Contains("`n")) { throw 'Configuration values must be single-line.' }
  foreach ($delimiter in @("'", [string][char]96, '"')) {
    if (-not $Value.Contains($delimiter) -and -not ($delimiter -eq '"' -and ($Value.Contains('\n') -or $Value.Contains('\r')))) {
      return $delimiter + $Value.Replace('$', '\$') + $delimiter
    }
  }
  throw 'Omit at least one kind of quote character from the credential so it can be stored safely.'
}
$username = Read-Host 'Admin username [admin]'
if ([string]::IsNullOrWhiteSpace($username)) { $username = 'admin' }
if ($username.Length -gt 128) { throw 'The username must be 128 characters or fewer.' }
do {
  $password = Read-PlainPassword 'Create a unique admin password (12 to 1024 characters)'
  $confirm = Read-PlainPassword 'Confirm the password'
  $valid = $password.Length -ge 12 -and $password.Length -le 1024 -and $password -eq $confirm -and $password -notin @('replace-with-a-unique-password', 'change-this-before-production')
  if (-not $valid) { Write-Host 'Use matching, unique passwords of 12 to 1024 characters.' -ForegroundColor Yellow }
} until ($valid)
$bytes = New-Object byte[] 48
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
$secret = [Convert]::ToBase64String($bytes)
[IO.File]::WriteAllLines($envPath, @(
  "ADMIN_USERNAME=$(Quote-EnvValue $username.Trim())",
  "ADMIN_PASSWORD=$(Quote-EnvValue $password)",
  "SESSION_SECRET=$(Quote-EnvValue $secret)"
), [Text.UTF8Encoding]::new($false))
$password = $confirm = $secret = $null
Write-Host 'Created the local administrator configuration.' -ForegroundColor Green
