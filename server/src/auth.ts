import jwt from 'jsonwebtoken';
import type { PrismaClient } from '@prisma/client';
import type { RequestHandler } from 'express';
export type Identity = { userId: string; sessionId: string; expiresAt: number };
declare global {
  namespace Express {
    interface Request {
      identity: Identity;
    }
  }
}
export function authService(db: PrismaClient, secret: string) {
  const verify = async (token: string): Promise<Identity> => {
    const data = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'cipherlink',
      audience: 'cipherlink-mobile',
    });
    if (typeof data === 'string' || !data.sub || typeof data.jti !== 'string')
      throw new Error('Invalid session.');
    const session = await db.session.findUnique({ where: { id: data.jti } });
    if (!session || session.userId !== data.sub || session.expiresAt.getTime() <= Date.now())
      throw new Error('Session expired.');
    return {
      userId: session.userId,
      sessionId: session.id,
      expiresAt: Math.min(session.expiresAt.getTime(), (data.exp || 0) * 1000),
    };
  };
  const issue = async (userId: string) => {
    const session = await db.session.create({
      data: { userId, expiresAt: new Date(Date.now() + 7 * 86400000) },
    });
    return jwt.sign({}, secret, {
      algorithm: 'HS256',
      subject: userId,
      jwtid: session.id,
      expiresIn: '7d',
      issuer: 'cipherlink',
      audience: 'cipherlink-mobile',
    });
  };
  const middleware: RequestHandler = async (req, res, next) => {
    try {
      req.identity = await verify(req.headers.authorization?.replace(/^Bearer /, '') || '');
      next();
    } catch {
      res.status(401).json({ error: 'Please log in again.' });
    }
  };
  return { verify, issue, middleware };
}
