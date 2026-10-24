const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');
const { ErrorHttp, asyncH } = require('../utils/errores');

// Verifica el JWT y confirma en la BD que el administrador siga existiendo y activo.
const requiereAdmin = asyncH(async (req, _res, next) => {
  const cabecera = req.headers.authorization || '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null;
  if (!token) throw new ErrorHttp(401, 'Debes iniciar sesión como administrador');

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    throw new ErrorHttp(401, 'La sesión expiró o no es válida');
  }

  const [filas] = await db.execute(
    'SELECT id, nombre, email FROM usuarios_admin WHERE id = ? AND activo = 1',
    [payload.sub]
  );
  if (!filas.length) throw new ErrorHttp(401, 'La cuenta de administrador no está activa');
  req.admin = filas[0];
  next();
});

module.exports = { requiereAdmin };
