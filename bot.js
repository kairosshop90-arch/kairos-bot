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
let TASA_SITIO = 915;
let TASA_MN = 925; // Sitio + 10
let MODO = "auto";
let CONTADOR_VALE = 1;
let pedidos = {};
let comisiones = {}; // { "nombre": {ventas:0, total:0} }

const ADMIN_NUMERO = "5356947882@s.whatsapp.net";

// ===== ALMACEN - SOLO TU LO ACTUALIZAS =====
let ALMACEN = {
  "J10": 10, "F6": 10, "BEE F6": 10, "F39": 10, "F22": 10,
  "PEDESTAL": 10, "NEVERA": 5, "FRIO": 5, "EXHIBIDORA": 3, "TV": 5, "COLCHON": 5
};

// ===== CATALOGO = MISMA INFO DEL CANAL - SOLO TEXTO, SIN FOTO =====
const CATALOGO = {
  "J10": { nombre: "J10 Recargable", precio: 40, desc: "Solar + Bluetooth + Luz + Radio FM\nBatería 20.000 mAh, hasta 12h" },
  "F39": { nombre: "F39 Solar", precio: 42, desc: "Solar + Bluetooth + Luz\nBatería larga duración" },
  "F22": { nombre: "F22 SACO", precio: 70, desc: "SACO Grande - Potente, Bluetooth + Luz + Solar" },
  "F6": { nombre: "F6 SACO", precio: 35, desc: "SACO - Bluetooth + Luz" },
  "BEE F6": { nombre: "Bee F6", precio: 32, desc: "Bee F6 - 32 USD / Mayor: 30 USD" },
  "PEDESTAL": { nombre: 'Pedestal 18"', precio: 23, desc: 'Ventilador Pedestal 18" - 3 velocidades' },
  "NEVERA": { nombre: "Nevera", precio: 0, desc: "Preguntar modelo - 11 pies / 16 pies disponibles" },
  "FRIO": { nombre: "Frío", precio: 0, desc: "Frío 15 pies en adelante" },
  "EXHIBIDORA": { nombre: "Exhibidora", precio: 0, desc: "Exhibidora con cristales - MUCHO CUIDADO" },
  "TV": { nombre: "TV", precio: 0, desc: "TV - Preguntar pulgadas" },
  "COLCHON": { nombre: "Colchón", precio: 0, desc: "Colchón - Preguntar medida" }
};

const EQUIPOS_GRANDES = ["NEVERA", "FRIO", "EXHIBIDORA", "TV", "COLCHON"];

// ===== TASA ELTOQUE +10 CADA 2H =====
async function verificarTasaUSD() {
  if (MODO === "manual") return;
  try {
    const res = await fetch("https://api.eltoque.com/v1/trmi");
    const data = await res.json();
    const usd = data.find(m => m.currency === "USD");
    if (usd) { TASA_SITIO = usd.price || usd.valor; TASA_MN = TASA_SITIO + 10; console.log(`✅ Auto: ${TASA_SITIO} +10 = ${TASA_MN}`); }
  } catch(e) { console.log("Sin internet, mantengo:", TASA_MN); }
}
setInterval(verificarTasaUSD, 7200000);
verificarTasaUSD();

// ===== MENSAJERIA =====
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

function calcularMensajeria(direccion, productos, textoCompleto) {
  let dir = direccion.toLowerCase();
  let enc = null;
  for (let m of MENSAJERIA) { if (m.k && m.k.some(k => dir.includes(k))) { enc = m; break; } }
  if (!enc) for (let m of MENSAJERIA) { if (dir.includes(m.zona)) { enc = m; break; } }
  if (!enc) return null;
  let base = enc.precio;
  let esGrande = productos.some(p => EQUIPOS_GRANDES.includes(p.clave));
  let totalEquipos = productos.reduce((s,p)=>s+p.cant,0);
  let final = base;
  let detalle = `Base ${base} CUP`;
  if (esGrande || totalEquipos >= 3) { final = base * 2; detalle += ` x2 (grande / 3+ equipos) = ${final}`; }
  let txt = textoCompleto.toLowerCase();
  if (txt.includes("nevera 11") || txt.includes("nevera 16") || txt.includes("11 pies") || txt.includes("16 pies")) { final += 500; detalle += ` +500 Nevera 11/16 pies`; }
  if (productos.some(p=>p.clave==="EXHIBIDORA")) { final += 1000; detalle += ` +1000 Exhibidora (cristales, mucho cuidado)`; }
  if (txt.includes("frio 15") || txt.includes("15 pies") || txt.includes("16 pies") || txt.includes("17 pies") || txt.includes("18 pies") || txt.includes("20 pies")) {
    // Solo si es frio
    if (productos.some(p=>p.clave==="FRIO")) { final += 800; detalle += ` +800 Frío 15+ pies`; }
  }
  return { precio: final, detalle };
}

function buscarProducto(texto) {
  let t = texto.toUpperCase();
  if (t.includes("BEE")) return "BEE F6";
  if (t.includes("J10")) return "J10";
  if (t.includes("F39")) return "F39";
  if (t.includes("F22")) return "F22";
  if (t.includes("F6")) return "F6";
  if (t.includes("PEDESTAL") || t === "18") return "PEDESTAL";
  if (t.includes("NEVERA")) return "NEVERA";
  if (t.includes("EXHIBIDORA")) return "EXHIBIDORA";
  if (t.includes("FRIO") || t.includes("FRÍO")) return "FRIO";
  if (t.includes("TV")) return "TV";
  if (t.includes("COLCHON") || t.includes("COLCHÓN")) return "COLCHON";
  return null;
}

async function start() {
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({ version, logger: pino({ level: 'silent' }), auth: state, browser: ["Kairos Bot", "Chrome", "1.0"] });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u;
    estado = 'Conexion: ' + connection;
    if (qr) { ultimoQR = qr; estado = 'QR LISTO'; }
    if (connection === 'open') { estado = 'BOT LISTO ✅'; ultimoQR = ''; }
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
    if (from.endsWith('@g.us')) return;
    const send = async (t) => { await sock.sendMessage(from, { text: t }); };
    const esAdmin = (from === ADMIN_NUMERO);

    // ===== SOLO ADMIN: ALMACEN =====
    if (esAdmin && text.startsWith('actualizar stock')) {
      // Ej: actualizar stock J10 5
      let partes = rawText.split(' ');
      let cant = parseInt(partes[partes.length-1]);
      let clave = partes.slice(2, -1).join(' ').toUpperCase();
      if (ALMACEN[clave] !== undefined && !isNaN(cant)) {
        ALMACEN[clave] = cant;
        await send(`✅ Almacén actualizado 👑\n${clave} = ${cant} disponibles`);
      } else await send(`No encontré ese producto. Ej: actualizar stock J10 5`);
      return;
    }
    if (esAdmin && text === 'ver almacen') {
      let txt = `📦 *ALMACÉN KAIROS*\n\n`;
      for (let k in ALMACEN) txt += `${k}: ${ALMACEN[k]}\n`;
      await send(txt); return;
    }
    if (esAdmin && text === 'comisiones') {
      let txt = `💰 *COMISIONES*\n\n`;
      if (Object.keys(comisiones).length===0) txt += `Aún no hay ventas`;
      for (let k in comisiones) txt += `${k}: ${comisiones[k].ventas} ventas - ${comisiones[k].total} CUP\n`;
      await send(txt); return;
    }
    if (esAdmin && text.startsWith('tasa ')) {
      let v = text.replace('tasa ','').trim();
      if (v === 'auto') { MODO="auto"; await verificarTasaUSD(); await send(`✅ Auto ON - Tasa: ${TASA_MN} CUP (Sitio ${TASA_SITIO}+10)`); return; }
      let num = parseInt(v);
      if (!isNaN(num)) { MODO="manual"; TASA_MN=num; await send(`✅ Tasa manual: ${TASA_MN} CUP`); return; }
    }
    if (esAdmin && text === 'tasa actual') { await send(`Tasa: ${TASA_MN} CUP | Modo: ${MODO} | Sitio: ${TASA_SITIO}`); return; }

    let ped = pedidos[from] || { paso: 'inicio', productos: [], nombreComercial: '' };

    // INICIO - PIDE NOMBRE DEL COMERCIAL
    if (text.includes('hola') || text.includes('menu') || text.includes('catalogo') || text === '1') {
      pedidos[from] = { paso: 'nombre', productos: [] };
      await send(`Hola, bendecido día 🙏\nBienvenido a KAIROS SHOP 👑\n\nAntes de empezar, ¿cómo te llamas? (Nombre del comercial)`);
      return;
    }

    if (ped.paso === 'nombre') {
      ped.nombreComercial = rawText;
      ped.paso = 'catalogo'; pedidos[from] = ped;
      await send(`Gracias ${rawText} 👑\n\n📋 CATÁLOGO:\n✅ Pedestal 18" - *23 USD*\n✅ J10 - *40 USD*\n✅ F6 - *35 USD*\n✅ Bee F6 - *32 USD*\n✅ F39 - *42 USD*\n✅ F22 - *70 USD*\n✅ Nevera / Frío / Exhibidora / TV / Colchón\n\n¿Cuál quieres? Escribe el modelo, ej: *J10*`);
      return;
    }

    // ELEGIR PRODUCTO - GUARDA MULTIPLES
    let claveProd = buscarProducto(rawText);
    if (claveProd && (ped.paso === 'catalogo' || ped.paso === 'elegido' || ped.paso === 'otro')) {
      let info = CATALOGO[claveProd];
      let existente = ped.productos.find(p=>p.clave===claveProd);
      if (existente) existente.cant += 1;
      else ped.productos.push({ clave: claveProd, nombre: info.nombre, precio: info.precio, cant: 1 });
      ped.paso = 'elegido'; pedidos[from] = ped;
      let lista = ped.productos.map(p=>`• ${p.nombre} x${p.cant} - ${p.precio*p.cant} USD`).join('\n');
      await send(`✅ *${info.nombre} - ${info.precio} USD*\n${info.desc}\n\n🛒 Tu pedido hasta ahora:\n${lista}\n\n¿Quieres otro equipo?\n\n1. Sí, ver otros\n2. No, ya escogí / Quiero pedir estos`);
      return;
    }

    if (ped.paso === 'elegido' && text === '1') {
      ped.paso = 'catalogo'; pedidos[from] = ped;
      await send(`📋 CATÁLOGO:\n✅ Pedestal 18" - 23 USD\n✅ J10 - 40 USD\n✅ F6 - 35 USD\n✅ F39 - 42 USD\n✅ F22 - 70 USD\n✅ Nevera / Frío / Exhibidora / TV / Colchón\n\nEscribe el modelo:`); return;
    }
    if (ped.paso === 'elegido' && (text === '2' || text.includes('ya escogi') || text.includes('quiero pedir') || text.includes('no'))) {
      ped.paso = 'direccion'; pedidos[from] = ped;
      await send(`Perfecto ${ped.nombreComercial} 👑\n\nAhora pásame tu *dirección completa* para calcular la mensajería 📍\nEj: *San Miguel, Entrincado, Calle 5 #123 entre 1ra y 2da*`);
      return;
    }

    if (ped.paso === 'direccion') {
      let calc = calcularMensajeria(rawText, ped.productos, rawText);
      if (!calc) { await send(`No encontré esa zona 😅\nEscríbeme municipio + reparto, ej: *Guanabacoa, El Roble*`); return; }
      ped.direccion = rawText; ped.mensajeria = calc.precio; ped.detalleMens = calc.detalle; ped.paso = 'pago'; pedidos[from] = ped;
      let totalUSD = ped.productos.reduce((s,p)=>s+p.precio*p.cant,0);
      await send(`📍 Dirección: ${rawText}\n🚚 Mensajería: *${calc.precio} CUP*\n(${calc.detalle})\n\nTotal equipos: ${totalUSD} USD\n\n¿Cómo desea pagar?\n\n1. 💵 USD - ${totalUSD} USD + ${calc.precio} CUP mensajería\n2. 💶 Euros - ${totalUSD} Euros + ${calc.precio} CUP mensajería\n3. 💰 MN - ${totalUSD * TASA_MN} MN (${totalUSD} USD x ${TASA_MN}) + ${calc.precio} CUP mensajería\n\nEscriba 1, 2 o 3`);
      return;
    }

    if (ped.paso === 'pago' && ['1','2','3'].includes(text)) {
      let totalUSD = ped.productos.reduce((s,p)=>s+p.precio*p.cant,0);
      if (text === '1') ped.pago = `${totalUSD} USD + ${ped.mensajeria} CUP mensajería`;
      if (text === '2') ped.pago = `${totalUSD} Euros + ${ped.mensajeria} CUP mensajería`;
      if (text === '3') ped.pago = `${totalUSD * TASA_MN} MN + ${ped.mensajeria} CUP mensajería`;
      ped.paso = 'nota'; pedidos[from] = ped;
      await send(`Perfecto 👑 Ya casi terminamos.\n\n¿Tiene alguna duda o algo que quiera dejarnos saber?\nEj: "Después de las 2" / "Traer vuelto"\n\n✍️ Escriba su nota o escriba "No"`);
      return;
    }

    if (ped.paso === 'nota') {
      ped.nota = (text === 'no' ? 'Sin nota' : rawText);
      ped.paso = 'datos'; pedidos[from] = ped;
      await send(`Anotado ✅ Nota: *${ped.nota}*\n\nAhora pásame tu *nombre y teléfono del cliente final*\nEj: *Louis, 55551234*`);
      return;
    }

    if (ped.paso === 'datos') {
      ped.nombreCliente = rawText;
      let numeroVale = `KAIROS-${String(CONTADOR_VALE).padStart(3, '0')}`;
      CONTADOR_VALE++;
      let totalUSD = ped.productos.reduce((s,p)=>s+p.precio*p.cant,0);
      let listaProd = ped.productos.map(p=>`• ${p.nombre} x${p.cant} - ${p.precio*p.cant} USD`).join('\n');
      // Comisión: 500 CUP por equipo (cámbialo aquí si quieres otro valor)
      let comision = ped.productos.reduce((s,p)=>s+p.cant,0) * 500;
      let nc = ped.nombreComercial || 'Sin nombre';
      if (!comisiones[nc]) comisiones[nc] = { ventas: 0, total: 0 };
      comisiones[nc].ventas += 1; comisiones[nc].total += comision;
      // Bajar stock
      ped.productos.forEach(p=>{ if(ALMACEN[p.clave]!==undefined) ALMACEN[p.clave] = Math.max(0, ALMACEN[p.clave]-p.cant); });

      await send(`✅ Pedido confirmado 👑\n\n🧾 Vale: *${numeroVale}*\n👤 Comercial: ${nc}\n👤 Cliente: ${ped.nombreCliente}\n\n📦 Productos:\n${listaProd}\nTotal: ${totalUSD} USD\n💰 Pago: ${ped.pago}\n🚚 Mensajería: ${ped.mensajeria} CUP\n📍 Dirección: ${ped.direccion}\n📝 Nota: ${ped.nota}\n\nGracias por comprar en KAIROS SHOP 👑`);

      try {
        await sock.sendMessage(ADMIN_NUMERO, { text: `🔔 *NUEVO VALE ${numeroVale}*\n\n👤 Comercial: ${nc}\n👤 Cliente: ${ped.nombreCliente}\n📱 Chat: ${from}\n📍 Dirección: ${ped.direccion}\n\n📦 Productos:\n${listaProd}\n💰 Pago: ${ped.pago}\n🚚 Mensajería: ${ped.mensajeria} CUP\n📝 NOTA: ${ped.nota}\n💰 Comisión ${nc}: ${comision} CUP\n\n¡Atender! 👑` });
      } catch(e) { console.log('Error aviso admin', e); }
      delete pedidos[from];
      return;
    }
  });
}
start();
