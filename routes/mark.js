import express from 'express';
import crypto from 'crypto';
import { pool } from '../db.js';

const router = express.Router();

/* -----------------------------------------------------------
   Generar ID universal
----------------------------------------------------------- */
const makeUUID = () => crypto.randomUUID();

/* -----------------------------------------------------------
   REGISTRO DE MARCACIÓN DE ASISTENCIA
----------------------------------------------------------- */
router.post('/mark', async (req, res) => {
  try {
    let { userId, displayName, latitude, longitude, accuracy } = req.body;

    // Validar userId
    if (!userId)
      return res.status(400).json({ error: 'userId is required' });

    // Confirmar que el usuario existe
    const u = await pool.query(
      'SELECT * FROM users WHERE id=$1',
      [userId]
    );

    if (!u.rows.length)
      return res.status(404).json({ error: 'user not found' });

    // Crear timestamp ISO
    const ts = new Date().toISOString();

    // Insertar marcación
    const insert = await pool.query(
      `INSERT INTO marks
       (id, user_id, display_name, latitude, longitude, accuracy, timestamp)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        makeUUID(),
        userId,
        displayName || u.rows[0].display_name,
        latitude || null,
        longitude || null,
        accuracy || null,
        ts
      ]
    );

    return res.json({
      ok: true,
      timestamp: insert.rows[0].timestamp,
      displayName: insert.rows[0].display_name
    });

  } catch (e) {
    console.error("❌ Error en /mark:", e);
    return res.status(500).json({ error: e.message });
  }
});

/* EXPORTAR */
export default router;
