import express from 'express';
import crypto from 'crypto';
import { pool } from '../db.js';

const router = express.Router();

/* ===========================================================
   HELPERS
=========================================================== */
const makeUUID = () => crypto.randomUUID();

const clean = v =>
  (v === undefined || v === null)
    ? null
    : String(v).trim();

/* Forzar número seguro o null */
const safeNumber = v => {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
};

/* ===========================================================
   1. REGISTRO DE MARCACIÓN
=========================================================== */
router.post('/mark', async (req, res) => {
  try {
    let { userId, displayName, latitude, longitude, accuracy } = req.body;

    console.log("📌 /mark recibido:", req.body);

    /* === VALIDACIÓN DE CAMPOS === */
    userId = clean(userId);

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    /* === VALIDAR QUE EL USUARIO EXISTE === */
    const u = await pool.query(
      "SELECT * FROM users WHERE id=$1",
      [userId]
    );

    if (!u.rows.length) {
      return res.status(404).json({ error: "user not found" });
    }

    const realName = clean(displayName) || u.rows[0].display_name;

    /* === UBICACIÓN === */
    const safeLat = safeNumber(latitude);
    const safeLon = safeNumber(longitude);
    const safeAcc = safeNumber(accuracy);

    /* === TIMESTAMP ISO === */
    const ts = new Date().toISOString();

    /* === INSERT SAFE === */
    const insert = await pool.query(
      `INSERT INTO marks
        (id, user_id, display_name, latitude, longitude, accuracy, timestamp)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        makeUUID(),
        userId,
        realName,
        safeLat,
        safeLon,
        safeAcc,
        ts
      ]
    );

    console.log("✅ Marcación insertada:", insert.rows[0]);

    return res.json({
      ok: true,
      timestamp: insert.rows[0].timestamp,
      displayName: realName,
      location: {
        latitude: safeLat,
        longitude: safeLon,
        accuracy: safeAcc,
      }
    });

  } catch (e) {
    console.error("❌ Error en /mark:", e);
    return res.status(500).json({ error: e.message });
  }
});

/* ===========================================================
   2. LISTADO DE TODAS LAS MARCACIONES (SOLO ADMIN)
=========================================================== */
router.get('/marks-list', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
          id, 
          user_id, 
          display_name, 
          latitude, 
          longitude, 
          accuracy, 
          timestamp
       FROM marks
       ORDER BY timestamp DESC`
    );

    return res.json({
      ok: true,
      count: result.rows.length,
      marks: result.rows
    });

  } catch (e) {
    console.error("❌ Error en /marks-list:", e);
    return res.status(500).json({ error: e.message });
  }
});

/* ===========================================================
   EXPORTAR RUTAS
=========================================================== */
export default router;
