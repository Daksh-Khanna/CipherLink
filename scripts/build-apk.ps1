param([string]$Architecture = 'arm64-v8a')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'android-env.ps1')
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectRoot
try {
  if (-not $env:ANDROID_HOME -or -not (Test-Path -LiteralPath $env:ANDROID_HOME)) {
    throw 'Set ANDROID_HOME to an installed Android SDK. See docs/setup/android.md.'
  }
  npm run prebuild -w mobile
  if ($LASTEXITCODE -ne 0) { throw 'Expo prebuild failed.' }
  Push-Location -LiteralPath (Join-Path $projectRoot 'mobile\android')
  try {
    # Release bundles JavaScript; the generated project uses its local debug
    # signing configuration. This build uses local signing; configure release signing for distribution.
    & .\gradlew.bat assembleRelease "-PreactNativeArchitectures=$Architecture"
    if ($LASTEXITCODE -ne 0) { throw 'Gradle APK build failed.' }
  } finally { Pop-Location }
  $target = Join-Path $projectRoot 'artifacts'
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  Copy-Item -LiteralPath 'mobile\android\app\build\outputs\apk\release\app-release.apk' -Destination (Join-Path $target 'CipherLink.apk')
  Write-Output "Standalone CipherLink APK: $target\CipherLink.apk (local debug signing; no Metro required)."
} finally { Pop-Location }
