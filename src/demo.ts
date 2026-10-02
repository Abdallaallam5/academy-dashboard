// تشغيل سريع للعرض: قاعدة بيانات مؤقتة في الذاكرة + بيانات تجريبية جاهزة (npm run demo)
process.env.MONGODB_URI = 'memory';
process.env.SEED_ON_START = 'true';
import('./server').then(m => m.main());
