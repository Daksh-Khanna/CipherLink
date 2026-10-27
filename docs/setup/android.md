# Android setup on this Windows machine

Android Studio is installed at `D:\AndriodStudio`, with the SDK at `C:\Users\Daksh\AppData\Local\Android\Sdk`. API 36, Build-Tools 35.0.0/36.0.0, NDK 27.1.12297006 and CMake 3.22.1 are installed. The standalone ARM64 APK has been built successfully. See the status file for the latest actual device results.

`npm run android` and `scripts/build-apk.ps1` detect the standard SDK location and prefer Gradle's provisioned Java 17 automatically, without changing your global environment. Studio's bundled Java 25 caused restricted-native-access failures in this project's Android tooling; Java 17 resolved them. Explicit `ANDROID_HOME` and `JAVA_HOME` values still take precedence. The manual setup below is useful for a different machine or nonstandard installation.

## Install the toolchain

1. Install [Android Studio](https://developer.android.com/studio) and open its SDK Manager. Choose an SDK directory and note its absolute path.
2. Install Android SDK Platform **36**, Build-Tools **36.0.0**, Platform-Tools, Android SDK Command-line Tools (latest), NDK **27.1.12297006**, and CMake **3.22.1**. These versions are taken from this project's installed React Native/Expo Gradle configuration; Gradle can request additional matching components.
3. Use a Gradle-compatible JDK. JDK 17 is the conservative Android setup recommendation; Android Studio's configured JDK is another option. The existing JDK 25 installation has not been used to compile this app. Do not point `JAVA_HOME` at the Oracle `javapath` shim directory.
4. Set environment variables in a PowerShell terminal, adjusting the actual directories:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\YOUR_JDK_17_DIRECTORY'
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
java -version
adb version
& "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" --licenses
```

Persist the actual values in Windows Environment Variables after confirming they work. Never overwrite the entire system PATH with only these additions.

5. Enable Developer Options and USB Debugging on a phone, connect USB and accept its RSA authorization prompt. Run `adb devices -l`; it should show `device`, not `unauthorized`. Alternatively create/start an Android Virtual Device in Android Studio Device Manager. Prefer two real phones for camera/audio verification.

Official reference: [Expo Android environment setup](https://docs.expo.dev/workflow/android-studio-emulator/).

## Development build

```powershell
Set-Location D:\Daksh\CipherLink
npm ci
npm rebuild @prisma/client @prisma/engines prisma esbuild --foreground-scripts
npm run db:setup
npm run dev:server
```

In a second configured PowerShell terminal:

```powershell
Set-Location D:\Daksh\CipherLink
npm run android
```

This prebuilds, compiles and installs a custom development client and starts Metro. On subsequent launches use `npm run dev:mobile`. Development builds require Metro, whereas the standalone APK below bundles JavaScript.

## Standalone CipherLink APK (no Metro)

```powershell
Set-Location D:\Daksh\CipherLink
powershell -ExecutionPolicy Bypass -File .\scripts\build-apk.ps1
adb install -r .\artifacts\CipherLink.apk
```

The default architecture is `arm64-v8a`, typical for modern Android phones. To build an x86_64 emulator artifact use `-Architecture x86_64`; use a comma-separated list for multiple architectures. The script builds Gradle's release variant using the generated local debug signing configuration. This is a standalone **locally signed build**, not a Play Store release or production-signed artifact. Keep generated signing keys private. Switching signing keys for an existing package can require uninstalling, which destroys this app's device identity; keep the same installation while testing persistence.

Generated output: `D:\Daksh\CipherLink\artifacts\CipherLink.apk` (74,606,632 bytes), containing both ARM64 and x86_64 native libraries. The build script defaults to ARM64 only for a smaller phone APK; pass `-Architecture 'arm64-v8a,x86_64'` to reproduce the dual-architecture output. Raw Gradle output is `mobile\android\app\build\outputs\apk\release\app-release.apk`. Consult the status file for completed device checks and operating limits.

The app's welcome screen can change the server origin without rebuilding. A build with cleartext networking disabled cannot connect to an HTTP server; set `EXPO_PUBLIC_ALLOW_INSECURE_HTTP=true` in `mobile/.env` and regenerate/build only for trusted LAN testing. The backend is a separate running service. Do not use `localhost` on a physical phone; an emulator can use `10.0.2.2` to reach the host.

For the tested USB setup, explicitly forward the backend to each client:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" -s YOUR_DEVICE_SERIAL reverse tcp:3000 tcp:3000
```

With that tunnel configured, the app can use `http://127.0.0.1:3000`. This is an explicit exception to the normal LAN-address rule: the phone's loopback port is forwarded to the PC. The tunnel must be restored after reconnecting/restarting ADB, and the backend must keep running. Keep the same configured origin for an existing account; identity storage is scoped by origin and username. The test accounts created during device validation use the USB-forwarded loopback origin.

Google Play Protect may ask whether to send this locally built APK for a security check. Review that choice on the phone. CipherLink's build scripts do not disable Play Protect or select a global unknown-app upload preference.

## Native compatibility notes

The app uses Expo 57.0.31 and React Native 0.86.3 after diagnostics identified a Hermes memory regression in SDK 56. Native modules are aligned through `expo install`. WebRTC 124.0.7 uses config plugin 15.0.2, whose installed peer range accepts Expo >=56. SDK 57 native compilation and APK packaging now pass on this machine with Java 17. Two physical Android phones passed live video/audio and encrypted messaging checks. React Native Directory flags WebRTC as untested on the New Architecture; that warning remains enabled.

`mobile/metro.config.js` maps WebRTC's legacy `event-target-shim/index` import to the package's public entry point. TypeScript uses file resolution for that upstream subpath. Native modules are deduplicated to avoid compiling incompatible copies. Run `expo-doctor` after changes and follow the status file for outstanding checks.
