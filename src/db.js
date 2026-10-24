const mysql = require('mysql2/promise');
const { db: cfg } = require('./config');

function opcionesSsl() {
  if (!cfg.ssl) return undefined;
  // Con la CA de Aiven se valida el certificado; sin CA solo se cifra la conexión.
  return cfg.sslCa ? { ca: cfg.sslCa, rejectUnauthorized: true } : { rejectUnauthorized: false };
}

module.exports = mysql.createPool({
  host: cfg.host,
  port: cfg.port,
  user: cfg.user,
  password: cfg.password,
  database: cfg.database,
  ssl: opcionesSsl(),
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
  charset: 'utf8mb4',
});
