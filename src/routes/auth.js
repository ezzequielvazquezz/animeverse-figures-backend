const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');
const v = require('../utils/validar');
const { ErrorHttp, asyncH } = require('../utils/errores');
const { requiereAdmin } = require('../middleware/auth');

// Hash ficticio para que el tiempo de respuesta no revele si el correo existe.
const HASH_FALSO = bcrypt.hashSync('no-es-una-contraseña-real', 10);

router.post('/login', asyncH(async (req, res) => {
  const correo = v.email(req.body.email);
  const password = v.texto(req.body.password, 'password', { max: 200 });

  const [filas] = await db.query(
    'SELECT id, nombre, email, password_hash FROM usuarios_admin WHERE email = ? AND activo = 1',
    [correo]
  );
  const admin = filas[0];
  const ok = await bcrypt.compare(password, admin ? admin.password_hash : HASH_FALSO);
  if (!admin || !ok) throw new ErrorHttp(401, 'Credenciales incorrectas');

  const token = jwt.sign({ sub: admin.id }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.jwtExpira,
  });
  res.json({ token, admin: { id: admin.id, nombre: admin.nombre, email: admin.email } });
}));

router.get('/yo', requiereAdmin, (req, res) => res.json({ admin: req.admin }));

module.exports = router;
