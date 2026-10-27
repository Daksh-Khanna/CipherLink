$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectRoot
try {
  # Trust forwarded TLS headers only on this loopback-only origin.
  $env:HOST = '127.0.0.1'
  $env:PORT = '3001'
  $env:ALLOW_INSECURE_HTTP = 'false'
  $env:TRUST_PROXY = '1'
  npm run start -w server
  exit $LASTEXITCODE
} finally { Pop-Location }
