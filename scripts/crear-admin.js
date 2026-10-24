// Crea (o restablece la contraseña de) un administrador. Uso:
//   ADMIN_EMAIL=tu@correo.com ADMIN_PASSWORD='una-clave-larga' ADMIN_NOMBRE='Tu nombre' npm run crear-admin
const bcrypt = require('bcryptjs');
const db = require('../src/db');
const v = require('../src/utils/validar');

(async () => {
  try {
    const nombre = v.texto(process.env.ADMIN_NOMBRE || 'Administrador', 'ADMIN_NOMBRE', { max: 80 });
    const email = v.email(process.env.ADMIN_EMAIL, 'ADMIN_EMAIL');
    const password = process.env.ADMIN_PASSWORD || '';
    if (password.length < 10) throw new Error('ADMIN_PASSWORD debe tener al menos 10 caracteres');

    const hash = await bcrypt.hash(password, 12);
    await db.query(
      `INSERT INTO usuarios_admin (nombre, email, password_hash) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), password_hash = VALUES(password_hash), activo = 1`,
      [nombre, email, hash]
    );
    console.log(`Administrador listo: ${email}`);
  } catch (e) {
    console.error('No se pudo crear el administrador:', e.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
