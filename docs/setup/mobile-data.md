# Mobile-data connection with the PC running

Prepared and checked locally: an HTTPS-proxy-aware backend listens only on `127.0.0.1:3001`. Unforwarded HTTP is rejected, authenticated endpoints reject missing sessions, and native Settings can verify a new address while preserving the current device identity and contact pins. The official Cloudflare tunnel client was downloaded from its GitHub release and its published SHA-256 digest verified.

The user explicitly approved the temporary Cloudflare connection on 27 October 2026 after automatic approval review blocked the initial attempt. The approved tunnel is now running. External HTTPS health returned 200 and an unauthenticated protected endpoint returned 401. Both Android clients moved to the public origin with their existing identities and contact trust. With USB backend forwarding removed and no phone Wi-Fi address, encrypted messages were sent and decrypted in both directions. A phone app restart retained the public address, session and decryptable old/new history. The user physically unplugged the phone and confirmed audible voice in both directions, then confirmed both video and audio worked unplugged. The test call ended, native camera/audio resources were released, and temporary PC audio settings were restored. These results establish the tested phone/carrier and PC network combination; a public TURN relay remains necessary for some other restrictive networks.

## What becomes public

Cloudflare Quick Tunnel creates a temporary HTTPS/WSS `trycloudflare.com` origin that proxies the local application backend. Login/registration and health become Internet-reachable. User discovery and encrypted messages still require authentication and membership authorization. Cloudflare terminates TLS and proxies API/session traffic. End-to-end message encryption remains on the devices; private identity keys are never uploaded. Quick Tunnel has no uptime guarantee or stable hostname.

The backend and tunnel must keep running on the PC with Internet access. Turning off the PC or stopping the tunnel stops remote connectivity. WebRTC media uses ICE/STUN and optional TURN independently of the HTTPS tunnel. Some carrier/restricted networks require a configured public TURN server; the tunnel does not replace a media relay.

## Start after approval

From `D:\Daksh\CipherLink`, run in two terminals:

```powershell
npm run start:server
```

```powershell
npm run start:tunnel
```

The tunnel script uses the verified local `artifacts/tools/cloudflared.exe` or an installed official `cloudflared`. The URL is printed to its terminal and logged in ignored `artifacts/mobile-data-tunnel.log`. Avoid starting two tunnel instances unintentionally. No Windows service or router port forwarding is required.

The tunnel is configured for HTTP/2 over IPv4. The origin trusts forwarded TLS headers only because it binds exclusively to loopback. Never change that public origin to `0.0.0.0` while retaining proxy trust. Its JWT secret and database are loaded from the existing ignored server environment; the original accounts remain intact.

## Move the Android clients

1. Keep each client signed in. Open Profile → **Server connection**.
2. Enter the temporary `https://…trycloudflare.com` address.
3. Tap **Connect to this address**. The client authenticates the existing session at the new address and checks user ID, username and public key before linking its local identity realm. Existing private keys and pinned contact keys remain in secure storage.
4. Repeat on the other Android client, so both use the same server process/origin.
5. Confirm previous conversation history still decrypts. Send messages both ways.
6. Remove the ADB backend forwarding and verify messages and calls. Finally unplug the physical phone and verify again on mobile data, with Wi-Fi off.

Changing an address through this authenticated Settings flow preserves keys. Simply selecting a different origin on the welcome screen treats it as a separate server unless it was linked earlier. Do not clear app storage or regenerate identity keys to solve an address problem.

The hostname changes when the Quick Tunnel is restarted. While still signed in, Settings can verify and link the replacement address, including when the old endpoint is offline. A stable hostname or hosted backend is preferable for long-term operation. If the session has expired and the old endpoint is gone, reconnect through the original local/USB setup to sign in before linking another server address.

## Stop

Stop the tunnel terminal to close public access. Stop the backend server terminal when done. The application remains installed, but it cannot exchange messages without a reachable backend. The local SQLite database and device identities are retained.

References: [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/), [WebSocket support](https://developers.cloudflare.com/network/websockets/).
