

const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const QRCode = require('qrcode');
const app = express();
let ultimoQR = "";
let estado = 'Iniciando...';

app.get('/', (req, res) => res.send('KAIROS BOT ACTIVO 👑'));
app.get('/qr', async (req, res) => {
  if (!ultimoQR) return res.send(`<h1>${estado}</h1>`);
  const img = await QRCode.toDataURL(ultimoQR);
  res.send(`<h1>ESCANEA ESTE QR CON WHATSAPP</h1><img src="${img}">`);
});
app.listen(process.env.PORT || 3000);

// ===== CONFIG KAIROS 👑 =====
let TASA_MN = 400; // Cambias con: tasa 450
let CONTADOR_VALE = 1;
let pedidos = {}; // memoria por cliente

const GROUP_ID = "120207xxx@g.us"; // 👑 PON TU ID DE GRUPO VIEJO AQUÍ

const MENSAJERIA = [
  { zona: "san miguel", precio: 1000 },
  { zona: "san miguel", k: ["entrincado","intrincado"], precio: 1500 },
  { zona: "guanabacoa", k: ["via blanca","debeche","mañana","centro guanabacoa"], precio: 2000 },
  { zona: "guanabacoa", k: ["roble","jata","mikito","naranjo"], precio: 2500 },
  { zona: "guanabacoa", k: ["puente de santa fe","santa fe"], precio: 3000 },
  { zona: "guanabacoa", k: ["barreras","minas"], precio: 4000 },
  { zona: "campo florido", precio: 5000 },
  { zona: "regla", precio: 2000 },
  { zona: "casa blanca", precio: 2500 },
  { zona: "bahia", precio: 2500 },
  { zona: "cojimar", precio: 2500 },
  { zona: "villa panamericana", precio: 2500 },
  { zona: "alamar", precio: 2500 },
  { zona: "alamar", k: ["zona 17","zona 18","micro x","calle ancha"], precio: 3000 },
  { zona: "camilo", precio: 2500 },
  { zona: "cotorro", k: ["centro"], precio: 2500 },
  { zona: "cotorro", k: ["paradero"], precio: 3000 },
  { zona: "cotorro", k: ["santa maria","al berro","loma de tierra"], precio: 3500 },
  { zona: "cuatro camino", precio: 4000 },
  { zona: "diez de octubre", precio: 2000 },
  { zona: "vibora", precio: 2000 },
  { zona: "lawton", precio: 2000 },
  { zona: "arroyo naranjo", precio: 2500 },
  { zona: "calabazar", precio: 3000 },
  { zona: "reparto electrico", precio: 2500 },
  { zona: "managua", precio: 4000 },
  { zona: "guasimas", precio: 3500 },
  { zona: "centro habana", precio: 2000 },
  { zona: "habana vieja", precio: 2000 },
  { zona: "cerro", precio: 2000 },
  { zona: "cerro", k: ["casino","ayestaran","boyero","camaguey"], precio: 2500 },
  { zona: "vedado", precio: 2000 },
  { zona: "plaza", precio: 2000 },
  { zona: "playa", precio: 3000 },
  { zona: "playa", k: ["despues del paradero","después del paradero"], precio: 3500 },
  { zona: "jaimanita", precio: 4000 },
  { zona: "santa fe playa", precio: 4500 },
  { zona: "marianao", precio: 3500 },
  { zona: "lisa", precio: 3500 },
  { zona: "lisa", k: ["despues de 222","después de 222"], precio: 4000 },
  { zona: "punta brava", precio: 5000 },
  { zona: "valle grande", precio: 5000 },
  { zona: "arroyo arena", precio: 4500 },
  { zona: "san agustin", precio: 4000 },
  { zona: "guanabo", precio: 6000 },
  { zona: "cien y aldabo", precio: 3000 },
  { zona: "boyero", k: ["alta habana"], precio: 3000 },
  { zona: "boyero", precio: 4000 },
  { zona: "santiago de las vegas", precio: 4500 },
  { zona: "wajay", precio: 5000 },
  { zona: "el chico", precio: 5000 },
];

function calcularMensajeria(direccion) {
  let dir = direccion.toLowerCase();
  let enc = null;
  for (let m of MENSAJERIA) {
    if (m.k && m.k.some(k => dir.includes(k))) { enc = m; break; }
  }
  if (!enc) for (let m of MENSAJERIA) { if (dir.includes(m.zona)) { enc = m; break; } }
  return enc ? enc.precio : null;
}

async function start() {
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({ version, logger: pino({ level: 'silent' }), auth: state, browser: ["Kairos Bot", "Chrome", "1.0"] });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u;
    estado = 'Conexion: ' + connection;
    if (qr) { ultimoQR = qr; estado = 'QR LISTO - ESCANEALO RAPIDO'; }
    if (connection === 'open') { estado = 'BOT LISTO CONECTADO ✅'; ultimoQR = ''; }
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) start();
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;
    const rawText = (m.message.conversation || m.message.extendedTextMessage?.text || '');
    const text = rawText.toLowerCase().trim();
    const from = m.key.remoteJid;
    const send = async (t) => { await sock.sendMessage(from, { text: t }); };

    // 👑 COMANDOS SOLO TUYOS - TASA MANUAL
    if (text.startsWith('tasa ')) {
      let valor = parseInt(text.replace('tasa ', ''));
      if (!isNaN(valor)) { TASA_MN = valor; await send(`✅ Listo 👑 Tasa puesta: ${TASA_MN} CUP\nAhora 1 USD = ${TASA_MN} CUP`); return; }
    }
    if (text === 'tasa actual') { await send(`Tasa actual: ${TASA_MN} CUP\nModo: MANUAL`); return; }

    // ===== FLUJO =====
    let ped = pedidos[from] || { paso: 'inicio' };

    // 1. SALUDO / CATALOGO
    if (text.includes('hola') || text.includes('menu') || text.includes('catalogo') || text === '1') {
      pedidos[from] = { paso: 'catalogo' };
      await send(`Hola, bendecido día para UD 🙏\nBienvenido a KAIROS SHOP 👑\n\n📋 CATÁLOGO:\n✅ Pedestal 18" - *23 USD*\n✅ J10 Recargable - *40 USD*\n✅ F6 SACO - *35 USD*\n✅ Bee F6 - *32 USD* / Mayor: 30 USD\n✅ F39 Solar - *42 USD*\n✅ F22 SACO - *70 USD*\n\nNuevo en caja + Garantía 15 días\nMensajería en toda La Habana\n\n¿Cuál quieres? Escribe el modelo, ej: *J10*`);
      return;
    }

    // 2. ELEGIR EQUIPO
    if (text.includes('j10')) { pedidos[from] = { paso: 'elegido', producto: 'J10 Recargable', precio: 40 }; await send(`✅ *J10 RECARGABLE - 40 USD*\nSolar + Bluetooth + Luz + Radio FM\nBatería 20.000 mAh, hasta 12h\n\n¿Desea ver otros equipos?\n\n1. Sí, ver otros\n2. No, ya escogí / Quiero pedir este`); return; }
    if (text.includes('f39')) { pedidos[from] = { paso: 'elegido', producto: 'F39 Solar', precio: 42 }; await send(`✅ *F39 SOLAR - 42 USD*\nSolar + Bluetooth + Luz\n\n¿Desea ver otros equipos?\n\n1. Sí, ver otros\n2. No, ya escogí`); return; }
    if (text.includes('f22')) { pedidos[from] = { paso: 'elegido', producto: 'F22 SACO', precio: 70 }; await send(`✅ *F22 SACO - 70 USD*\n\n¿Desea ver otros equipos?\n\n1. Sí, ver otros\n2. No, ya escogí`); return; }
    if (text.includes('f6')) { pedidos[from] = { paso: 'elegido', producto: 'F6 SACO', precio: 35 }; await send(`✅ *F6 SACO - 35 USD*\n✅ Bee F6 - 32 USD / Mayor: 30 USD\n\n¿Desea ver otros equipos?\n\n1. Sí, ver otros\n2. No, ya escogí`); return; }
    if (text.includes('pedestal') || text === '18') { pedidos[from] = { paso: 'elegido', producto: 'Pedestal 18"', precio: 23 }; await send(`✅ *Pedestal 18" - 23 USD*\n\n¿Desea ver otros equipos?\n\n1. Sí, ver otros\n2. No, ya escogí`); return; }

    // 3. VER OTROS / YA ESCOGI
    if (ped.paso === 'elegido' && text === '1') {
      await send(`📋 CATÁLOGO:\n✅ Pedestal 18" - *23 USD*\n✅ J10 - *40 USD*\n✅ F6 - *35 USD*\n✅ F39 - *42 USD*\n✅ F22 - *70 USD*\n\nEscribe el modelo:`); return;
    }
    if (ped.paso === 'elegido' && (text === '2' || text.includes('ya escogi') || text.includes('quiero pedir') || text.includes('no'))) {
      ped.paso = 'direccion'; pedidos[from] = ped;
      await send(`Perfecto 👑 Vamos a apartar tu *${ped.producto} - ${ped.precio} USD*\n\nPásame tu dirección exacta para calcular la mensajería 📍\nEj: *San Miguel, Entrincado*`); return;
    }

    // 4. DIRECCION -> MENSAJERIA
    if (ped.paso === 'direccion') {
      let precioMens = calcularMensajeria(rawText);
      if (precioMens === null) { await send(`No encontré esa zona 😅\nEscríbeme tu municipio + reparto, ej: *Guanabacoa, El Roble*`); return; }
      ped.direccion = rawText; ped.mensajeria = precioMens; ped.paso = 'pago'; pedidos[from] = ped;
      await send(`📍 Dirección: ${rawText}\n🚚 Mensajería: *${precioMens} CUP*\n\n¿Cómo desea pagar?\n\n1. 💵 USD - ${ped.precio} USD + ${precioMens} CUP mensajería\n2. 💶 Euros - ${ped.precio} Euros + ${precioMens} CUP mensajería\n3. 💰 MN - ${ped.precio * TASA_MN} MN (${ped.precio} USD x ${TASA_MN}) + ${precioMens} CUP mensajería\n\nEscriba 1, 2 o 3`);
      return;
    }

    // 5. PAGO -> NOTA
    if (ped.paso === 'pago' && ['1','2','3'].includes(text)) {
      if (text === '1') ped.pago = `${ped.precio} USD + ${ped.mensajeria} CUP mensajería`;
      if (text === '2') ped.pago = `${ped.precio} Euros + ${ped.mensajeria} CUP mensajería`;
      if (text === '3') ped.pago = `${ped.precio * TASA_MN} MN + ${ped.mensajeria} CUP mensajería`;
      ped.paso = 'nota'; pedidos[from] = ped;
      await send(`Perfecto 👑 Ya casi terminamos.\n\n¿Tiene alguna duda o algo que quiera dejarnos saber?\n\nEj:\n- "Después de las 2"\n- "Traer vuelto de 100 USD"\n- "Llamar antes de llegar"\n\n✍️ Escriba su nota aquí...\nO escriba "No" si no tiene ninguna`);
      return;
    }

    // 6. NOTA -> NOMBRE Y TELEFONO
    if (ped.paso === 'nota') {
      ped.nota = (text === 'no' ? 'Sin nota' : rawText);
      ped.paso = 'datos'; pedidos[from] = ped;
      await send(`Anotado ✅ Nota: *${ped.nota}*\n\nAhora pásame tu *nombre y teléfono*\nEj: *Louis, 55551234*`);
      return;
    }

    // 7. DATOS -> VALE + ENVIAR AL GRUPO
    if (ped.paso === 'datos') {
      ped.nombre = rawText;
      let numeroVale = `KAIROS-${String(CONTADOR_VALE).padStart(3, '0')}`;
      CONTADOR_VALE++;

      await send(`✅ Pedido confirmado 👑\n\n🧾 Su número de vale es: *${numeroVale}*\nGuarde este número para reclamar su pedido.\n\n📦 Producto: ${ped.producto} - ${ped.precio} USD\n💰 Pago: ${ped.pago}\n🚚 Mensajería: ${ped.mensajeria} CUP\n📍 Dirección: ${ped.direccion}\n📝 Nota: ${ped.nota}\n\nGracias por comprar en KAIROS SHOP 👑`);

      // Mandar al grupo
      try {
        await sock.sendMessage(GROUP_ID, { text: `🔔 *NUEVO VALE ${numeroVale}*\n\n👤 Cliente: ${ped.nombre}\n📍 Dirección: ${ped.direccion}\n\n📦 Producto: ${ped.producto}\n💰 Pago: ${ped.pago}\n🚚 Mensajería: ${ped.mensajeria} CUP\n\n📝 NOTA: ${ped.nota}\n\n¡Atender! 👑` });
      } catch(e) { console.log('Error grupo', e); }

      delete pedidos[from];
      return;
    }

    // Compatibilidad con tu comando viejo "SI"
    if (text.includes('si')) { await send(`¡Perfecto! ✅ Te lo aparto.\nPásame tu nombre, teléfono y dirección exacta para la mensajería.`); return; }
  });
}
start();
