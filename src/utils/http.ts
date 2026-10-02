import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { fn(req, res).catch(next); };

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
  if (err instanceof ZodError) {
    const msg = err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(' | ');
    return res.status(400).json({ error: 'بيانات غير صحيحة', details: msg });
  }
  if ((err as any)?.name === 'CastError') return res.status(400).json({ error: 'معرّف غير صحيح' });
  console.error(err);
  res.status(500).json({ error: 'حصل خطأ في السيرفر' });
}
