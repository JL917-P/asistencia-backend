import express from 'express';
import crypto from 'crypto';
import { pool } from '../db.js';

const router = express.Router();
const makeUUID = () => crypto.randomUUID();

router.post('/mark', async (req, res) => {
  try {
    const { userId, displayName, latitude, longitude, accuracy } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || null;
    const ua = req.headers['user-agent'] || null;
    const id = makeUUID();
    const timestamp = new Date().toISOString();

    await pool.query(
      `INSERT INTO marks (id, user_id, display_name, timestamp, latitude, longitude, accuracy, ip, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, userId, displayName || null, timestamp, latitude ?? null, longitude ?? null, accuracy ?? null, ip, ua]
    );

    res.json({ ok: true, id, timestamp });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/marks', async (_req, res) => {
  try {
    const rows = await pool.query('SELECT * FROM marks ORDER BY timestamp DESC LIMIT 5000');
    res.json(rows.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/stats', async (req, res) => {
  try {
    const { from, to, user } = req.query;
    const clauses = [];
    const params = [];
    let i = 1;
    if (from) { clauses.push(`timestamp >= $${i++}`); params.push(from); }
    if (to)   { clauses.push(`timestamp <= $${i++}`); params.push(to); }
    if (user) { clauses.push(`display_name ILIKE $${i++}`); params.push(`%${user}%`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const q = `SELECT display_name, DATE(timestamp) AS day, COUNT(*) AS total FROM marks ${where}
               GROUP BY display_name, day ORDER BY day DESC, display_name ASC`;
    const rows = await pool.query(q, params);
    res.json(rows.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
