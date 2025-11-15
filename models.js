import { pool } from './db.js';

/* ===========================================================
   CREACIÓN DE TABLAS (USERS, CREDENTIALS, MARKS)
=========================================================== */

export async function initDb() {
  try {
    console.log("📦 Inicializando base de datos...");

    /* ----------------------
       TABLA: users
       Guarda usuarios normalizados
    ---------------------- */
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL
      );
    `);

    /* ----------------------
       TABLA: credentials
       Guarda credenciales WebAuthn
    ---------------------- */
    await pool.query(`
      CREATE TABLE IF NOT EXISTS credentials (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        credential_id TEXT UNIQUE NOT NULL,
        public_key TEXT NOT NULL,
        sign_count BIGINT NOT NULL
      );
    `);

    /* ----------------------
       TABLA: marks
       Registra asistencias
    ---------------------- */
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        display_name TEXT NOT NULL,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        accuracy DOUBLE PRECISION,
        timestamp TIMESTAMPTZ NOT NULL
      );
    `);

    /* ----------------------
       ÍNDICES RECOMENDADOS
       (Optimiza /auth-begin y /mark)
    ---------------------- */

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username
      ON users (LOWER(username));
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_credentials_user
      ON credentials (user_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_marks_user
      ON marks (user_id);
    `);

    console.log("✅ Tablas y estructuras listas.");

  } catch (e) {
    console.error("❌ Error inicializando DB:", e);
    throw e;
  }
}
