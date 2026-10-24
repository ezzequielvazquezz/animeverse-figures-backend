require('dotenv').config();

const config = {
  esProduccion: process.env.NODE_ENV === 'production',
  puerto: Number(process.env.PORT) || 3000,
  corsOrigenes: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpira: process.env.JWT_EXPIRES_IN || '8h',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'animeverse_figures',
    ssl: process.env.DB_SSL === 'true',
    sslCa: process.env.DB_SSL_CA ? process.env.DB_SSL_CA.replace(/\\n/g, '\n') : '',
  },
};

// Se llama solo desde el servidor: los scripts de BD no necesitan JWT_SECRET.
config.exigirJwt = () => {
  if (!config.jwtSecret || config.jwtSecret.length < 32) {
    console.error('Falta JWT_SECRET (mínimo 32 caracteres). Revisa backend/.env.example.');
    process.exit(1);
  }
};

module.exports = config;
