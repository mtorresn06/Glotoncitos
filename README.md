Glotoncitos

Sistema de gestión para restaurante: administración de mesas, pedidos y ventas, con control de acceso por rol de usuario.

Tecnologías

Frontend (/glotoncitos/client)

Vue 3 + Vite
Pinia (manejo de estado)
Vue Router
Tailwind CSS
Axios

Backend (/glotoncitos/server)

Node.js + Express
Prisma ORM
PostgreSQL
JWT para autenticación
bcryptjs para hash de contraseñas
Estructura del proyecto
glotoncitos/
├── client/          # Aplicación Vue
│   └── src/
│       ├── components/
│       ├── views/
│       ├── stores/
│       └── router/
└── server/          # API Express
    ├── prisma/      # Esquema y migraciones de base de datos
    └── src/
        ├── controllers/
        ├── routes/
        ├── middleware/
        └── config/
Roles de usuario
Rol	Descripción
ADMINISTRADOR	Acceso completo al sistema
MESERO	Gestión de mesas y pedidos
COCINA	Visualización y actualización del estado de preparación
CAJERO	Registro de ventas y cobros
Requisitos previos
Node.js (v18 o superior recomendado)
PostgreSQL
Instalación y configuración
1. Clonar el repositorio
bash
git clone https://github.com/mtorresn06/Glotoncitos.git
cd Glotoncitos/glotoncitos
2. Backend
bash
cd server
npm install
cp .env.example .env   # completa DATABASE_URL, DIRECT_URL y JWT_SECRET
npm run prisma:migrate
npm run seed            # opcional: carga datos de prueba
npm run dev
3. Frontend
bash
cd client
npm install
cp .env.example .env   # completa VITE_API_URL
npm run dev

La API queda disponible por defecto en http://localhost:3000 y el cliente en el puerto que indique Vite (usualmente http://localhost:5173).

Scripts disponibles

Server

npm run dev — inicia el servidor en modo desarrollo
npm run prisma:migrate — ejecuta las migraciones de la base de datos
npm run prisma:studio — abre Prisma Studio para explorar los datos
npm run seed — carga datos iniciales de prueba

Client

npm run dev — servidor de desarrollo
npm run build — genera la build de producción