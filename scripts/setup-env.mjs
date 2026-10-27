import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { networkInterfaces } from 'node:os';
const addresses = Object.values(networkInterfaces())
  .flat()
  .filter((x) => x && x.family === 'IPv4' && !x.internal);
const host =
  process.argv[2] ||
  addresses.find((x) => !x.address.startsWith('172.27.'))?.address ||
  'YOUR_LAN_IP';
if (!existsSync('server/.env'))
  writeFileSync(
    'server/.env',
    `DATABASE_URL="file:./dev.db"\nJWT_SECRET=${randomBytes(48).toString('hex')}\nHOST=0.0.0.0\nPORT=3000\nALLOW_INSECURE_HTTP=true\nSTUN_URLS=stun:stun.l.google.com:19302\nTURN_URLS=\nTURN_USERNAME=\nTURN_CREDENTIAL=\n`,
  );
if (!existsSync('mobile/.env'))
  writeFileSync(
    'mobile/.env',
    `EXPO_PUBLIC_API_URL=http://${host}:3000\nEXPO_PUBLIC_ALLOW_INSECURE_HTTP=true\n`,
  );
console.log(
  `Configuration ready. Verify the phone can reach http://${host}:3000/api/health. Existing files were preserved.`,
);
