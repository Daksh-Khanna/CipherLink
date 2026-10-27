param([ValidateSet('ndk', 'platform', 'cmake')][string[]]$Component = @('ndk', 'platform', 'cmake'))
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'android-env.ps1')
$projectRoot = Split-Path -Parent $PSScriptRoot
$artifactRoot = Join-Path $projectRoot 'artifacts'
New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null
$packages = @{
  ndk = @{ File = 'android-ndk-r27b-windows.zip'; Sha1 = '3bb7efc850cd0af7707854b7e0d5c3b6a7153703'; Destination = 'ndk\27.1.12297006' }
  platform = @{ File = 'platform-36_r02.zip'; Sha1 = '2c1a80dd4d9f7d0e6dd336ec603d9b5c55a6f576'; Destination = 'platforms\android-36' }
  cmake = @{ File = 'cmake-3.22.1-windows.zip'; Sha1 = '292778f32a7d5183e1c49c7897b870653f2d2c1b'; Destination = 'cmake\3.22.1' }
}
# Archive checksums and names come from Google's repository2-3.xml metadata.
$sdkRoot = [IO.Path]::GetFullPath($env:ANDROID_HOME)
foreach ($name in $Component) {
  $package = $packages[$name]
  $destination = [IO.Path]::GetFullPath((Join-Path $sdkRoot $package.Destination))
  if (-not $destination.StartsWith($sdkRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'SDK destination verification failed.' }
  if (Test-Path -LiteralPath (Join-Path $destination 'source.properties')) { Write-Output "$name already installed: $destination"; continue }
  $archive = Join-Path $artifactRoot $package.File
  $archiveValid = (Test-Path -LiteralPath $archive) -and ((Get-FileHash -LiteralPath $archive -Algorithm SHA1).Hash.ToLowerInvariant() -eq $package.Sha1)
  if (-not $archiveValid) {
    & curl.exe --fail --location --no-progress-meter --show-error --retry 5 --retry-delay 2 --continue-at - --output $archive "https://dl.google.com/android/repository/$($package.File)"
    if ($LASTEXITCODE -ne 0) { throw "Download failed: $name. Rerun to resume." }
  }
  if ((Get-FileHash -LiteralPath $archive -Algorithm SHA1).Hash.ToLowerInvariant() -ne $package.Sha1) { throw "Archive checksum mismatch: $name. Archive was not installed." }
  $stagingRoot = [IO.Path]::GetFullPath((Join-Path $sdkRoot ".cipherlink-staging\$name"))
  if (-not $stagingRoot.StartsWith($sdkRoot + '\.cipherlink-staging\', [StringComparison]::OrdinalIgnoreCase)) { throw 'SDK staging verification failed.' }
  New-Item -ItemType Directory -Force -Path $stagingRoot | Out-Null
  Write-Output "Verified $name archive. Extracting into $stagingRoot"
  & tar.exe -xf $archive -C $stagingRoot
  if ($LASTEXITCODE -ne 0) { throw "Archive extraction failed: $name" }
  if (Test-Path -LiteralPath (Join-Path $stagingRoot 'source.properties')) {
    $source = $stagingRoot
  } else {
    $folders = @(Get-ChildItem -LiteralPath $stagingRoot -Directory)
    if ($folders.Count -ne 1) { throw "Expected one package folder for $name." }
    $source = [IO.Path]::GetFullPath($folders[0].FullName)
  }
  if ($source -ne $stagingRoot -and -not $source.StartsWith($stagingRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Package source verification failed.' }
  if (Test-Path -LiteralPath $destination) {
    $otherFiles = @(Get-ChildItem -LiteralPath $destination -Force | Where-Object Name -ne '.installer')
    if ($otherFiles.Count) { throw "Nonempty SDK destination needs inspection: $destination" }
    # Only the verified incomplete package directory is removed, never SDK root.
    Remove-Item -LiteralPath $destination -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
  Write-Output "Installing $source -> $destination"
  Move-Item -LiteralPath $source -Destination $destination
  Write-Output "Installed $name."
}
