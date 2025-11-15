import express from 'express';
import crypto from 'crypto';
import { pool } from '../db.js';

const router = express.Router();

/* -----------------------------------------------------------
   Generar ID universal
----------------------------------------------------------- */
const makeUUID = () => crypto.randomUUID();

/* Sanear strings para evitar null, undefined, espacios, etc */
const clean = v =>
  (v === undefined || v === null)
    ? null
    : String(v).trim();

/* -----------------------------------------------------------
   REGISTRO DE MARCACIÓN DE ASISTENCIA
----------------------------------------------------------- */
router.post('/mark', async (req, res) => {
  try {
    let { userId, displayName, latitude, longitude, accuracy } = req.body;

    /* -------- VALIDACIONES -------- */

    userId = clean(userId);
    displayName = clean(displayName);

    if (!userId)
      return res.status(400).json({ error: 'userId is required' });

    // Confirmar que existe usuario
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

    // Evitar guardar números inválidos
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

/* EXPORTAR */
export default router;
