const router = require('express').Router();
const db = require('../db');
const v = require('../utils/validar');
const { ErrorHttp, asyncH } = require('../utils/errores');

const COLUMNAS_PRODUCTO = `
  p.id, p.sku, p.slug, p.nombre, p.personaje, p.descripcion, p.precio, p.precio_oferta,
  COALESCE(p.precio_oferta, p.precio) AS precio_final,
  p.stock, p.escala, p.altura_cm, p.material, p.fabricante, p.destacado, p.creado_en,
  f.id AS franquicia_id, f.nombre AS franquicia, f.slug AS franquicia_slug, f.color_acento,
  (SELECT i.ruta FROM producto_imagenes i WHERE i.producto_id = p.id ORDER BY i.orden, i.id LIMIT 1) AS imagen_principal`;

const ORDENES = {
  novedades: 'p.creado_en DESC, p.id DESC',
  precio_asc: 'precio_final ASC, p.id ASC',
  precio_desc: 'precio_final DESC, p.id ASC',
  nombre: 'p.nombre ASC',
};

router.get('/franquicias', asyncH(async (_req, res) => {
  const [filas] = await db.query(
    `SELECT f.id, f.nombre, f.slug, f.descripcion, f.color_acento,
            (SELECT COUNT(*) FROM productos p WHERE p.franquicia_id = f.id AND p.activo = 1) AS total_productos
       FROM franquicias f WHERE f.activa = 1 ORDER BY f.nombre`
  );
  res.json(filas);
}));

router.get('/productos', asyncH(async (req, res) => {
  const { q, franquicia, min, max, disponible, oferta, destacado, orden } = req.query;
  const donde = ['p.activo = 1', 'f.activa = 1'];
  const params = [];

  if (q) {
    const termino = `%${String(q).trim().slice(0, 80).replace(/[%_]/g, '\\$&')}%`;
    donde.push('(p.nombre LIKE ? OR p.personaje LIKE ? OR f.nombre LIKE ?)');
    params.push(termino, termino, termino);
  }
  if (franquicia) { donde.push('f.slug = ?'); params.push(String(franquicia)); }
  if (min !== undefined && min !== '') { donde.push('COALESCE(p.precio_oferta, p.precio) >= ?'); params.push(v.decimal(min, 'min')); }
  if (max !== undefined && max !== '') { donde.push('COALESCE(p.precio_oferta, p.precio) <= ?'); params.push(v.decimal(max, 'max')); }
  if (disponible === '1') donde.push('p.stock > 0');
  if (oferta === '1') donde.push('p.precio_oferta IS NOT NULL');
  if (destacado === '1') donde.push('p.destacado = 1');

  const limite = v.entero(req.query.limite ?? 60, 'limite', { min: 1, max: 100 });
  const [filas] = await db.query(
    `SELECT ${COLUMNAS_PRODUCTO}
       FROM productos p JOIN franquicias f ON f.id = p.franquicia_id
      WHERE ${donde.join(' AND ')}
      ORDER BY ${ORDENES[orden] || ORDENES.novedades}
      LIMIT ${limite}`,
    params
  );
  res.json(filas);
}));

router.get('/productos/:slug', asyncH(async (req, res) => {
  const [filas] = await db.query(
    `SELECT ${COLUMNAS_PRODUCTO}
       FROM productos p JOIN franquicias f ON f.id = p.franquicia_id
      WHERE p.slug = ? AND p.activo = 1 AND f.activa = 1`,
    [req.params.slug]
  );
  if (!filas.length) throw new ErrorHttp(404, 'No encontramos esa figura');
  const [imagenes] = await db.query(
    'SELECT id, ruta, alt, orden FROM producto_imagenes WHERE producto_id = ? ORDER BY orden, id',
    [filas[0].id]
  );
  res.json({ ...filas[0], imagenes });
}));

// Productos por id (para refrescar precio/stock del carrito guardado en el navegador)
router.post('/carrito/validar', asyncH(async (req, res) => {
  const ids = (Array.isArray(req.body.ids) ? req.body.ids : [])
    .slice(0, 50)
    .map((i) => v.entero(i, 'id', { min: 1 }));
  if (!ids.length) return res.json([]);
  const [filas] = await db.query(
    `SELECT ${COLUMNAS_PRODUCTO}
       FROM productos p JOIN franquicias f ON f.id = p.franquicia_id
      WHERE p.id IN (?) AND p.activo = 1`,
    [ids]
  );
  res.json(filas);
}));

// --- Registro de pedidos (transacción: todo o nada) ---
router.post('/pedidos', asyncH(async (req, res) => {
  const c = req.body.cliente || {};
  const cliente = {
    nombre: v.texto(c.nombre, 'nombre', { min: 2, max: 100 }),
    email: v.email(c.email, 'email'),
    telefono: v.texto(c.telefono, 'telefono', { max: 30, requerido: false }),
    direccion: v.texto(c.direccion, 'direccion', { min: 5, max: 255 }),
    ciudad: v.texto(c.ciudad, 'ciudad', { max: 100 }),
    pais: v.texto(c.pais, 'pais', { max: 80 }),
  };
  const notas = v.texto(req.body.notas, 'notas', { max: 500, requerido: false });

  if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
    throw new ErrorHttp(400, 'items: el pedido debe incluir al menos una figura');
  }
  if (req.body.items.length > 30) throw new ErrorHttp(400, 'items: máximo 30 líneas por pedido');

  // Unifica líneas repetidas y valida cantidades (nunca negativas ni cero)
  const pedidas = new Map();
  for (const it of req.body.items) {
    const id = v.entero(it.producto_id, 'producto_id', { min: 1 });
    const cant = v.entero(it.cantidad, 'cantidad', { min: 1, max: 99 });
    pedidas.set(id, (pedidas.get(id) || 0) + cant);
  }
  const ids = [...pedidas.keys()].sort((a, b) => a - b);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Bloquea las filas en orden de id para evitar deadlocks y ventas simultáneas del último ejemplar
    const [productos] = await conn.query(
      `SELECT id, nombre, precio, precio_oferta, stock, activo
         FROM productos WHERE id IN (?) ORDER BY id FOR UPDATE`,
      [ids]
    );
    const porId = new Map(productos.map((p) => [p.id, p]));

    const problemas = [];
    for (const id of ids) {
      const p = porId.get(id);
      const cant = pedidas.get(id);
      if (!p || !p.activo) problemas.push(`El producto #${id} ya no está disponible`);
      else if (p.stock < cant) {
        problemas.push(p.stock === 0
          ? `${p.nombre} está agotada`
          : `${p.nombre}: solo quedan ${p.stock} y pediste ${cant}`);
      }
    }
    if (problemas.length) throw new ErrorHttp(409, `No se registró el pedido. ${problemas.join('. ')}.`);

    // Total en centavos enteros para evitar errores de coma flotante
    let totalCent = 0;
    const lineas = ids.map((id) => {
      const p = porId.get(id);
      const unitCent = Math.round((p.precio_oferta ?? p.precio) * 100);
      totalCent += unitCent * pedidas.get(id);
      return { id, nombre: p.nombre, cantidad: pedidas.get(id), unitario: unitCent / 100 };
    });

    const [rc] = await conn.query(
      `INSERT INTO clientes (nombre, email, telefono, direccion, ciudad, pais)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), nombre = VALUES(nombre),
         telefono = VALUES(telefono), direccion = VALUES(direccion),
         ciudad = VALUES(ciudad), pais = VALUES(pais)`,
      [cliente.nombre, cliente.email, cliente.telefono, cliente.direccion, cliente.ciudad, cliente.pais]
    );

    const [rp] = await conn.query(
      `INSERT INTO pedidos (cliente_id, estado, total, direccion_envio, ciudad_envio, pais_envio, notas)
       VALUES (?, 'pendiente_pago', ?, ?, ?, ?, ?)`,
      [rc.insertId, totalCent / 100, cliente.direccion, cliente.ciudad, cliente.pais, notas]
    );
    const pedidoId = rp.insertId;

    await conn.query(
      'INSERT INTO pedido_detalles (pedido_id, producto_id, nombre_producto, cantidad, precio_unitario) VALUES ?',
      [lineas.map((l) => [pedidoId, l.id, l.nombre, l.cantidad, l.unitario])]
    );

    for (const l of lineas) {
      const [r] = await conn.query(
        'UPDATE productos SET stock = stock - ? WHERE id = ? AND stock >= ?',
        [l.cantidad, l.id, l.cantidad]
      );
      if (r.affectedRows !== 1) throw new ErrorHttp(409, `${l.nombre}: el stock cambió, intenta de nuevo`);
    }

    await conn.commit();
    res.status(201).json({
      pedido_id: pedidoId,
      estado: 'pendiente_pago',
      total: totalCent / 100,
      moneda: 'USD',
      pago_habilitado: false,
      mensaje:
        'Pedido registrado y figuras reservadas. El pago en línea todavía no está habilitado: no se realizó ningún cobro. Te contactaremos por correo para coordinar el pago.',
    });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

module.exports = router;
