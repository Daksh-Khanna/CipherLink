import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { createApplication } from './app';
const db = new PrismaClient();
const settings = config();
const { http, io, closeSockets } = createApplication(db, settings);
http.listen(settings.PORT, settings.HOST, () => {
  console.log(`CipherLink backend listening on ${settings.HOST}:${settings.PORT}`);
  if (settings.ALLOW_INSECURE_HTTP === 'true')
    console.log('Trusted LAN development mode: HTTP authentication transport is unencrypted.');
});
async function shutdown() {
  closeSockets();
  io.close();
  http.close();
  await db.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
