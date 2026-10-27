import 'dotenv/config';
import { existsSync, mkdirSync, closeSync, openSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
const url = process.env.DATABASE_URL;
if (!url?.startsWith('file:')) throw new Error('Set DATABASE_URL to a SQLite file URL in server/.env.');
const path = resolve('prisma', url.slice(5));
if (!existsSync(path)) { mkdirSync(dirname(path), { recursive: true }); closeSync(openSync(path, 'wx')); }
