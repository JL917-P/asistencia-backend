import { pool } from './db.js';

export async function initDb() {
  try {
    const client = await pool.connect();

    console.log("🔧 Inicializando base de datos...");

    /* =============================
       TABLA USERS (WebAuthn READY)
       ============================= */
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL
      );
    `);

    /* =============================
       TABLA CREDENTIALS
       ============================= */
    await client.query(`
      CREATE TABLE IF NOT EXISTS credentials (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        credential_id TEXT UNIQUE NOT NULL,
        public_key TEXT NOT NULL,
        sign_count INTEGER NOT NULL
      );
    `);

    /* =============================
       TABLA MARKS (ASISTENCIA)
       ============================= */
    await client.query(`
      CREATE TABLE IF NOT EXISTS marks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        display_name TEXT NOT NULL,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        accuracy DOUBLE PRECISION,
        timestamp TIMESTAMP NOT NULL
      );
    `);

    console.log("🟢 Tablas creadas/cargadas correctamente.");

    client.release();
  } catch (err) {
    console.error("❌ Error creando tablas:", err);
    throw err;
  }
}
