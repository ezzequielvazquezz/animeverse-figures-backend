const { ErrorHttp } = require('./errores');

const fallo = (campo, msg) => {
  throw new ErrorHttp(400, `${campo}: ${msg}`);
};

function texto(valor, campo, { min = 1, max = 255, requerido = true } = {}) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    if (requerido) fallo(campo, 'es obligatorio');
    return null;
  }
  const s = String(valor).trim();
  if (s.length < min) fallo(campo, `debe tener al menos ${min} caracteres`);
  if (s.length > max) fallo(campo, `no puede superar ${max} caracteres`);
  return s;
}

function entero(valor, campo, { min = 0, max = 1000000, requerido = true } = {}) {
  if (valor === undefined || valor === null || valor === '') {
    if (requerido) fallo(campo, 'es obligatorio');
    return null;
  }
  const n = Number(valor);
  if (!Number.isInteger(n)) fallo(campo, 'debe ser un número entero');
  if (n < min || n > max) fallo(campo, `debe estar entre ${min} y ${max}`);
  return n;
}

function decimal(valor, campo, { min = 0, max = 99999999, requerido = true } = {}) {
  if (valor === undefined || valor === null || valor === '') {
    if (requerido) fallo(campo, 'es obligatorio');
    return null;
  }
  const n = Number(valor);
  if (!Number.isFinite(n)) fallo(campo, 'debe ser un número');
  if (n < min || n > max) fallo(campo, `debe estar entre ${min} y ${max}`);
  return Math.round(n * 100) / 100;
}

function email(valor, campo = 'email', { requerido = true } = {}) {
  const s = texto(valor, campo, { max: 150, requerido });
  if (s === null) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) fallo(campo, 'no es un correo válido');
  return s.toLowerCase();
}

function booleano(valor, defecto = false) {
  if (valor === undefined || valor === null) return defecto ? 1 : 0;
  return valor === true || valor === 1 || valor === '1' || valor === 'true' ? 1 : 0;
}

function enumerado(valor, campo, permitidos) {
  if (!permitidos.includes(valor)) fallo(campo, `debe ser uno de: ${permitidos.join(', ')}`);
  return valor;
}

function color(valor, campo = 'color_acento') {
  const s = texto(valor, campo, { max: 7 });
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) fallo(campo, 'debe tener formato #RRGGBB');
  return s.toUpperCase();
}

// Solo rutas locales (/images/...) o URLs https.
function rutaImagen(valor, campo = 'ruta') {
  const s = texto(valor, campo, { max: 500 });
  if (!/^(\/images\/[\w\-./]+|https:\/\/[^\s]+)$/.test(s) || s.includes('..')) {
    fallo(campo, 'debe ser una ruta local (/images/...) o una URL https');
  }
  return s;
}

function slugify(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150);
}

module.exports = { texto, entero, decimal, email, booleano, enumerado, color, rutaImagen, slugify };
