import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { pool } from './db.js';
import { initDb } from './models.js';
import authRouter from './routes/auth.js';
import markRouter from './routes/mark.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

// CORS: permitir ambos frontends (+ localhost en dev)
const origins = [
  process.env.EMPLOYEE_ORIGIN_FULL,
  process.env.ADMIN_ORIGIN_FULL,
  'http://localhost:5500',
  'http://localhost:5173'
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => cb(null, true), // relajado para demo; en producción usar 'origins'
  methods: ['GET','POST','DELETE'],
}));

app.get('/', (_req, res) => res.json({ ok: true, service: 'attendance-backend', time: new Date().toISOString() }));

app.use('/', authRouter);
app.use('/', markRouter);

const PORT = process.env.PORT || 4000;
const PORT = process.env.PORT || 4000;

(async () => {
  try {
    console.log("Connecting to DB:", process.env.DATABASE_URL);

    await initDb();
    console.log('✅ Base de datos inicializada correctamente');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
    });
    
  } catch (e) {
    console.error('❌ Error al iniciar el servidor:', e);
    process.exit(1);
  }
})();


