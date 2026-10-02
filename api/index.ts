import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../src/server';
import { connectDb } from '../src/db';

// Vercel serverless: نعمل اتصال واحد بالداتا بيز ونعيد استخدامه بين الطلبات
const app = createApp();
let ready: Promise<unknown> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  ready ??= connectDb().catch(e => { ready = null; throw e; });
  try {
    await ready;
  } catch (e) {
    console.error('DB connection failed', e);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'مفيش اتصال بالداتا بيز، راجع MONGODB_URI و Network Access في Atlas' }));
    return;
  }
  app(req as any, res as any);
}
