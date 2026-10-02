import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';

export const config = {
  isProd,
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGODB_URI || 'memory',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-please-change',
  adminUser: process.env.ADMIN_USER || 'admin',
  adminPass: process.env.ADMIN_PASS || 'admin123',
  academyName: process.env.ACADEMY_NAME || 'الأكاديمية',
  seedOnStart: process.env.SEED_ON_START === 'true',
};

if (isProd && (config.jwtSecret === 'dev-secret-please-change' || config.adminPass === 'admin123')) {
  throw new Error('غيّر JWT_SECRET و ADMIN_PASS في ملف .env قبل التشغيل على السيرفر');
}
