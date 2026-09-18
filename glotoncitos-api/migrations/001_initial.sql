CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE businesses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE CHECK (length(btrim(slug)) > 0),
    name text NOT NULL CHECK (length(btrim(name)) > 0),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_]*$'),
    name text NOT NULL UNIQUE,
    description text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    email citext NOT NULL UNIQUE,
    password_hash text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT users_id_business_id_unique UNIQUE (id, business_id)
);

CREATE TABLE user_roles (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, role_id, business_id),
    CONSTRAINT user_roles_user_business_fk
        FOREIGN KEY (user_id, business_id)
        REFERENCES users(id, business_id)
        ON DELETE CASCADE
);

CREATE INDEX users_business_id_idx ON users (business_id);
CREATE INDEX user_roles_business_id_idx ON user_roles (business_id);
CREATE INDEX user_roles_role_id_idx ON user_roles (role_id);

INSERT INTO roles (code, name, description) VALUES
    ('admin', 'Administrador', 'Administra usuarios y consulta el panel administrativo'),
    ('mesero', 'Mesero', 'Atiende mesas y registra pedidos'),
    ('cajero', 'Cajero', 'Gestiona cuentas y pagos'),
    ('cocina', 'Cocina', 'Prepara y actualiza pedidos')
ON CONFLICT (code) DO NOTHING;
