const config = require('./config');
config.exigirJwt();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const { ErrorHttp, asyncH } = require('./utils/errores');

const app = express();
app.set('trust proxy', 1); // Render está detrás de un proxy
app.use(helmet());
app.use(cors({
  origin(origen, cb) {
    // Sin cabecera Origin (curl, health checks) o dentro de la lista blanca
    if (!origen || config.corsOrigenes.includes(origen)) return cb(null, true);
    cb(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
}));
app.use(express.json({ limit: '100kb' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));

const limitarLogin = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { message: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
});

app.get('/api/salud', asyncH(async (_req, res) => {
  await db.query('SELECT 1');
  res.json({ ok: true });
}));

app.use('/api/auth/login', limitarLogin);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/publico'));

app.use('/api', (_req, _res, next) => next(new ErrorHttp(404, 'Ruta no encontrada')));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof ErrorHttp) return res.status(err.estado).json({ message: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'El cuerpo de la petición no es JSON válido' });
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'La petición es demasiado grande' });
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Ya existe un registro con ese valor único (SKU, slug, nombre o correo)' });
  if (err.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ message: 'No se puede eliminar: hay registros que dependen de este' });
  if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ message: 'Referencia inválida (franquicia o producto inexistente)' });
  if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') return res.status(400).json({ message: 'Un valor incumple las reglas de la base de datos (precio, stock o cantidad)' });
  console.error(err);
  res.status(500).json({ message: 'Error interno del servidor' });
});

app.listen(config.puerto, () => console.log(`API ANIMEVERSE FIGURES en el puerto ${config.puerto}`));
