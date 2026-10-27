import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (res.headersSent) {
    _next(error);
    return;
  }
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: error.issues[0]?.message || 'Invalid input.' });
    return;
  }
  if (error instanceof ApiError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    res.status(409).json({ error: 'Username or identity key already registered.' });
    return;
  }
  if (error instanceof Error && 'type' in error) {
    if (error.type === 'entity.too.large') {
      res.status(413).json({ error: 'Request body is too large.' });
      return;
    }
    if (error.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Invalid JSON.' });
      return;
    }
  }
  console.error('Request failed:', error instanceof Error ? error.name : 'Unknown error');
  res.status(500).json({ error: 'The server could not complete this request.' });
};
