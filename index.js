// ================================================================
//  ASISTENCIA BACKEND – SERVIDOR EXPRESS (Render.com READY)
// ================================================================
console.log("🚀 index.js desde GitHub fue cargado correctamente");
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
// CORS CONFIG – PERMITIR SOLO LOS FRONTENDS OFICIALES
// ================================================================
const allowedOrigins = [
  process.env.EMPLOYEE_ORIGIN_FULL, // frontend-marcador
  process.env.ADMIN_ORIGIN_FULL     // frontend-admin
];

// Normalizar orígenes (evita errores por espacios o saltos de línea)
const clean = v => (v || "").trim().replace(/\n/g, "");
const ALLOWED = allowedOrigins.map(clean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir peticiones internas (Postman, cURL, navegador)
      if (!origin) return callback(null, true);

      if (ALLOWED.includes(origin)) {
        return callback(null, true);
      }

      console.log("⛔ CORS bloqueado para origin:", origin);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ['POST', 'GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: true
  })
);

// ================================================================
// PRE-FLIGHT PARA TODOS LOS ENDPOINTS (NECESARIO PARA RENDER)
// ================================================================
app.options('*', (req, res) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  res.sendStatus(200);
});

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
// DEBUG DE VARIABLES PARA VERIFICAR CONFIG EN RENDER
// ================================================================
app.get("/debug-env", (req, res) => {
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
// INICIAR SERVIDOR (Render requiere 0.0.0.0)
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
