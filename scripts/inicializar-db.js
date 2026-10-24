// Ejecuta sql/schema.sql (y sql/seed.sql con --seed) sobre la base configurada en .env.
//   npm run db:init            -> solo tablas
//   npm run db:init -- --seed  -> tablas + datos de demostración
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  const ssl = process.env.DB_SSL === 'true'
    ? (process.env.DB_SSL_CA
        ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n'), rejectUnauthorized: true }
        : { rejectUnauthorized: false })
    : undefined;
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'animeverse_figures',
    ssl,
    multipleStatements: true,
    charset: 'utf8mb4',
  });
  try {
    const archivos = ['schema.sql'];
    if (process.argv.includes('--seed')) archivos.push('seed.sql');
    for (const a of archivos) {
      await conn.query(fs.readFileSync(path.join(__dirname, '..', 'sql', a), 'utf8'));
      console.log(`✔ ${a} ejecutado`);
    }
  } catch (e) {
    console.error('Error:', e.sqlMessage || e.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
})();
