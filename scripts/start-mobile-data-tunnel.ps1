$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectRoot
try {
  $localClient = Join-Path $projectRoot 'artifacts\tools\cloudflared.exe'
  $installedClient = Get-Command cloudflared -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $localClient) { $client = $localClient }
  elseif ($installedClient) { $client = $installedClient.Source }
  else { throw 'Install the official cloudflared client first. See docs/setup/mobile-data.md.' }
  & $client tunnel --no-autoupdate --protocol http2 --edge-ip-version 4 --url http://127.0.0.1:3001 --logfile artifacts/mobile-data-tunnel.log
  exit $LASTEXITCODE
} finally { Pop-Location }
