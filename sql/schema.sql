-- ANIMEVERSE FIGURES · esquema MySQL 8.0.16+ (necesario para las restricciones CHECK)
-- Compatible con Aiven: no usa CREATE DATABASE ni USE. Ejecútalo dentro de la base de datos elegida.

CREATE TABLE IF NOT EXISTS usuarios_admin (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre         VARCHAR(80)  NOT NULL,
  email          VARCHAR(150) NOT NULL,
  password_hash  VARCHAR(100) NOT NULL,
  activo         TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS clientes (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre     VARCHAR(100) NOT NULL,
  email      VARCHAR(150) NOT NULL,
  telefono   VARCHAR(30)  NULL,
  direccion  VARCHAR(255) NULL,
  ciudad     VARCHAR(100) NULL,
  pais       VARCHAR(80)  NULL,
  creado_en  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_clientes_email (email),
  KEY idx_clientes_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS franquicias (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre        VARCHAR(100) NOT NULL,
  slug          VARCHAR(120) NOT NULL,
  descripcion   VARCHAR(500) NULL,
  color_acento  CHAR(7)      NOT NULL DEFAULT '#D4A94F',
  activa        TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_franquicias_nombre (nombre),
  UNIQUE KEY uq_franquicias_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS productos (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  franquicia_id  INT UNSIGNED  NOT NULL,
  sku            VARCHAR(40)   NOT NULL,
  slug           VARCHAR(160)  NOT NULL,
  nombre         VARCHAR(160)  NOT NULL,
  personaje      VARCHAR(100)  NOT NULL,
  descripcion    TEXT          NULL,
  precio         DECIMAL(10,2) NOT NULL,
  precio_oferta  DECIMAL(10,2) NULL,
  stock          INT           NOT NULL DEFAULT 0,
  escala         VARCHAR(20)   NULL,
  altura_cm      DECIMAL(5,1)  NULL,
  material       VARCHAR(80)   NULL,
  fabricante     VARCHAR(100)  NULL,
  destacado      TINYINT(1)    NOT NULL DEFAULT 0,
  activo         TINYINT(1)    NOT NULL DEFAULT 1,
  creado_en      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_productos_sku (sku),
  UNIQUE KEY uq_productos_slug (slug),
  KEY idx_productos_franquicia (franquicia_id),
  KEY idx_productos_activo_precio (activo, precio),
  KEY idx_productos_creado (creado_en),
  CONSTRAINT fk_productos_franquicia FOREIGN KEY (franquicia_id) REFERENCES franquicias (id),
  CONSTRAINT ck_productos_precio CHECK (precio > 0),
  CONSTRAINT ck_productos_oferta CHECK (precio_oferta IS NULL OR (precio_oferta > 0 AND precio_oferta < precio)),
  CONSTRAINT ck_productos_stock CHECK (stock >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS producto_imagenes (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  producto_id  INT UNSIGNED NOT NULL,
  ruta         VARCHAR(500) NOT NULL,
  alt          VARCHAR(200) NULL,
  orden        TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_imagen_producto_ruta (producto_id, ruta(255)),
  KEY idx_imagenes_producto (producto_id, orden),
  CONSTRAINT fk_imagenes_producto FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pedidos (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  cliente_id      INT UNSIGNED  NOT NULL,
  estado          ENUM('pendiente_pago','pagado','enviado','entregado','cancelado') NOT NULL DEFAULT 'pendiente_pago',
  total           DECIMAL(12,2) NOT NULL,
  direccion_envio VARCHAR(255)  NULL,
  ciudad_envio    VARCHAR(100)  NULL,
  pais_envio      VARCHAR(80)   NULL,
  notas           VARCHAR(500)  NULL,
  creado_en       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pedidos_cliente (cliente_id),
  KEY idx_pedidos_estado_fecha (estado, creado_en),
  CONSTRAINT fk_pedidos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id),
  CONSTRAINT ck_pedidos_total CHECK (total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pedido_detalles (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  pedido_id        INT UNSIGNED  NOT NULL,
  producto_id      INT UNSIGNED  NOT NULL,
  nombre_producto  VARCHAR(160)  NOT NULL,
  cantidad         INT           NOT NULL,
  precio_unitario  DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_detalle_pedido_producto (pedido_id, producto_id),
  KEY idx_detalles_producto (producto_id),
  CONSTRAINT fk_detalles_pedido   FOREIGN KEY (pedido_id)   REFERENCES pedidos (id)   ON DELETE CASCADE,
  CONSTRAINT fk_detalles_producto FOREIGN KEY (producto_id) REFERENCES productos (id),
  CONSTRAINT ck_detalles_cantidad CHECK (cantidad > 0),
  CONSTRAINT ck_detalles_precio   CHECK (precio_unitario > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
