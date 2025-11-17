// ================================================================
//  ASISTENCIA BACKEND – SERVIDOR EXPRESS (Render.com READY)
// ================================================================
console.log("🚀 index.js desde GitHub fue cargado correctamente");

import "dotenv/config";
import express from "express";
import cors from "cors";
import { initDb } from "./models.js";

import authRouter from "./routes/auth.js";
import markRouter from "./routes/mark.js";
import dbCheckRouter from "./routes/dbcheck.js";

const app = express();

// ================================================================
// JSON
// ================================================================
app.use(express.json({ limit: "1mb" }));

// ================================================================
// ================================================================
// NORMALIZADOR DE ORIGEN (acepta variantes con / final)
// ================================================================
const clean = v =>
  (v || "")
    .trim()
    .replace(/\/$/, "")
    .replace(/\n/g, "");

const ALLOWED = [
  process.env.EMPLOYEE_ORIGIN_FULL,
  process.env.ADMIN_ORIGIN_FULL,
].filter(Boolean).map(clean);

console.log("🌐 Orígenes permitidos:", ALLOWED);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // Postman, etc.

      console.log("🌐 CORS origin recibido:", origin);

      if (ALLOWED.includes(clean(origin))) {
        return callback(null, true);
      }

      console.log("⛔ CORS bloqueado:", origin);
      return callback(new Error("CORS blocked: " + origin));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "OPTIONS"],
  })
);

// ================================================================
// PRE-FLIGHT GLOBAL PARA RENDER (SOLUCIÓN AL 502)
// ================================================================
app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  res.sendStatus(200);
});

// ================================================================
// RUTA DE ESTADO
// ================================================================
app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "attendance-backend",
    time: new Date().toISOString(),
  });
});

// ================================================================
// RUTAS REALES (DEBEN IR DESPUÉS DE CORS)
// ================================================================
app.use("/", dbCheckRouter);
app.use("/", authRouter);
app.use("/", markRouter);

// ================================================================
// INICIAR SERVIDOR
// ================================================================
const port = Number(process.env.PORT) || 4000;

(async () => {
  try {
    console.log("Connecting to DB:", process.env.DATABASE_URL);

    await initDb();
    console.log("✅ Base de datos inicializada correctamente");

    app.listen(port, "0.0.0.0", () =>
      console.log(`🚀 Backend running on port ${port}`)
    );
  } catch (e) {
    console.error("❌ Failed to start:", e);
    process.exit(1);
  }
})();
