import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { paymentRoutes } from './routes/payments.js';

dotenv.config();

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get('/health', async () => ({
  status: 'UP',
  service: 'sur-payments-api',
  timestamp: new Date().toISOString(),
}));

await app.register(paymentRoutes);

const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '0.0.0.0';

try {
  await app.listen({ port, host });
  console.log(`Sur Payments API running at http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
