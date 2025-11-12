import { Pool } from 'pg';

const sslNeeded = (process.env.DATABASE_URL || '').includes('.neon.tech') || (process.env.DATABASE_URL || '').includes('render.com');
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslNeeded ? { rejectUnauthorized: false } : false
});
