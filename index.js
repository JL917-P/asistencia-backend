import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDb } from './models.js';
import authRouter from './routes/auth.js';
import markRouter from './routes/mark.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

// ------------------------------------------
// CORS (puedes restringirlo luego en producción)
// ------------------------------------------
app.use(
  cors({
    origin: (_origin, callback) => callback(null, true),
    methods: ['GET', 'POST', 'DELETE'],
  })
);

// ------------------------------------------
// Ruta raíz para verificar que el backend está vivo
// ------------------------------------------
app.get('/', (_req, res) =>
  res.json({
    ok: true,
    service: 'attendance-backend',
    time: new Date().toISOString(),
  })
);

// ------------------------------------------
// 🔍 Ruta de diagnóstico para Render
// ------------------------------------------
app.get('/debug-env', (req, res) => {
  res.json({
    RP_ID: process.env.RP_ID,
    EMPLOYEE_ORIGIN_FULL: process.env.EMPLOYEE_ORIGIN_FULL,
    ADMIN_ORIGIN_FULL: process.env.ADMIN_ORIGIN_FULL,
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL ? 'OK' : 'MISSING',
  });
});

// ------------------------------------------
// Rutas principales
// ------------------------------------------
app.use('/', authRouter);
app.use('/', markRouter);

// Puerto (Render asigna uno dinámico)
const port = Number(process.env.PORT) || 4000;

// ------------------------------------------
// Inicio con conexión a DB
// ------------------------------------------
(async () => {
  try {
    console.log('Connecting to DB:', process.env.DATABASE_URL);

    await initDb();

    console.log('✅ Base de datos inicializada correctamente');

    // Render requiere 0.0.0.0
    app.listen(port, '0.0.0.0', () =>
      console.log(`🚀 Backend running on port: ${port}`)
    );
  } catch (e) {
    console.error('❌ Failed to start:', e);
    process.exit(1);
  }
})();
