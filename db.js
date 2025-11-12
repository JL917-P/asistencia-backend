import pkg from 'pg';
const { Pool } = pkg;

// Render/Neon URL desde variables de entorno
const connectionString = process.env.DATABASE_URL;

// Configuración del pool con SSL obligatorio
export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

// Función para probar conexión y preparar tablas
export async function initDb() {
  try {
    const client = await pool.connect();
    console.log('✅ Conectado a la base de datos Neon');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL
      );
    `);
    client.release();
  } catch (err) {
    console.error('❌ Error conectando a la base de datos:', err);
    throw err;
  }
}
