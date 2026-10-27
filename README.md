# CipherLink

An Android communication app for the VIT Computer Networks group project, **Secure Mobile Communication App**.

| Student | Registration |
| --- | --- |
| Daksh Khanna | 24BYB0125 |
| Harjot Singh Bagga | 24BYB0115 |
| Tanuj Sharma | 24BYB0122 |

Implemented: registration/login, user discovery, one-to-one encrypted text messaging, Socket.IO delivery, encrypted history, contact fingerprints, unread/read state, typing, and native WebRTC voice/video call flows with incoming-call acceptance/rejection and media controls. The dark graphite UI uses emerald accents and native navigation.

**Readiness:** the standalone APK supports ARM64 phones and the x86_64 emulator. Galaxy S24 FE/emulator checks passed registration, encrypted messaging, persistence, voice and video calls; the user confirmed audible two-way speech and working video/audio. Native audio routing and speaker control are implemented. See [implementation status](docs/implementation-status.md) for exact evidence and remaining checks. No academic reports or PDFs were created.

## Stack and layout

Expo SDK 57 with React Native 0.86, TypeScript, React Navigation, Axios, Socket.IO, `react-native-webrtc`, Expo SecureStore and Expo Crypto. Backend: Node.js, Express 5, Socket.IO, Prisma 6 and SQLite. Client encryption: TweetNaCl `nacl.box` (Curve25519 + XSalsa20-Poly1305).

```text
mobile/       Android React Native client, screens, secure storage, WebRTC
server/       REST API, sessions, call signaling, SQLite schema and migrations
shared/       Strict message envelope types and client encryption
scripts/      Environment setup, brand assets, standalone APK build
docs/         Architecture, setup, test checklist and implementation status
```

The server stores ciphertext and public keys, never client private keys or decrypted message bodies. Media travels through WebRTC rather than Socket.IO. See the [architecture diagram and security design](docs/architecture/system.md).

## Local setup (PowerShell)

From `D:\Daksh\CipherLink`:

```powershell
npm ci
# Needed when npm blocks dependency lifecycle scripts:
npm rebuild @prisma/client @prisma/engines prisma esbuild --foreground-scripts
npm run setup:env
npm run db:setup
npm run dev:server
```

`setup:env` generates a random JWT secret into ignored `server/.env` and a detected IP into ignored `mobile/.env`, preserving existing files. Pass the actual Wi-Fi IP if autodetection selects a VPN/virtual adapter:

```powershell
node scripts/setup-env.mjs 192.168.1.5
```

Because existing files are preserved, edit `mobile/.env` manually if it already exists. No real credentials belong in source control. SQLite data lives at `server/prisma/dev.db`. A fresh database is created and migrations are applied by `db:setup`; do not delete a database containing accounts you want to keep.

Backend health from another PowerShell window:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health
```

The backend binds `0.0.0.0:3000`. Phones must use the PC's reachable LAN address, never the phone's `localhost`. The welcome screen lets you set the backend origin before login. To move an existing account, use Profile → Server connection while signed in: the app verifies the account at the new address and preserves device keys and trusted contacts. Unlinked origins have separate secure storage. Both users must connect to the same backend. See [mobile-data connection setup](docs/setup/mobile-data.md) for the prepared public connection option and its approval requirement.

For compiled backend startup:

```powershell
npm run build:server
npm run start -w server
```

Build emits `server/dist/index.cjs` and a source map. The shared crypto package is bundled; runtime packages and the generated Prisma client must remain installed. Run startup from the workspace so the server's `.env` is loaded.

## Android development and standalone APK

**Expo Go is not supported.** WebRTC requires the custom native build. First install the Android toolchain as described in [Android setup and build instructions](docs/setup/android.md), then:

```powershell
npm run android
# Separate terminal, if Metro is not already running:
npm run dev:mobile
```

Keep the backend running. The development client needs Metro on port 8081. Generate an installable APK with bundled JavaScript after the toolchain is installed:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-apk.ps1
adb install -r .\artifacts\CipherLink.apk
```

The script builds the generated Gradle `release` variant, signed with its **local debug signing configuration**, and copies it to `artifacts/CipherLink.apk`. It does not create a production-signed release. It does not require a connected device to build. The APK runs without Metro but still needs the configured backend. No signing material is committed.

`npm run export:android -w mobile` validates a JavaScript/Hermes bundle only; its `mobile/dist` output is **not an APK**. `npm run prebuild -w mobile` regenerates native configuration; it is **not a compiled Android application**.

## Connect two phones

1. Start the backend, install the custom build on both phones and connect to the same Wi-Fi. Confirm each phone can open `http://YOUR_PC_IP:3000/api/health` in its browser. Use the same origin on the welcome screen.
2. Create account A on phone A and B on phone B. Each phone persists its own encryption identity. Discover B by username and start a conversation.
3. Send from A and reply from B. Open the conversation to see delivery acknowledgments. Disconnect B, send from A, reconnect B and open history. Compare fingerprints by tapping the contact name and viewing Profile on the other device.
4. Tap the phone icon, accept on B, and verify actual audio in both directions. Test mute and hang-up. Repeat using the camera icon and verify live remote video, camera toggle/switch and microphone control.
5. Log out/in on the original phones and restart the app. Check that old history decrypts. Do not clear app storage or uninstall while testing identity persistence.
6. Build the standalone APK, stop Metro, and repeat the user journey. Use [the device testing checklist](docs/testing/checklist.md) to record outcomes.

Use `npm exec -w server -- prisma studio` to inspect encrypted Message rows while checking message storage. Do not expose Prisma Studio publicly.

## Networking and deployment

`server/.env` supports `HOST`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `ALLOW_INSECURE_HTTP`, `STUN_URLS`, `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL`. STUN and TURN URL lists are comma-separated. ICE configuration is delivered through an authenticated endpoint. TURN credentials are therefore available to authenticated clients; use limited/short-lived credentials on a real deployment.

`mobile/.env` supports `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_ALLOW_INSECURE_HTTP`. Socket.IO uses the configured API origin. Use Profile → Server connection to preserve an existing signed-in identity when changing addresses. Expo public variables are bundled into the application and must not contain secrets.

LAN HTTP is explicitly opt-in on server and Android builds and displays a UI notice. It **does not secure login traffic or first-contact public-key retrieval against network attackers**. Use it only for a trusted development LAN. For secure deployment, set both insecure flags to `false`, rebuild native Android configuration, and use HTTPS/WSS behind a correctly configured TLS reverse proxy. Set `TRUST_PROXY=1` only when the backend is reachable solely through the trusted proxy. A forged forwarded-protocol header must not be able to bypass that proxy. Do not publish the development server directly.

Example TURN configuration (replace placeholders in the private environment):

```dotenv
STUN_URLS=stun:stun.l.google.com:19302
TURN_URLS=turn:turn.example.com:3478,turns:turn.example.com:5349
TURN_USERNAME=YOUR_LIMITED_USERNAME
TURN_CREDENTIAL=YOUR_SECRET
```

STUN alone is insufficient on many mobile/carrier or restricted networks. Media uses direct peer transport or a TURN relay according to ICE negotiation, with DTLS-SRTP encryption. Foreground calling is the only supported lifecycle. There is no background/terminated-app incoming-call integration. Native call-audio management requests communication-mode focus and restores the prior audio session on cleanup. Voice calls offer a speaker/earpiece toggle; video defaults to speaker routing.

## Validation

```powershell
npm test
npm run typecheck
npm run build:server
npm exec -w mobile -- expo install --check
npm exec -w mobile -- expo-doctor
npm run export:android -w mobile
```

Tests use an isolated temporary SQLite database, real HTTP/WebSocket sockets and three independent accounts, then remove their test data. They verify encryption, tamper rejection, authentication, membership, real-time delivery, ciphertext persistence, duplicates, offline/reconnect history, session revocation and authorized call signaling. Signaling tests use synthetic SDP/ICE fixtures and do not prove live media. Restricted execution sandboxes may need network permission even for loopback.

## Security limits and troubleshooting

Static encryption identities have no forward secrecy, key recovery or multi-device support. Contact trust is initially supplied by the server, so compare fingerprints independently. The server sees account/contact/timing/address metadata. Signaling is not independently verified with messaging identity keys. See [the full threat-model notes](docs/architecture/system.md).

- **Backend unreachable:** verify LAN IP, same Wi-Fi, firewall, VPN routing and access-point client isolation. Changing the bundled default URL requires restarting Metro; runtime welcome-screen changes do not.
- **Windows Firewall:** if a phone health request fails, allow inbound TCP 3000 on your private network; allow TCP 8081 for development Metro. Make a specific private-network rule rather than disabling the firewall.
- **Missing native module / Expo Go error:** install the custom Android build with `npm run android`, then connect it to Metro.
- **Missing SDK/ADB:** follow `docs/setup/android.md`. Native compilation cannot proceed with Node alone.
- **Identity key missing:** use the original app installation. Server credentials cannot recover message keys. Do not regenerate a replacement and expect old history to decrypt.
- **Changed contact identity:** communication is blocked. Verify with the person through a trusted channel; there is no automatic reset.
- **Call never connects:** keep apps foreground, check microphone/camera permissions, avoid isolated Wi-Fi, then configure TURN for remote or restrictive networks.
- **Failed send:** tap the failed bubble to retry the same encrypted envelope. Failed outgoing messages are not durable across leaving the screen or restarting the app.
- **Configuration drift:** rerun prebuild after plugin/config changes. Native folders are generated and ignored, so EAS source uploads regenerate them.

The repository is implementation work only. Assessment 8, 9 and 0 documents, PDFs and presentations are intentionally absent.
