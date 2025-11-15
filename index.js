// ================================================================
//  ASISTENCIA BACKEND – SERVIDOR EXPRESS (Render.com READY)
// ================================================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDb } from './models.js';
import authRouter from './routes/auth.js';
import markRouter from './routes/mark.js';

const app = express();

// Permitir JSON
app.use(express.json({ limit: '1mb' }));

// ================================================================
// CORS – SOLO PERMITIR TUS DOS FRONTENDS OFICIALES
// ================================================================
const allowedOrigins = [
  process.env.EMPLOYEE_ORIGIN_FULL, // https://asistencia-frontend-marcador.onrender.com
  process.env.ADMIN_ORIGIN_FULL     // https://asistencia-frontend-admin.onrender.com
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // Postman, CURL

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("❌ CORS blocked:", origin);
      return callback(new Error("CORS blocked for: " + origin));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    credentials: true
  })
);

// ================================================================
// RUTA BACKEND STATUS
// ================================================================
app.get('/', (_req, res) =>
  res.json({
    ok: true,
    service: 'attendance-backend',
    time: new Date().toISOString()
  })
);

// ================================================================
// DEBUG ENV
// ================================================================
app.get("/debug-env", (_req, res) => {
  res.json({
    RP_ID: process.env.RP_ID,
    EMPLOYEE_ORIGIN_FULL: process.env.EMPLOYEE_ORIGIN_FULL,
    ADMIN_ORIGIN_FULL: process.env.ADMIN_ORIGIN_FULL,
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL ? "OK" : "MISSING"
  });
});

// ================================================================
// RUTAS PRINCIPALES
// ================================================================
app.use('/', authRouter);
app.use('/', markRouter);

// ================================================================
// INICIAR SERVIDOR
// ================================================================
const port = Number(process.env.PORT) || 4000;

(async () => {
  try {
    console.log('Connecting to DB:', process.env.DATABASE_URL);

    await initDb();
    console.log('✅ Base de datos inicializada correctamente');

    app.listen(port, '0.0.0.0', () =>
      console.log(`🚀 Backend running on port ${port}`)
    );

  } catch (e) {
    console.error('❌ Failed to start:', e);
    process.exit(1);
  }
})();
