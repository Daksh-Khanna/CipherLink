# CipherLink implementation status

Device checks: 27 October 2026. Source checks: 28 October 2026. This records implementation and testing, not an academic assessment report.

## Working application

- Standalone Android APK: `artifacts/CipherLink.apk`, 74,606,632 bytes, ARM64 and x86_64. JavaScript is bundled; Metro is not required. Local debug signing is used for this build.
- Registration/login, device-bound identity keys, encrypted messaging/history, fingerprints and trust-on-first-use contact key checks.
- Express/Socket.IO backend, Prisma/SQLite storage, revocable sessions, conversation authorization and ciphertext-only message storage.
- Native WebRTC voice/video, mute, speaker/earpiece selection, camera toggle/switch and media cleanup.
- Signed-in server-address changes verify the account and preserve device keys and contact trust.

## Completed verification

- Latest automated run: **20 tests passed**. Formatting, TypeScript checks for all workspaces and the backend build passed.
- Code quality improvements include consistent formatting, shared call-event types, guarded React contexts, centralized HTTP error handling and safe concurrent message retries. Regression tests reproduced the oversized-request and duplicate-insert failures before their fixes. A GitHub workflow is configured to run the checks; its first hosted execution is pending publication.
- Backend tests cover authentication, authorization, encrypted delivery/history, duplicate IDs, tamper rejection, session revocation and call signaling. Identity-store tests cover address aliases and conflicting identities.
- APK installation/runtime passed on a Galaxy S24 FE (Android 16), Galaxy A8+ (Android 9) and API 37 emulator.
- Two physical phones exchanged messages in both directions. The user confirmed video and audio work on both phones.
- Mobile-data checks passed without USB backend forwarding. The user confirmed voice and video/audio worked with the phone unplugged.
- Restarts and original-device re-login retained decryptable history. Pending mute/camera choices and native media cleanup were verified.
- Test screenshots, old APKs, installation archives, historical build logs and one-off device-test helpers were removed after validation.

## Running CipherLink

The PC hosts the backend. An explicitly approved temporary Cloudflare tunnel provides HTTPS/WSS access. Keep the PC, backend and tunnel running. Restarting a Quick Tunnel creates a new address; update both phones through Profile → Server connection while signed in. See [mobile-data setup](setup/mobile-data.md).

Ignored `artifacts/` retains the current APK, Cloudflare executable/release checksum metadata, active process logs and saved address. The two physical phones' login details remain in `artifacts/device-test-account.json` and `artifacts/second-phone-account.json`. Private identity keys remain on the phones. Local environments and database contents were retained.

## Limits and follow-up

- Calls require foreground apps. Background notifications/calling, password reset, key recovery/rotation, multi-device identities, durable offline outbox and multi-server scaling are not implemented.
- No public TURN relay is configured. The tested networks work; restrictive networks may require TURN.
- Static identity keys have no forward secrecy. Initial contact trust is TOFU; compare fingerprints independently. Call media identity is not independently bound to messaging identity keys.
- LAN HTTP is a development option. Public use requires HTTPS/WSS. The public origin is loopback-only and trusts the tunnel's forwarded TLS headers.
- The last full dependency audit was not clean: Expo tooling had transitive node-forge and Zod advisories. Application validators use Zod 4.6.7; a deepmerge-ts override addresses the Prisma dependency finding. Earlier zero backend production findings do not mean the full workspace audit is clean. Review current advisories before production deployment.
- React Native Directory flags WebRTC as untested on the New Architecture despite successful local builds/device tests. Regenerate native projects after config/plugin changes and retain signing continuity when updating installed apps.

See [architecture](architecture/system.md), [Android setup](setup/android.md) and [test checklist](testing/checklist.md). No academic reports, presentations or PDFs have been generated.
