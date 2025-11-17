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

// JSON
app.use(express.json({ limit: '1mb' }));

// ================================================================
// NORMALIZADOR DE ORIGEN (acepta variantes con / final)
// ================================================================
function normalize(origin = "") {
  return origin.trim().replace(/\/+$/, "");
}

// ================================================================
// ORÍGENES PERMITIDOS
// ================================================================
const ALLOWED = [
  normalize(process.env.EMPLOYEE_ORIGIN_FULL),
  normalize(process.env.ADMIN_ORIGIN_FULL)
];

console.log("🔵 ALLOWED ORIGINS = ", ALLOWED);

// ================================================================
// CORS PRINCIPAL
// ================================================================
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // Postman, navegador interno

      const clean = normalize(origin);

      if (ALLOWED.includes(clean)) {
        return callback(null, true);
      }

      console.log("⛔ CORS BLOQUEADO para:", origin, "→ normalizado:", clean);
      return callback(new Error("CORS blocked: " + clean));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  })
);

// ================================================================
// PRE-FLIGHT UNIVERSAL – NECESARIO PARA RENDER
// ================================================================
app.options('*', (req, res) => {
  const origin = normalize(req.headers.origin || "");
  if (ALLOWED.includes(origin)) {
    res.header("Access-Control-Allow-Origin", req.headers.origin);
  }
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  res.sendStatus(200);
});

// ================================================================
// STATUS ROUTE
// ================================================================
app.get('/', (_req, res) =>
  res.json({
    ok: true,
    service: 'attendance-backend',
    time: new Date().toISOString()
  })
);

// ================================================================
// DEBUG ENV (para Render)
// ================================================================
app.get("/debug-env", (req, res) => {
  res.json({
    RP_ID: process.env.RP_ID,
    EMPLOYEE_ORIGIN_FULL: process.env.EMPLOYEE_ORIGIN_FULL,
    ADMIN_ORIGIN_FULL: process.env.ADMIN_ORIGIN_FULL,
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL ? "OK" : "MISSING",
    allowed: ALLOWED
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
