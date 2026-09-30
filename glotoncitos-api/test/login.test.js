import assert from 'node:assert/strict'
import { after, before, mock, test } from 'node:test'
import bcrypt from 'bcryptjs'

process.env.JWT_SECRET = 'unit-test-secret'
process.env.CORS_ORIGIN = 'http://localhost:5173'

const CONTRASENA_LARGA = 'ContrasenaLarga2026'
const CONTRASENA_CORTA = 'corta123'
const RESTAURANTE = '19c0ecf8-4ac1-4751-a3f1-f87d86389492'

const hashLargo = await bcrypt.hash(CONTRASENA_LARGA, 4)
const hashCorto = await bcrypt.hash(CONTRASENA_CORTA, 4)

function usuario({ id, correo, passwordHash, rol = 'cajero', estado = true, suscripcion = 'activa' }) {
  return {
    id_usuario: id,
    nombre: `Usuario ${correo}`,
    correo,
    password_hash: passwordHash,
    estado,
    id_rol: '9b2f5b6a-6d84-4f0e-9c1a-1f2a3b4c5d6e',
    codigo: rol,
    role_name: rol,
    role_description: '',
    id_restaurante: RESTAURANTE,
    restaurant_name: 'Glotoncitos',
    nit: '20600000000',
    estado_suscripcion: suscripcion,
  }
}

const USUARIOS = [
  usuario({ id: '11111111-1111-4111-8111-111111111111', correo: 'ok@glotoncitos.com', passwordHash: hashLargo }),
  usuario({ id: '22222222-2222-4222-8222-222222222222', correo: 'corto@glotoncitos.com', passwordHash: hashCorto }),
  usuario({ id: '33333333-3333-4333-8333-333333333333', correo: 'inactivo@glotoncitos.com', passwordHash: hashLargo, estado: false }),
  usuario({
    id: '44444444-4444-4444-8444-444444444444',
    correo: 'suscripcion@glotoncitos.com',
    passwordHash: hashLargo,
    suscripcion: 'vencida',
  }),
]

const consultas = []

mock.module('../src/db/pool.js', {
  namedExports: {
    pool: {
      query: async (texto, parametros = []) => {
        consultas.push({ texto, parametros })
        if (!texto.includes('FROM usuarios')) return { rows: [], rowCount: 0 }
        const correo = parametros[0]
        const fila = USUARIOS.find((u) => u.correo === correo)
        return { rows: fila ? [fila] : [], rowCount: fila ? 1 : 0 }
      },
    },
  },
})

const { login } = await import('../src/services/auth-service.js')

let contadorCorreos = 0

// cada correo unico se registra en la base simulada para poder separa los contadores
function correoUnico(nombre) {
  contadorCorreos += 1
  const correo = `${nombre}-${contadorCorreos}-${Date.now()}@glotoncitos.com`
  USUARIOS.push(usuario({ id: `correo-${nombre}-${contadorCorreos}`, correo, passwordHash: hashLargo }))
  return correo
}

async function intento(email, password, ip) {
  try {
    return { status: 200, body: await login({ email, password }, { ip }) }
  } catch (error) {
    return { status: error.status, body: { code: error.code, message: error.message, details: error.details } }
  }
}

before(() => {
  consultas.length = 0
})

after(() => {
  mock.reset()
})

test('inicia sesion con credenciales correctas', async () => {
  const email = correoUnico('exito')
  const { status, body } = await intento(email, CONTRASENA_LARGA, '10.0.0.1')

  assert.equal(status, 200)
  assert.ok(body.access_token)
  assert.equal(body.token_type, 'Bearer')
  assert.equal(body.user.email, email)
  assert.equal(body.user.roles[0].code, 'cajero')
  assert.equal(body.user.restaurant.id, RESTAURANTE)
})

test('normaliza el correo antes de buscarlo', async () => {
  const email = correoUnico('normaliza')
  const { status } = await intento(`  ${email.toUpperCase()} `, CONTRASENA_LARGA, '10.0.0.2')

  assert.equal(status, 200)
  const consulta = consultas.at(-1)
  assert.equal(consulta.parametros[0], email)
})

test('rechaza correo inexistente con 401', async () => {
  const { status, body } = await intento('no-existe@glotoncitos.com', CONTRASENA_LARGA, '10.0.0.3')

  assert.equal(status, 401)
  assert.equal(body.code, 'UNAUTHORIZED')
  assert.equal(body.message, 'Invalid email or password')
})

test('rechaza contrasena incorrecta con 401', async () => {
  const { status, body } = await intento(correoUnico('mala'), 'ContrasenaEquivocada1', '10.0.0.4')

  assert.equal(status, 401)
  assert.equal(body.message, 'Invalid email or password')
})

test('rechaza usuario inactivo y suscripcion vencida con 401', async () => {
  const inactivo = await intento('inactivo@glotoncitos.com', CONTRASENA_LARGA, '10.0.0.5')
  assert.equal(inactivo.status, 401)

  const vencido = await intento('suscripcion@glotoncitos.com', CONTRASENA_LARGA, '10.0.0.5')
  assert.equal(vencido.status, 401)
  assert.equal(vencido.body.message, 'Restaurant subscription is inactive')
})

test('valida la longitud de la contrasena despues de comparar el hash', async () => {
  const { status, body } = await intento('corto@glotoncitos.com', CONTRASENA_CORTA, '10.0.0.6')

  assert.equal(status, 400)
  assert.equal(body.code, 'BAD_REQUEST')
  assert.match(body.message, /between 12 and 128/)
})

test('no valida la longitud si las credenciales son incorrectas', async () => {
  const { status, body } = await intento('corto@glotoncitos.com', 'otraClaveDistinta', '10.0.0.7')

  assert.equal(status, 401)
  assert.equal(body.message, 'Invalid email or password')
})

test('rechaza correos que no son del dominio con 400 sin consultar la base', async () => {
  const antes = consultas.length
  const { status, body } = await intento('usuario@otro.com', CONTRASENA_LARGA, '10.0.0.8')

  assert.equal(status, 400)
  assert.match(body.message, /@glotoncitos\.com/)
  assert.equal(consultas.length, antes, 'no debe consultar la base si el correo es invalido')
})

test('bloquea el correo por 5 minutos tras 3 intentos fallidos', async () => {
  const email = correoUnico('bloqueo')
  const ip = '10.0.1.1'

  for (let intentoNumero = 1; intentoNumero <= 3; intentoNumero += 1) {
    const { status } = await intento(email, `ContrasenaIncorrecta${intentoNumero}`, ip)
    assert.equal(status, 401, `el intento ${intentoNumero} deberia responder 401`)
  }

  const cuarto = await intento(email, 'ContrasenaIncorrecta4', ip)
  assert.equal(cuarto.status, 429)
  assert.equal(cuarto.body.code, 'TOO_MANY_REQUESTS')
  assert.match(cuarto.body.message, /Demasiados intentos fallidos/)
  assert.equal(cuarto.body.details.retryAfterMinutes, 5)
})

test('el bloqueo por correo no vence antes de los 5 minutos', async () => {
  const email = correoUnico('vence')
  const ip = '10.0.1.2'

  for (let n = 1; n <= 3; n += 1) {
    await intento(email, `ContrasenaIncorrecta${n}`, ip)
  }

  const durante = await intento(email, CONTRASENA_LARGA, ip)
  assert.equal(durante.status, 429, 'la contrasena correcta tambien debe quedar bloqueada')
})

test('bloquea tambien por direccion ip', async () => {
  const ip = '10.0.1.3'

  for (let n = 1; n <= 3; n += 1) {
    await intento(correoUnico(`ip-${n}`), `ContrasenaIncorrecta${n}`, ip)
  }

  const otro = await intento(correoUnico('ip-otro'), 'ContrasenaIncorrecta9', ip)
  assert.equal(otro.status, 429)
  assert.equal(otro.body.code, 'TOO_MANY_REQUESTS')
})

test('reinicia el contador cuando el ingreso es correcto', async () => {
  const email = correoUnico('reinicia')
  const ip = '10.0.1.4'

  await intento(email, 'ContrasenaIncorrecta1', ip)
  await intento(email, 'ContrasenaIncorrecta2', ip)
  const exitoso = await intento(email, CONTRASENA_LARGA, ip)
  assert.equal(exitoso.status, 200)

  const cuarto = await intento(email, 'ContrasenaIncorrecta3', ip)
  assert.equal(cuarto.status, 401, 'el contador debio reiniciarse tras el ingreso correcto')
})
