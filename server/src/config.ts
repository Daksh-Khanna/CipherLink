import 'dotenv/config';
import { z } from 'zod';
export function config() {
  const env = z
    .object({
      JWT_SECRET: z.string().min(64),
      PORT: z.coerce.number().default(3000),
      HOST: z.string().default('0.0.0.0'),
      ALLOW_INSECURE_HTTP: z.enum(['true', 'false']).default('false'),
    })
    .parse(process.env);
  const urls = (s?: string) =>
    s
      ?.split(',')
      .map((v) => v.trim())
      .filter(Boolean) || [];
  const iceServers: { urls: string[]; username?: string; credential?: string }[] = [];
  const stun = urls(process.env.STUN_URLS);
  if (stun.length) iceServers.push({ urls: stun });
  const turn = urls(process.env.TURN_URLS);
  if (turn.length && (!process.env.TURN_USERNAME || !process.env.TURN_CREDENTIAL))
    throw new Error('TURN credentials are required when TURN_URLS is set.');
  if (turn.length)
    iceServers.push({
      urls: turn,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  return { ...env, iceServers };
}
