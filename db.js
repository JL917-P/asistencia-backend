// ================================================================
// db.js – Conexión a Neon + creación de tablas correctas
// ================================================================

import pkg from 'pg';
const { Pool } = pkg;

// Render / Neon URL
const connectionString = process.env.DATABASE_URL;

// Crear pool con SSL (Neon lo requiere)
export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

// ================================================================
// Inicializar base de datos y crear tablas necesarias
// ================================================================
export async function initDb() {
  try {
    const client = await pool.connect();
    console.log("✅ Conectado a Neon (DB online)");

    // Tabla USERS (correcta para tu sistema)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,               -- UUID generado en Node
        username TEXT UNIQUE NOT NULL,     -- usado para WebAuthn login
        display_name TEXT NOT NULL         -- nombre visible
      );
    `);

    // Tabla CREDENTIALS (para WebAuthn)
    await client.query(`
      CREATE TABLE IF NOT EXISTS credentials (
        id TEXT PRIMARY KEY,               -- UUID interno
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        credential_id TEXT UNIQUE NOT NULL,
        public_key TEXT NOT NULL,
        sign_count BIGINT NOT NULL
      );
    `);

    // Tabla MARKS (asistencia GPS)
    await client.query(`
      CREATE TABLE IF NOT EXISTS marks (
        id TEXT PRIMARY KEY,               -- UUID
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        display_name TEXT NOT NULL,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        accuracy DOUBLE PRECISION,
        timestamp TIMESTAMPTZ NOT NULL
      );
    `);

    client.release();
    console.log("📦 Tablas verificadas/creadas correctamente");

  } catch (err) {
    console.error("❌ Error inicializando BD:", err);
    throw err;
  }
}
