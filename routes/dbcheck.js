import express from "express";
import { pool } from "../db.js";

const router = express.Router();

router.get("/db-check", async (req, res) => {
  try {
    let report = {};

    // Probar conexión
    await pool.query("SELECT NOW()");
    report.connection = "OK";
    report.now = new Date().toISOString();

    // Listar tablas existentes
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public'
    `);

    report.tables = tables.rows.map(t => t.table_name);

    return res.json({ ok: true, report });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
