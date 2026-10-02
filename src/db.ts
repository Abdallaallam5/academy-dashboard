import mongoose from 'mongoose';
import { config } from './config';

export async function connectDb(): Promise<() => Promise<void>> {
  let uri = config.mongoUri;
  let stop = async () => {};

  if (uri === 'memory') {
    if (config.isProd) throw new Error('وضع memory للتجربة فقط، حدد MONGODB_URI حقيقي');
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mem = await MongoMemoryServer.create();
    uri = mem.getUri('academy');
    stop = async () => { await mem.stop(); };
    console.log('⚠️  قاعدة بيانات مؤقتة في الذاكرة (البيانات هتضيع عند الإيقاف)');
  }

  await mongoose.connect(uri);
  console.log('✅ متصل بقاعدة البيانات');
  return async () => { await mongoose.disconnect(); await stop(); };
}
