# Two-device validation checklist

Automated tests use real REST, Socket.IO, SQLite and shared encryption code. They do not exercise Android views, Android secure storage or live media. The SDP/ICE integration fixtures validate routing and authorization only.

## Before testing

- [ ] Install the custom CipherLink build on two Android phones (or phone + emulator).
- [ ] Use the same reachable server origin on both. Keep the backend running.
- [ ] Connect both to the same non-isolated Wi-Fi and allow TCP 3000; development Metro uses TCP 8081.
- [ ] Open `/api/health` in each phone's browser and confirm `status: ok`.
- [ ] Use two independent accounts created on their respective phones.
- [ ] Keep both apps visible during calling tests.

## Authentication and keys

- [ ] Register A and B. Check duplicate username and password-confirmation errors.
- [ ] Reject invalid login credentials and accept valid credentials.
- [ ] Log out/in on each original device; identity fingerprint remains unchanged.
- [ ] Force-stop/relaunch; the session restores and history decrypts.
- [ ] A different clean device cannot silently replace an existing account's identity.
- [ ] Compare contact fingerprints over a trusted channel.

## Messaging

- [ ] A discovers B, opens a conversation and sends a unique sentence; B sees it immediately and replies.
- [ ] Inspect `Message` rows with `npm exec -w server -- prisma studio`; only ciphertext/nonce/metadata is stored.
- [ ] Check timestamps, typing, unread count and delivery indicators.
- [ ] Disconnect B, send from A, reconnect B, open chat and decrypt history.
- [ ] Interrupt A's connection during send; tap the failed bubble to retry; the ID is reused and only one row remains.
- [ ] Load more than 50 messages through “Load earlier messages”.
- [ ] Verify a changed/tampered ciphertext reports authentication failure.
- [ ] Verify changed contact identity blocks communication.

## Voice

- [ ] A calls B; B sees caller and voice type and accepts.
- [ ] Speak from both phones; verify actual two-way audio.
- [ ] Mute/unmute each microphone and verify the other phone hears the difference.
- [ ] Hang up from each end; Android microphone indicator clears.
- [ ] Decline, busy, no answer (30 seconds), offline peer and permission denial recover cleanly.
- [ ] Disconnect Wi-Fi or background either app; both call interfaces close and tracks stop.

## Video

- [ ] Both local previews show real camera frames; both remote views show the other device live.
- [ ] Verify bidirectional audio during video.
- [ ] Disable/enable camera, mute/unmute and switch front/rear cameras.
- [ ] End from either side; camera and microphone indicators clear.
- [ ] Deny permissions and verify an actionable error without a stuck busy state.

## Deployment

- [ ] Build the standalone APK, stop Metro, launch it and connect to the backend.
- [ ] Test separate networks with HTTPS/WSS and working TURN credentials.
- [ ] Verify failed media negotiation ends with an error, rather than claiming a successful call.
- [ ] Test TURN relay separately; STUN success on one Wi-Fi does not establish remote-network readiness.
- [ ] Record device models, Android versions, build type and observed outcomes before marking any box passed.
