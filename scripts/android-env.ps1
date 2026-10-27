$ErrorActionPreference = 'Stop'
if (-not $env:ANDROID_HOME) {
  $sdkCandidates = @((Join-Path $env:LOCALAPPDATA 'Android\Sdk'), (Join-Path $env:USERPROFILE 'AppData\Local\Android\Sdk'))
  foreach ($sdkCandidate in $sdkCandidates) { if (Test-Path -LiteralPath $sdkCandidate) { $env:ANDROID_HOME = $sdkCandidate; break } }
}
if (-not $env:ANDROID_HOME -or -not (Test-Path -LiteralPath $env:ANDROID_HOME)) {
  throw 'Android SDK not found. Set ANDROID_HOME to the SDK Location shown in Android Studio SDK Manager.'
}
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
if (-not $env:JAVA_HOME -or -not (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin\java.exe'))) {
  # AGP's native tooling fails under Studio's Java 25 runtime. Prefer a JDK 17
  # provisioned by Gradle before falling back to Studio's bundled runtime.
  $cachedJdkRoot = Join-Path $env:USERPROFILE '.gradle\jdks'
  $cachedJava17 = Get-ChildItem -LiteralPath $cachedJdkRoot -Directory -Filter '*-17-*' -ErrorAction SilentlyContinue |
    Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'bin\java.exe') } | Select-Object -First 1
  if ($cachedJava17) { $env:JAVA_HOME = $cachedJava17.FullName }
  else {
    $studioHomes = @('C:\Program Files\Android\Android Studio', 'D:\AndriodStudio')
    foreach ($studioHome in $studioHomes) {
      $javaCandidate = Join-Path $studioHome 'jbr'
      if (Test-Path -LiteralPath (Join-Path $javaCandidate 'bin\java.exe')) { $env:JAVA_HOME = $javaCandidate; break }
    }
  }
}
if (-not $env:JAVA_HOME) { throw 'Java not found. Set JAVA_HOME to Android Studio''s jbr directory or a compatible JDK.' }
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
