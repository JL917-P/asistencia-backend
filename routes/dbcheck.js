import express from "express";
import { pool } from "../db.js";

const router = express.Router();

router.get("/db-check", async (req, res) => {
  try {
    let report = {};

    // Probar conexión
    report.connection = "OK";
    const r1 = await pool.query("SELECT NOW() as now");
    report.now = r1.rows[0].now;

    // Verificar tablas
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public'
      ORDER BY table_name;
    `);

    report.tables = tables.rows.map(t => t.table_name);

    return res.json({
      ok: true,
      report
    });

  } catch (e) {
    console.error("❌ ERROR EN /db-check:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
