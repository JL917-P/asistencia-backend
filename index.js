import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDb } from './models.js';
import authRouter from './routes/auth.js';
import markRouter from './routes/mark.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

// CORS relajado para demo (ajusta en prod)
app.use(cors({ origin: (_o, cb) => cb(null, true), methods: ['GET','POST','DELETE'] }));

app.get('/', (_req, res) =>
  res.json({ ok: true, service: 'attendance-backend', time: new Date().toISOString() })
);

app.use('/', authRouter);
app.use('/', markRouter);

// ❗️Define el puerto UNA SOLA VEZ
const port = Number(process.env.PORT) || 4000;

(async () => {
  try {
    console.log('Connecting to DB:', process.env.DATABASE_URL);
    await initDb();
    console.log('✅ Base de datos inicializada correctamente');
app.get('/debug-env', (req, res) => {
  res.json({
    RP_ID: process.env.RP_ID,
    ORIGIN: process.env.ORIGIN,
    EMPLOYEE_ORIGIN_FULL: process.env.EMPLOYEE_ORIGIN_FULL,
    ADMIN_ORIGIN_FULL: process.env.ADMIN_ORIGIN_FULL,
  });
});

    // Escucha en 0.0.0.0 para Render
    app.listen(port, '0.0.0.0', () => console.log(`🚀 Backend running on :${port}`));
  } catch (e) {
    console.error('❌ Failed to start:', e);
    process.exit(1);
  }
})();
