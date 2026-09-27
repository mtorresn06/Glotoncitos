CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

DROP TABLE IF EXISTS pagos CASCADE;
DROP TABLE IF EXISTS detalles_pedido CASCADE;
DROP TABLE IF EXISTS pedidos CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS mesas CASCADE;
DROP TABLE IF EXISTS pisos CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS restaurantes CASCADE;

CREATE TABLE restaurantes (
    id_restaurante uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE CHECK (length(btrim(slug)) > 0),
    nombre text NOT NULL CHECK (length(btrim(nombre)) > 0),
    nit text UNIQUE,
    correo_admin citext NOT NULL CHECK (correo_admin ~* '^[^@\s]+@glotoncitos\.com$'),
    estado_suscripcion text NOT NULL DEFAULT 'activa'
        CHECK (estado_suscripcion IN ('activa', 'inactiva')),
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE roles (
    id_rol uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo text NOT NULL UNIQUE CHECK (codigo ~ '^[a-z][a-z0-9_]*$'),
    nombre text NOT NULL UNIQUE CHECK (length(btrim(nombre)) > 0),
    descripcion text NOT NULL DEFAULT '',
    creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usuarios (
    id_usuario uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL CHECK (length(btrim(nombre)) > 0),
    correo citext NOT NULL UNIQUE CHECK (correo ~* '^[^@\s]+@glotoncitos\.com$'),
    password_hash text NOT NULL,
    id_rol uuid NOT NULL REFERENCES roles(id_rol) ON DELETE RESTRICT,
    id_restaurante uuid NOT NULL REFERENCES restaurantes(id_restaurante) ON DELETE CASCADE,
    estado boolean NOT NULL DEFAULT true,
    creado_por uuid REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT usuarios_id_usuario_restaurante_unique UNIQUE (id_usuario, id_restaurante)
);

CREATE TABLE pisos (
    id_piso uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    id_restaurante uuid NOT NULL REFERENCES restaurantes(id_restaurante) ON DELETE CASCADE,
    numero integer NOT NULL CHECK (numero > 0),
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pisos_id_piso_restaurante_unique UNIQUE (id_piso, id_restaurante),
    CONSTRAINT pisos_numero_restaurante_unique UNIQUE (id_restaurante, numero)
);

CREATE TABLE mesas (
    id_mesa uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    id_restaurante uuid NOT NULL REFERENCES restaurantes(id_restaurante) ON DELETE CASCADE,
    id_piso uuid NOT NULL,
    numero integer NOT NULL CHECK (numero > 0),
    capacidad integer NOT NULL DEFAULT 1 CHECK (capacidad > 0),
    estado text NOT NULL DEFAULT 'libre'
        CHECK (estado IN ('libre', 'sin_atender', 'atendida', 'reservada')),
    ocupada_desde timestamptz,
    ocupada_personas integer CHECK (ocupada_personas IS NULL OR ocupada_personas > 0),
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT mesas_id_mesa_restaurante_unique UNIQUE (id_mesa, id_restaurante),
    CONSTRAINT mesas_piso_restaurante_fk
        FOREIGN KEY (id_piso, id_restaurante)
        REFERENCES pisos(id_piso, id_restaurante)
        ON DELETE RESTRICT,
    CONSTRAINT mesas_numero_piso_restaurante_unique UNIQUE (id_restaurante, id_piso, numero)
);

CREATE TABLE categorias (
    id_categoria uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL UNIQUE CHECK (length(btrim(nombre)) > 0),
    descripcion text NOT NULL DEFAULT '',
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE productos (
    id_producto uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    id_restaurante uuid NOT NULL REFERENCES restaurantes(id_restaurante) ON DELETE CASCADE,
    id_categoria uuid NOT NULL REFERENCES categorias(id_categoria) ON DELETE RESTRICT,
    nombre text NOT NULL CHECK (length(btrim(nombre)) > 0),
    descripcion text NOT NULL DEFAULT '',
    precio numeric(12, 2) NOT NULL CHECK (precio >= 0),
    tipo text NOT NULL DEFAULT 'plato'
        CHECK (tipo IN ('plato', 'bebida', 'postre', 'adicional', 'otro')),
    disponible boolean NOT NULL DEFAULT true,
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT productos_id_producto_restaurante_unique UNIQUE (id_producto, id_restaurante),
    CONSTRAINT productos_nombre_restaurante_unique UNIQUE (id_restaurante, nombre)
);

CREATE TABLE pedidos (
    id_pedido uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    id_restaurante uuid NOT NULL REFERENCES restaurantes(id_restaurante) ON DELETE CASCADE,
    id_mesa uuid NOT NULL,
    id_usuario uuid NOT NULL,
    fecha_hora timestamptz NOT NULL DEFAULT now(),
    estado text NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'en_preparacion', 'listo', 'cerrado', 'cancelado')),
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pedidos_id_pedido_restaurante_unique UNIQUE (id_pedido, id_restaurante),
    CONSTRAINT pedidos_mesa_restaurante_fk
        FOREIGN KEY (id_mesa, id_restaurante)
        REFERENCES mesas(id_mesa, id_restaurante)
        ON DELETE RESTRICT,
    CONSTRAINT pedidos_usuario_restaurante_fk
        FOREIGN KEY (id_usuario, id_restaurante)
        REFERENCES usuarios(id_usuario, id_restaurante)
        ON DELETE RESTRICT
);

CREATE TABLE detalles_pedido (
    id_detalle uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    id_pedido uuid NOT NULL,
    id_producto uuid NOT NULL,
    id_restaurante uuid NOT NULL,
    cantidad integer NOT NULL CHECK (cantidad > 0),
    notas text NOT NULL DEFAULT '',
    estado text NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'en_preparacion', 'listo', 'cancelado')),
    precio_unitario numeric(12, 2) NOT NULL CHECK (precio_unitario >= 0),
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT detalles_pedido_pedido_fk
        FOREIGN KEY (id_pedido, id_restaurante)
        REFERENCES pedidos(id_pedido, id_restaurante)
        ON DELETE CASCADE,
    CONSTRAINT detalles_producto_restaurante_fk
        FOREIGN KEY (id_producto, id_restaurante)
        REFERENCES productos(id_producto, id_restaurante)
        ON DELETE RESTRICT
);

CREATE TABLE pagos (
    id_pago uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    id_pedido uuid NOT NULL REFERENCES pedidos(id_pedido) ON DELETE RESTRICT,
    total numeric(12, 2) NOT NULL CHECK (total >= 0),
    metodo_pago text NOT NULL CHECK (metodo_pago IN ('efectivo', 'transferencia', 'qr', 'datafono')),
    estado text NOT NULL DEFAULT 'pagado'
        CHECK (estado IN ('pagado', 'fallido', 'revertido')),
    fecha timestamptz NOT NULL DEFAULT now(),
    id_usuario uuid REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX pedidos_mesa_activa_unique
    ON pedidos (id_mesa)
    WHERE estado NOT IN ('cerrado', 'cancelado');
CREATE UNIQUE INDEX pagos_pedido_activo_unique
    ON pagos (id_pedido)
    WHERE estado <> 'revertido';
CREATE INDEX restaurantes_estado_idx ON restaurantes (estado_suscripcion);
CREATE INDEX roles_codigo_idx ON roles (codigo);
CREATE INDEX usuarios_restaurante_idx ON usuarios (id_restaurante);
CREATE INDEX usuarios_rol_idx ON usuarios (id_rol);
CREATE INDEX pisos_restaurante_idx ON pisos (id_restaurante, numero);
CREATE INDEX mesas_piso_restaurante_idx ON mesas (id_restaurante, id_piso, numero);
CREATE INDEX mesas_restaurante_estado_idx ON mesas (id_restaurante, estado);
CREATE INDEX productos_restaurante_disponible_idx ON productos (id_restaurante, disponible);
CREATE INDEX productos_categoria_idx ON productos (id_categoria);
CREATE INDEX pedidos_restaurante_fecha_idx ON pedidos (id_restaurante, fecha_hora DESC);
CREATE INDEX pedidos_mesa_estado_idx ON pedidos (id_mesa, estado);
CREATE INDEX detalles_pedido_pedido_idx ON detalles_pedido (id_pedido);
CREATE INDEX detalles_pedido_producto_idx ON detalles_pedido (id_producto);
CREATE INDEX pagos_fecha_idx ON pagos (fecha DESC);
CREATE INDEX pagos_pedido_idx ON pagos (id_pedido);

INSERT INTO roles (codigo, nombre, descripcion) VALUES
    ('admin', 'Administrador', 'Administra usuarios, menú, mesas y reportes'),
    ('mesero', 'Mesero', 'Atiende mesas y registra pedidos'),
    ('cajero', 'Cajero', 'Gestiona cuentas y pagos'),
    ('cocina', 'Cocina', 'Prepara y actualiza pedidos')
ON CONFLICT (codigo) DO NOTHING;
