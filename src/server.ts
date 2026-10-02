import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { config } from './config';
import { connectDb } from './db';
import { requireAuth } from './middleware/auth';
import { accountsRouter } from './routes/accounts';
import { authRouter } from './routes/auth';
import { paymentsRouter } from './routes/payments';
import { studentsRouter, teachersRouter } from './routes/people';
import { sessionsRouter } from './routes/sessions';
import { seedDemo } from './seed';
import { errorHandler } from './utils/http';

export function createApp() {
  const app = express();
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'blob:'],
      },
    },
  }));
  if (!config.isProd) app.use(morgan('dev'));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/auth', authRouter);
  app.use('/api', requireAuth);
  app.use('/api/students', studentsRouter);
  app.use('/api/teachers', teachersRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api', accountsRouter);
  app.use('/api', (_req, res) => { res.status(404).json({ error: 'المسار غير موجود' }); });

  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(errorHandler);
  return app;
}

export async function main() {
  const stop = await connectDb();
  if (config.seedOnStart) {
    try { console.log('🌱 بيانات تجريبية:', await seedDemo()); } catch { console.log('🌱 الداتا بيز فيها بيانات، تخطينا التجريبية'); }
  }
  const server = createApp().listen(config.port, () => console.log(`🚀 http://localhost:${config.port}`));
  const shutdown = () => server.close(() => stop().then(() => process.exit(0)));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
