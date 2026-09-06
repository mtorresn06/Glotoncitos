import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Glotoncitos2026', 10);

  // Un usuario de prueba por rol (RF-01, RF-02)
  await prisma.usuario.createMany({
    data: [
      { nombre: 'Admin Demo', email: 'admin@glotoncitos.test', passwordHash, rol: 'ADMINISTRADOR' },
      { nombre: 'Mesero Demo', email: 'mesero@glotoncitos.test', passwordHash, rol: 'MESERO' },
      { nombre: 'Cocina Demo', email: 'cocina@glotoncitos.test', passwordHash, rol: 'COCINA' },
      { nombre: 'Cajero Demo', email: 'cajero@glotoncitos.test', passwordHash, rol: 'CAJERO' },
    ],
    skipDuplicates: true,
  });

  // Mesas del "Piso 1" replicando el mockup (Mesa 1..4)
  await prisma.mesa.createMany({
    data: [
      { numero: 1, piso: 1 },
      { numero: 2, piso: 1 },
      { numero: 3, piso: 1 },
      { numero: 4, piso: 1 },
    ],
    skipDuplicates: true,
  });

  // Un par de productos base del menú (RF-03)
  await prisma.producto.createMany({
    data: [
      { nombre: 'Bandeja paisa', precio: 25000, categoria: 'Plato fuerte' },
      { nombre: 'Limonada natural', precio: 8000, categoria: 'Bebida' },
    ],
    skipDuplicates: true,
  });

  console.log('Seed completado. Usuarios de prueba (contraseña: Glotoncitos2026):');
  console.log('  admin@glotoncitos.test / mesero@glotoncitos.test / cocina@glotoncitos.test / cajero@glotoncitos.test');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
