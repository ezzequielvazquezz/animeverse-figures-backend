const router = require('express').Router();
const db = require('../db');
const v = require('../utils/validar');
const { ErrorHttp, asyncH } = require('../utils/errores');
const { requiereAdmin } = require('../middleware/auth');

router.use(requiereAdmin);

const ESTADOS = ['pendiente_pago', 'pagado', 'enviado', 'entregado', 'cancelado'];
const VENTA_CONFIRMADA = "('pagado','enviado','entregado')";
const TRANSICIONES = {
  pendiente_pago: ['pagado', 'cancelado'],
  pagado: ['enviado', 'cancelado'],
  enviado: ['entregado'],
  entregado: [],
  cancelado: [],
};

const like = (q) => `%${String(q).trim().slice(0, 80).replace(/[%_]/g, '\\$&')}%`;
const idParam = (req) => v.entero(req.params.id, 'id', { min: 1 });

// ───────── Estadísticas ─────────
router.get('/estadisticas', asyncH(async (_req, res) => {
  const [[totales]] = await db.query(
    `SELECT
       (SELECT COALESCE(SUM(total),0) FROM pedidos WHERE estado IN ${VENTA_CONFIRMADA}) AS ingresos,
       (SELECT COUNT(*) FROM pedidos WHERE estado IN ${VENTA_CONFIRMADA}) AS ventas,
       (SELECT COUNT(*) FROM pedidos WHERE estado = 'pendiente_pago') AS pedidos_pendientes,
       (SELECT COALESCE(SUM(total),0) FROM pedidos WHERE estado = 'pendiente_pago') AS monto_pendiente,
       (SELECT COUNT(*) FROM clientes) AS clientes,
       (SELECT COUNT(*) FROM productos WHERE activo = 1) AS productos_activos,
       (SELECT COALESCE(SUM(stock),0) FROM productos WHERE activo = 1) AS unidades_en_stock,
       (SELECT COUNT(*) FROM productos WHERE activo = 1 AND stock <= 3) AS stock_bajo`
  );
  const [porFranquicia] = await db.query(
    `SELECT f.nombre, f.color_acento,
            COALESCE(SUM(x.cantidad * x.precio_unitario), 0) AS ingresos,
            COALESCE(SUM(x.cantidad), 0) AS unidades
       FROM franquicias f
       LEFT JOIN productos p ON p.franquicia_id = f.id
       LEFT JOIN (SELECT d.producto_id, d.cantidad, d.precio_unitario
                    FROM pedido_detalles d JOIN pedidos pe ON pe.id = d.pedido_id
                   WHERE pe.estado IN ${VENTA_CONFIRMADA}) x ON x.producto_id = p.id
      GROUP BY f.id, f.nombre, f.color_acento ORDER BY ingresos DESC`
  );
  const [masVendidos] = await db.query(
    `SELECT d.producto_id, d.nombre_producto AS nombre, SUM(d.cantidad) AS unidades,
            SUM(d.cantidad * d.precio_unitario) AS ingresos
       FROM pedido_detalles d JOIN pedidos pe ON pe.id = d.pedido_id
      WHERE pe.estado IN ${VENTA_CONFIRMADA}
      GROUP BY d.producto_id, d.nombre_producto ORDER BY unidades DESC LIMIT 5`
  );
  const [diarias] = await db.query(
    `SELECT DATE(creado_en) AS dia, COUNT(*) AS pedidos, SUM(total) AS ingresos
       FROM pedidos
      WHERE estado IN ${VENTA_CONFIRMADA} AND creado_en >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
      GROUP BY DATE(creado_en) ORDER BY dia`
  );
  res.json({ totales, porFranquicia, masVendidos, diarias });
}));

// ───────── Franquicias ─────────
function leerFranquicia(b) {
  const nombre = v.texto(b.nombre, 'nombre', { max: 100 });
  return {
    nombre,
    slug: v.slugify(b.slug || nombre),
    descripcion: v.texto(b.descripcion, 'descripcion', { max: 500, requerido: false }),
    color_acento: v.color(b.color_acento || '#D4A94F'),
    activa: v.booleano(b.activa, true),
  };
}

router.get('/franquicias', asyncH(async (_req, res) => {
  const [filas] = await db.query(
    `SELECT f.*, (SELECT COUNT(*) FROM productos p WHERE p.franquicia_id = f.id) AS total_productos
       FROM franquicias f ORDER BY f.nombre`
  );
  res.json(filas);
}));

router.post('/franquicias', asyncH(async (req, res) => {
  const f = leerFranquicia(req.body);
  const [r] = await db.query(
    'INSERT INTO franquicias (nombre, slug, descripcion, color_acento, activa) VALUES (?, ?, ?, ?, ?)',
    [f.nombre, f.slug, f.descripcion, f.color_acento, f.activa]
  );
  res.status(201).json({ id: r.insertId, ...f });
}));

router.put('/franquicias/:id', asyncH(async (req, res) => {
  const f = leerFranquicia(req.body);
  const [r] = await db.query(
    'UPDATE franquicias SET nombre=?, slug=?, descripcion=?, color_acento=?, activa=? WHERE id=?',
    [f.nombre, f.slug, f.descripcion, f.color_acento, f.activa, idParam(req)]
  );
  if (!r.affectedRows) throw new ErrorHttp(404, 'Franquicia no encontrada');
  res.json({ id: idParam(req), ...f });
}));

router.delete('/franquicias/:id', asyncH(async (req, res) => {
  const id = idParam(req);
  const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM productos WHERE franquicia_id = ?', [id]);
  if (n > 0) throw new ErrorHttp(409, 'No se puede eliminar: la franquicia tiene figuras. Desactívala en su lugar.');
  const [r] = await db.query('DELETE FROM franquicias WHERE id = ?', [id]);
  if (!r.affectedRows) throw new ErrorHttp(404, 'Franquicia no encontrada');
  res.json({ ok: true });
}));

// ───────── Productos ─────────
function leerProducto(b) {
  const nombre = v.texto(b.nombre, 'nombre', { max: 160 });
  const precio = v.decimal(b.precio, 'precio', { min: 0.01 });
  const oferta = v.decimal(b.precio_oferta, 'precio_oferta', { min: 0.01, requerido: false });
  if (oferta !== null && oferta >= precio) throw new ErrorHttp(400, 'precio_oferta: debe ser menor al precio normal');

  const imagenes = Array.isArray(b.imagenes) ? b.imagenes : [];
  if (imagenes.length > 8) throw new ErrorHttp(400, 'imagenes: máximo 8 por figura');

  return {
    franquicia_id: v.entero(b.franquicia_id, 'franquicia_id', { min: 1 }),
    sku: v.texto(b.sku, 'sku', { max: 40 }).toUpperCase(),
    slug: v.slugify(b.slug || nombre),
    nombre,
    personaje: v.texto(b.personaje, 'personaje', { max: 100 }),
    descripcion: v.texto(b.descripcion, 'descripcion', { max: 5000, requerido: false }),
    precio,
    precio_oferta: oferta,
    stock: v.entero(b.stock, 'stock', { min: 0, max: 100000 }),
    escala: v.texto(b.escala, 'escala', { max: 20, requerido: false }),
    altura_cm: v.decimal(b.altura_cm, 'altura_cm', { min: 1, max: 500, requerido: false }),
    material: v.texto(b.material, 'material', { max: 80, requerido: false }),
    fabricante: v.texto(b.fabricante, 'fabricante', { max: 100, requerido: false }),
    destacado: v.booleano(b.destacado),
    activo: v.booleano(b.activo, true),
    imagenes: imagenes.map((im, i) => ({
      ruta: v.rutaImagen(im.ruta, `imagenes[${i}].ruta`),
      alt: v.texto(im.alt, `imagenes[${i}].alt`, { max: 200, requerido: false }),
    })),
  };
}

const CAMPOS_PRODUCTO = ['franquicia_id', 'sku', 'slug', 'nombre', 'personaje', 'descripcion', 'precio',
  'precio_oferta', 'stock', 'escala', 'altura_cm', 'material', 'fabricante', 'destacado', 'activo'];

async function guardarImagenes(conn, productoId, imagenes) {
  await conn.query('DELETE FROM producto_imagenes WHERE producto_id = ?', [productoId]);
  if (imagenes.length) {
    await conn.query(
      'INSERT INTO producto_imagenes (producto_id, ruta, alt, orden) VALUES ?',
      [imagenes.map((im, i) => [productoId, im.ruta, im.alt, i])]
    );
  }
}

async function conTransaccion(fn) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const resultado = await fn(conn);
    await conn.commit();
    return resultado;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

router.get('/productos', asyncH(async (req, res) => {
  const donde = ['1=1'];
  const params = [];
  if (req.query.q) {
    donde.push('(p.nombre LIKE ? OR p.sku LIKE ? OR p.personaje LIKE ?)');
    const t = like(req.query.q);
    params.push(t, t, t);
  }
  if (req.query.franquicia_id) { donde.push('p.franquicia_id = ?'); params.push(v.entero(req.query.franquicia_id, 'franquicia_id', { min: 1 })); }
  if (req.query.stock_max !== undefined && req.query.stock_max !== '') {
    donde.push('p.stock <= ?'); params.push(v.entero(req.query.stock_max, 'stock_max'));
  }
  const [filas] = await db.query(
    `SELECT p.*, f.nombre AS franquicia,
            (SELECT i.ruta FROM producto_imagenes i WHERE i.producto_id = p.id ORDER BY i.orden, i.id LIMIT 1) AS imagen_principal
       FROM productos p JOIN franquicias f ON f.id = p.franquicia_id
      WHERE ${donde.join(' AND ')} ORDER BY p.creado_en DESC, p.id DESC LIMIT 500`,
    params
  );
  res.json(filas);
}));

router.get('/productos/:id', asyncH(async (req, res) => {
  const id = idParam(req);
  const [filas] = await db.query('SELECT * FROM productos WHERE id = ?', [id]);
  if (!filas.length) throw new ErrorHttp(404, 'Figura no encontrada');
  const [imagenes] = await db.query(
    'SELECT ruta, alt FROM producto_imagenes WHERE producto_id = ? ORDER BY orden, id', [id]);
  res.json({ ...filas[0], imagenes });
}));

router.post('/productos', asyncH(async (req, res) => {
  const p = leerProducto(req.body);
  const id = await conTransaccion(async (conn) => {
    const [r] = await conn.query(
      `INSERT INTO productos (${CAMPOS_PRODUCTO.join(', ')}) VALUES (${CAMPOS_PRODUCTO.map(() => '?').join(', ')})`,
      CAMPOS_PRODUCTO.map((c) => p[c])
    );
    await guardarImagenes(conn, r.insertId, p.imagenes);
    return r.insertId;
  });
  res.status(201).json({ id });
}));

router.put('/productos/:id', asyncH(async (req, res) => {
  const id = idParam(req);
  const p = leerProducto(req.body);
  await conTransaccion(async (conn) => {
    const [r] = await conn.query(
      `UPDATE productos SET ${CAMPOS_PRODUCTO.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...CAMPOS_PRODUCTO.map((c) => p[c]), id]
    );
    if (!r.affectedRows) throw new ErrorHttp(404, 'Figura no encontrada');
    await guardarImagenes(conn, id, p.imagenes);
  });
  res.json({ id });
}));

// Ajuste rápido de inventario: fija el stock o suma/resta una diferencia (nunca queda negativo)
router.patch('/productos/:id/stock', asyncH(async (req, res) => {
  const id = idParam(req);
  let r;
  if (req.body.stock !== undefined) {
    const stock = v.entero(req.body.stock, 'stock', { min: 0, max: 100000 });
    [r] = await db.query('UPDATE productos SET stock = ? WHERE id = ?', [stock, id]);
  } else {
    const delta = v.entero(req.body.delta, 'delta', { min: -100000, max: 100000 });
    [r] = await db.query('UPDATE productos SET stock = stock + ? WHERE id = ? AND stock + ? >= 0', [delta, id, delta]);
    if (!r.affectedRows) throw new ErrorHttp(409, 'El ajuste dejaría el stock en negativo');
  }
  if (!r.affectedRows) {
    const [e] = await db.query('SELECT id FROM productos WHERE id = ?', [id]);
    if (!e.length) throw new ErrorHttp(404, 'Figura no encontrada');
  }
  const [[fila]] = await db.query('SELECT id, stock FROM productos WHERE id = ?', [id]);
  res.json(fila);
}));

// Si la figura ya se vendió se conserva el historial: solo se desactiva.
router.delete('/productos/:id', asyncH(async (req, res) => {
  const id = idParam(req);
  const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM pedido_detalles WHERE producto_id = ?', [id]);
  if (n > 0) {
    await db.query('UPDATE productos SET activo = 0 WHERE id = ?', [id]);
    return res.json({ ok: true, desactivado: true, mensaje: 'La figura tiene ventas: se desactivó para conservar el historial.' });
  }
  const [r] = await db.query('DELETE FROM productos WHERE id = ?', [id]);
  if (!r.affectedRows) throw new ErrorHttp(404, 'Figura no encontrada');
  res.json({ ok: true, desactivado: false });
}));

// ───────── Clientes ─────────
function leerCliente(b) {
  return {
    nombre: v.texto(b.nombre, 'nombre', { min: 2, max: 100 }),
    email: v.email(b.email),
    telefono: v.texto(b.telefono, 'telefono', { max: 30, requerido: false }),
    direccion: v.texto(b.direccion, 'direccion', { max: 255, requerido: false }),
    ciudad: v.texto(b.ciudad, 'ciudad', { max: 100, requerido: false }),
    pais: v.texto(b.pais, 'pais', { max: 80, requerido: false }),
  };
}

router.get('/clientes', asyncH(async (req, res) => {
  const donde = ['1=1'];
  const params = [];
  if (req.query.q) {
    donde.push('(c.nombre LIKE ? OR c.email LIKE ?)');
    const t = like(req.query.q);
    params.push(t, t);
  }
  const [filas] = await db.query(
    `SELECT c.*, COUNT(pe.id) AS pedidos, COALESCE(SUM(pe.total), 0) AS total_pedidos
       FROM clientes c LEFT JOIN pedidos pe ON pe.cliente_id = c.id AND pe.estado <> 'cancelado'
      WHERE ${donde.join(' AND ')} GROUP BY c.id ORDER BY c.creado_en DESC LIMIT 500`,
    params
  );
  res.json(filas);
}));

router.post('/clientes', asyncH(async (req, res) => {
  const c = leerCliente(req.body);
  const [r] = await db.query(
    'INSERT INTO clientes (nombre, email, telefono, direccion, ciudad, pais) VALUES (?, ?, ?, ?, ?, ?)',
    [c.nombre, c.email, c.telefono, c.direccion, c.ciudad, c.pais]
  );
  res.status(201).json({ id: r.insertId, ...c });
}));

router.put('/clientes/:id', asyncH(async (req, res) => {
  const c = leerCliente(req.body);
  const [r] = await db.query(
    'UPDATE clientes SET nombre=?, email=?, telefono=?, direccion=?, ciudad=?, pais=? WHERE id=?',
    [c.nombre, c.email, c.telefono, c.direccion, c.ciudad, c.pais, idParam(req)]
  );
  if (!r.affectedRows) throw new ErrorHttp(404, 'Cliente no encontrado');
  res.json({ id: idParam(req), ...c });
}));

router.delete('/clientes/:id', asyncH(async (req, res) => {
  const id = idParam(req);
  const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM pedidos WHERE cliente_id = ?', [id]);
  if (n > 0) throw new ErrorHttp(409, 'No se puede eliminar: el cliente tiene pedidos en el historial.');
  const [r] = await db.query('DELETE FROM clientes WHERE id = ?', [id]);
  if (!r.affectedRows) throw new ErrorHttp(404, 'Cliente no encontrado');
  res.json({ ok: true });
}));

// ───────── Pedidos / historial de ventas ─────────
router.get('/pedidos', asyncH(async (req, res) => {
  const donde = ['1=1'];
  const params = [];
  if (req.query.estado) { donde.push('pe.estado = ?'); params.push(v.enumerado(req.query.estado, 'estado', ESTADOS)); }
  if (req.query.q) {
    donde.push('(c.nombre LIKE ? OR c.email LIKE ? OR pe.id = ?)');
    const t = like(req.query.q);
    params.push(t, t, Number(req.query.q) || 0);
  }
  const [filas] = await db.query(
    `SELECT pe.id, pe.estado, pe.total, pe.creado_en, c.nombre AS cliente, c.email,
            (SELECT COALESCE(SUM(d.cantidad),0) FROM pedido_detalles d WHERE d.pedido_id = pe.id) AS unidades
       FROM pedidos pe JOIN clientes c ON c.id = pe.cliente_id
      WHERE ${donde.join(' AND ')} ORDER BY pe.creado_en DESC, pe.id DESC LIMIT 500`,
    params
  );
  res.json(filas);
}));

router.get('/pedidos/:id', asyncH(async (req, res) => {
  const id = idParam(req);
  const [filas] = await db.query(
    `SELECT pe.*, c.nombre AS cliente, c.email, c.telefono
       FROM pedidos pe JOIN clientes c ON c.id = pe.cliente_id WHERE pe.id = ?`, [id]);
  if (!filas.length) throw new ErrorHttp(404, 'Pedido no encontrado');
  const [detalles] = await db.query(
    `SELECT producto_id, nombre_producto, cantidad, precio_unitario,
            cantidad * precio_unitario AS subtotal
       FROM pedido_detalles WHERE pedido_id = ? ORDER BY id`, [id]);
  res.json({ ...filas[0], detalles, transiciones: TRANSICIONES[filas[0].estado] });
}));

// Cambiar estado. Cancelar devuelve el stock al inventario dentro de la misma transacción.
router.patch('/pedidos/:id/estado', asyncH(async (req, res) => {
  const id = idParam(req);
  const nuevo = v.enumerado(req.body.estado, 'estado', ESTADOS);
  await conTransaccion(async (conn) => {
    const [filas] = await conn.query('SELECT estado FROM pedidos WHERE id = ? FOR UPDATE', [id]);
    if (!filas.length) throw new ErrorHttp(404, 'Pedido no encontrado');
    const actual = filas[0].estado;
    if (!TRANSICIONES[actual].includes(nuevo)) {
      throw new ErrorHttp(409, `No se puede pasar de "${actual}" a "${nuevo}"`);
    }
    if (nuevo === 'cancelado') {
      const [detalles] = await conn.query(
        'SELECT producto_id, cantidad FROM pedido_detalles WHERE pedido_id = ? ORDER BY producto_id', [id]);
      for (const d of detalles) {
        await conn.query('UPDATE productos SET stock = stock + ? WHERE id = ?', [d.cantidad, d.producto_id]);
      }
    }
    await conn.query('UPDATE pedidos SET estado = ? WHERE id = ?', [nuevo, id]);
  });
  res.json({ id, estado: nuevo });
}));

module.exports = router;
