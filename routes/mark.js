import express from 'express';
import crypto from 'crypto';
import { pool } from '../db.js';

const router = express.Router();

/* -----------------------------------------------------------
   Generar ID universal seguro
----------------------------------------------------------- */
const makeUUID = () => crypto.randomUUID();

/* Limpieza de strings */
const clean = v =>
  (v === undefined || v === null)
    ? null
    : String(v).trim();

/* ===========================================================
   1. REGISTRO DE MARCACIÓN DE ASISTENCIA
=========================================================== */
router.post('/mark', async (req, res) => {
  try {
    let { userId, displayName, latitude, longitude, accuracy } = req.body;

    /* -------- VALIDACIONES -------- */

    userId = clean(userId);
    displayName = clean(displayName);

    if (!userId)
      return res.status(400).json({ error: 'userId is required' });

    // Confirmar que el usuario existe
    const u = await pool.query(
      'SELECT * FROM users WHERE id=$1',
      [userId]
    );

    if (!u.rows.length)
      return res.status(404).json({ error: 'user not found' });

    const realName = displayName || u.rows[0].display_name;

    /* -------- NORMALIZAR UBICACIÓN -------- */

    const lat = latitude !== undefined ? Number(latitude) : null;
    const lon = longitude !== undefined ? Number(longitude) : null;
    const acc = accuracy !== undefined ? Number(accuracy) : null;

    const safeLat = isNaN(lat) ? null : lat;
    const safeLon = isNaN(lon) ? null : lon;
    const safeAcc = isNaN(acc) ? null : acc;

    /* -------- TIMESTAMP -------- */
    const ts = new Date().toISOString();

    /* -------- INSERTAR MARCACIÓN -------- */
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

    return res.json({
      ok: true,
      timestamp: insert.rows[0].timestamp,
      displayName: realName,
      location: {
        latitude: safeLat,
        longitude: safeLon,
        accuracy: safeAcc
      }
    });

  } catch (e) {
    console.error("❌ Error en /mark:", e);
    return res.status(500).json({ error: e.message });
  }
});

/* ===========================================================
   2. LISTADO SEGURO DE TODAS LAS MARCACIONES
=========================================================== */
router.get('/marks-list', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, user_id, display_name, latitude, longitude, accuracy, timestamp
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

/* -----------------------------------------------------------
   EXPORTAR RUTA
----------------------------------------------------------- */
export default router;
