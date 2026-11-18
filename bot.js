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

let TASA_SITIO = 915;
let TASA_MN = 925;
let MODO = "auto";
let CONTADOR_VALE = 1;
let pedidos = {};
let comisiones = {};
let VALES_GUARDADOS = {};
// SOLO TU - Nadie más puede confirmar vales
let ADMINS = ["5356947882@s.whatsapp.net"];
const CLAVE_ADMIN = "kairos123";
const ADMIN_NUMERO = "5356947882@s.whatsapp.net";
const GRUPO_MENSAJERIA = "120363419483851412@g.us";
const GRUPO_RECOGIDA = "120363417801594416@g.us";


let ALMACENES = {
  "1": { "J10": 0, "F39": 0, "F22": 0, "F6": 0, "BEE F6": 0, "PEDESTAL": 0, "NEVERA": 0, "FRIO": 0, "EXHIBIDORA": 0, "TV": 0, "LAVADORA": 0, "COLCHON": 0 },
  "2": { "J10": 0, "F39": 0, "F22": 0, "F6": 0, "BEE F6": 0, "PEDESTAL": 0, "NEVERA": 0, "FRIO": 0, "EXHIBIDORA": 0, "TV": 0, "LAVADORA": 0, "COLCHON": 0 },
  "3": { "J10": 0, "F39": 0, "F22": 0, "F6": 0, "BEE F6": 0, "PEDESTAL": 0, "NEVERA": 0, "FRIO": 0, "EXHIBIDORA": 0, "TV": 0, "LAVADORA": 0, "COLCHON": 0 }
};
let ACTUALIZANDO = null;

const DIRECCIONES_ALMACENES = {
  "1": "Calle 1ra No. 23308 / 4ta y 6ta. Altura del Mirador - Almacén 1 KAIROS",
  "2": "Calle 2 / E y D No. 18532. Luyanó Moderno. San Miguel del Padrón - Almacén 2 KAIROS",
  "3": "PON AQUÍ DIRECCIÓN ALMACÉN 3 - Almacén 3 KAIROS"
};

let CATALOGO = {
  "J10": { nombre: "J10 Recargable", precio: 40, comision: 1200, desc: "Solar + Bluetooth + Luz + Radio FM\nBatería 20.000 mAh, hasta 12h" },
  "F39": { nombre: "F39 Solar", precio: 42, comision: 1200, desc: "Solar + Bluetooth + Luz\nBatería larga duración" },
  "F22": { nombre: "F22 SACO", precio: 70, comision: 1200, desc: "SACO Grande - Potente, Bluetooth + Luz + Solar" },
  "F6": { nombre: "F6 SACO", precio: 35, comision: 1200, desc: "SACO - Bluetooth + Luz" },
  "BEE F6": { nombre: "Bee F6", precio: 32, comision: 1200, desc: "Bee F6 - 32 USD / Mayor: 30 USD" },
  "PEDESTAL": { nombre: 'Pedestal 18"', precio: 23, comision: 1200, desc: 'Ventilador Pedestal 18" - 3 velocidades' },
  "NEVERA": { nombre: "Nevera", precio: 0, comision: 2500, desc: "Preguntar modelo - 11 pies / 16 pies disponibles" },
  "FRIO": { nombre: "Frío", precio: 0, comision: 2500, desc: "Frío 15 pies en adelante" },
  "EXHIBIDORA": { nombre: "Exhibidora", precio: 0, comision: 2500, desc: "Exhibidora con cristales - MUCHO CUIDADO" },
  "TV": { nombre: "TV", precio: 0, comision: 2500, desc: "TV - Preguntar pulgadas" },
  "LAVADORA": { nombre: "Lavadora", precio: 0, comision: 2500, desc: "Lavadora - Preguntar modelo" },
  "COLCHON": { nombre: "Colchón", precio: 0, comision: 2500, desc: "Colchón - Preguntar medida" }
};

let EQUIPOS_GRANDES = ["NEVERA", "FRIO", "EXHIBIDORA", "TV", "LAVADORA", "COLCHON"];

async function verificarTasaUSD() {
  if (MODO === "manual") return;
  try {
    const res = await fetch("https://api.eltoque.com/v1/trmi");
    const data = await res.json();
    const usd = data.find(m => m.currency === "USD");
    if (usd) { TASA_SITIO = usd.price || usd.valor; TASA_MN = TASA_SITIO + 10; console.log(`✅ Auto: ${TASA_SITIO} +10 = ${TASA_MN}`); }
  } catch(e) { console.log("Sin internet, mantengo:", TASA_MN); }
}
setInterval(verificarTasaUSD, 1800000);
verificarTasaUSD();

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
    if (productos.some(p=>p.clave==="FRIO")) { final += 800; detalle += ` +800 Frío 15+ pies`; }
  }
  return { precio: final, detalle };
}

function buscarProducto(nombre) {
  let n = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  // 1. Primero busca EXACTO: "arrocera marwa" == "arrocera marwa"
  for (let key of Object.keys(CATALOGO)) {
    let k = key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (k === n) return key;
  }
  // 2. Después busca que lo CONTENGA completo: "arrocera marwa" dentro de "arrocera marwa 6l"
  for (let key of Object.keys(CATALOGO)) {
    let k = key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (k.includes(n) || n.includes(k)) return key;
  }
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
    const esGrupo = from.endsWith('@g.us');
    const send = async (t) => { await sock.sendMessage(from, { text: t }); };

    if (esGrupo && text === 'id grupo') {
      await send(`ID de este grupo:\n${from}`);
      return;
    }
    if (esGrupo) return;

    // TU LLAVE PARA HACERTE ADMIN - Solo tú sabes la clave
if (text.includes('soy admin') && text.includes('kairos123')) {    
  if (!ADMINS.includes(from)) ADMINS.push(from);
      await send(`✅ Listo Louis 👑\nYa eres admin con este número:\n${from}\n\nAhora solo tú puedes confirmar vales.`);
      return;
    }
if (text.includes('mi numero')) {    
  await send(`Tu número es:\n${from}\n\n¿Eres admin? ${ADMINS.includes(from) ? 'SÍ ✅' : 'NO ❌'}\nSi dice NO, escribe: soy admin kairos123`);
      return;
    }

    const esAdmin = ADMINS.includes(from);

    // ===== SOLO ADMIN PUEDE CONFIRMAR VALE =====
    if (text.includes('vale') && text.includes('confirmado')) {
      if (!esAdmin) { await send(`⛔ Solo el admin puede confirmar vales.\nSi eres Louis escribe: soy admin kairos123`); return; }
      let match = text.match(/(\d{1,4})/);
      let claveVale = "";
      if (!match) {
        let keys = Object.keys(VALES_GUARDADOS);
        if (keys.length === 0) { await send(`No hay ningún vale guardado. Haz un pedido primero.`); return; }
        claveVale = keys[keys.length - 1];
      } else {
        let num = match[1].padStart(3, '0');
        claveVale = `KAIROS-${num}`;
      }
      let v = VALES_GUARDADOS[claveVale];
      if (!v) { 
        let keys = Object.keys(VALES_GUARDADOS);
        await send(`No encontré el vale ${claveVale} 😅\nVales que tengo: ${keys.join(', ') || 'ninguno'}`); 
        return; 
      }
      if (v.enviado) { await send(`Ese vale ${claveVale} ya se envió al grupo.`); return; }
      let esRecogida = v.direccion.includes('RECOGIDA');
      let clienteSinNumero = v.nombreCliente.replace(/[0-9+\- ]/g, '').replace(/,,/g, ',').trim();
      if (!clienteSinNumero) clienteSinNumero = v.nombreCliente.split(',')[0];
      if (esRecogida) {
        try {
          await sock.sendMessage(GRUPO_RECOGIDA, { text: `🏬 *RECOGIDA EN LOCAL - ${claveVale} CONFIRMADO* ✅\n\n🧾 Vale: ${claveVale}\n👤 Comercial: ${v.nombreComercial}\n👤 Cliente: ${v.nombreCliente}\n\n📦 Productos:\n${v.listaProd}\n💰 Pago: ${v.pago}\n📍 Recogida: ${v.direccion}\n📝 Nota: ${v.nota}\n\n¡Preparar para entregar! 👑` });
          v.enviado = true;
          await send(`✅ Vale ${claveVale} enviado al grupo de RECOGIDA 🏬`);
        } catch(e) { await send(`Error enviando al grupo de recogida: ${e.message}`); }
      } else {
        try {
          await sock.sendMessage(GRUPO_MENSAJERIA, { text: `🚚 *MENSAJERÍA - ${claveVale} CONFIRMADO* ✅\n\n🧾 Vale: ${claveVale}\n👤 Comercial: ${v.nombreComercial}\n👤 Cliente: ${clienteSinNumero}\n\n📦 Productos:\n${v.listaProd}\n💰 Pago: ${v.pago}\n🚚 Mensajería: ${v.mensajeria} CUP\n📍 Dirección: ${v.direccion}\n📝 Nota: ${v.nota}\n\n¡A repartir! 👑` });
          v.enviado = true;
          await send(`✅ Vale ${claveVale} enviado al grupo de MENSAJERÍA 🚚 (sin número del cliente)`);
        } catch(e) { await send(`Error enviando al grupo de mensajería: ${e.message}`); }
      }
      return;
    }

    if (esAdmin && text === 'ver vales') {
      let keys = Object.keys(VALES_GUARDADOS);
      if (keys.length === 0) { await send(`No hay vales guardados`); return; }
      let txt = `🧾 *VALES GUARDADOS*\n\n`;
      for (let k of keys) { let vv = VALES_GUARDADOS[k]; txt += `${k} - ${vv.nombreCliente} - ${vv.enviado ? 'ENVIADO ✅' : 'PENDIENTE ⏳'}\n`; }
      await send(txt); return;
    }

    // ACTUALIZAR SIMPLE
    
    // ACTUALIZAR SIMPLE - solo nombres
    if (esAdmin && /^actualizar\s+[123]$/.test(text)) {
      ACTUALIZANDO = text.match(/(\d)/)[1];
      await send(`📦 Vas a actualizar el ALMACÉN ${ACTUALIZANDO}\n\nManda la lista, un producto por línea.\nSi quieres cantidad, pon x y el número al final:\nPanel solar LONGi 635 x2\nCasco de moto x5\nSi no pones nada, lo pongo como 1.`);
      return;
    }
    if (esAdmin && ACTUALIZANDO) {
      let lineas = rawText.split('\n');
      let agregados = [];
      for (let l of lineas) {
        let limpio = l.trim().replace(/^[✅☑️✔️•\-\* ]+/, '').replace(/[\u{1F000}-\u{1FAFF}]/gu, '').trim();
        if (!limpio) continue;
        let cant = 1;
        let nombre = limpio;
        let m = limpio.match(/^(.*)\s+x(\d+)\s*$/i);
        if (m) { nombre = m[1].trim(); cant = parseInt(m[2]); }
        let clave = nombre.toUpperCase();
        if (CATALOGO[clave] === undefined) {
          CATALOGO[clave] = { nombre: nombre, precio: 0, comision: 1200, desc: nombre };
          for (let a of ["1","2","3"]) { if (ALMACENES[a][clave] === undefined) ALMACENES[a][clave] = 0; }
        }
        ALMACENES[ACTUALIZANDO][clave] = cant;
        agregados.push(`${nombre} = ${cant}`);
      }
      await send(`✅ Listo Louis 👑\nAlmacén ${ACTUALIZANDO} actualizado.\n\n${agregados.join('\n')}`);
      ACTUALIZANDO = null;
      return;
    }
    
    if (esAdmin && text.startsWith('actualizar stock')) {
      let partes = rawText.split(' ');
      let almacenNum = partes[2];
      let cant = parseInt(partes[partes.length-1]);
      let clave = partes.slice(3, -1).join(' ').toUpperCase();
      if (ALMACENES[almacenNum] && ALMACENES[almacenNum][clave] !== undefined && !isNaN(cant)) {
        ALMACENES[almacenNum][clave] = cant;
        await send(`✅ Almacén ${almacenNum} actualizado 👑\n${clave} = ${cant} disponibles`);
      } else await send(`No encontré. Ej: actualizar stock 1 J10 5`);
      return;
    }
    if (esAdmin && text.startsWith('ver almacen')) {
      let num = text.replace('ver almacen','').trim();
      if (ALMACENES[num]) {
        let txt = `📦 *ALMACÉN ${num} KAIROS*\n\n`;
        for (let k in ALMACENES[num]) txt += `${k}: ${ALMACENES[num][k]}\n`;
        await send(txt); return;
      }
      let txt = `📦 *TODOS LOS ALMACENES*\n\n`;
      for (let a in ALMACENES) { txt += `--- ALMACÉN ${a} ---\n`; for (let k in ALMACENES[a]) txt += `${k}: ${ALMACENES[a][k]}\n`; txt += `\n`; }
      await send(txt); return;
    }
    if (esAdmin && text.startsWith('agregar producto')) {
      let resto = rawText.replace(/agregar producto /i, '').trim();
      let partes = resto.split(' ');
      let clave = partes[0].toUpperCase();
      let precio = parseInt(partes[1]);
      let nombreDesc = partes.slice(2).join(' ');
      if (!clave || isNaN(precio) || !nombreDesc) { await send(`Falta algo. Ej: agregar producto LAMPARA 15 Lámpara Solar`); return; }
      CATALOGO[clave] = { nombre: nombreDesc, precio: precio, comision: 1200, desc: nombreDesc };
      for (let a of ["1","2","3"]) { if (ALMACENES[a][clave] === undefined) ALMACENES[a][clave] = 0; }
      await send(`✅ Producto creado 👑\n${clave} - ${nombreDesc} - ${precio} USD\nAhora hazle entrada: entrada 1 ${clave} 10`);
      return;
    }
    if (esAdmin && text.startsWith('entrada')) {
      let partes = rawText.split(' ');
      let almacenNum = partes[1];
      let clave = partes[2].toUpperCase();
      let cant = parseInt(partes[3]);
      if (ALMACENES[almacenNum] && ALMACENES[almacenNum][clave] !== undefined && !isNaN(cant)) {
        ALMACENES[almacenNum][clave] += cant;
        await send(`✅ Entrada hecha 👑\nAlmacén ${almacenNum} - ${clave} +${cant}\nAhora tienes: ${ALMACENES[almacenNum][clave]}`);
      } else await send(`No encontré. Ej: entrada 1 J10 5`);
      return;
    }
    if (esAdmin && text.startsWith('borrar producto')) {
      let clave = rawText.replace(/borrar producto /i, '').trim().toUpperCase();
      if (CATALOGO[clave]) {
        delete CATALOGO[clave];
        for (let a of ["1","2","3"]) delete ALMACENES[a][clave];
        if (esAdmin && text.startsWith('agotar')) {
  let partes = rawText.split(' ');
  // Formas: agotar J10  -> agota en todos
  //         agotar 1 J10 -> agota solo en almacen 1
  let almacenNum = null;
  let clave = '';
  if (['1','2','3'].includes(partes[1])) { almacenNum = partes[1]; clave = partes[2].toUpperCase(); }
  else { clave = partes[1].toUpperCase(); }

  if (!CATALOGO[clave]) { await send('No encontré: ' + clave); return; }

  if (almacenNum) { ALMACENES[almacenNum][clave] = 0; }
  else { for (let a of ["1","2","3"]) ALMACENES[a][clave] = 0; }
  await send(`✅ AGOTADO 👑\n${clave} - ${CATALOGO[clave].nombre} = 0`);
  return;
}

if (esAdmin && text.startsWith('limpiar almacen')) {
  let destino = rawText.replace(/limpiar almacen /i, '').trim().toLowerCase();
  if (destino === 'todos') {
    for (let clave of Object.keys(CATALOGO)) { for (let a of ["1","2","3"]) ALMACENES[a][clave] = 0; }
    await send('✅ TODOS LOS ALMACENES LIMPIOS 👑\nTodo en 0');
  } else if (['1','2','3'].includes(destino)) {
    for (let clave of Object.keys(CATALOGO)) ALMACENES[destino][clave] = 0;
    await send(`✅ ALMACEN ${destino} LIMPIO 👑\nTodo en 0`);
  } else { await send('Manda: limpiar almacen 1 o limpiar almacen todos'); }
  return;
}
        EQUIPOS_GRANDES = EQUIPOS_GRANDES.filter(e => e !== clave);
        await send(`🗑️ Producto borrado 👑\n${clave} ya no sale en catálogo ni en almacén`);
      } else await send(`No encontré ese producto: ${clave}`);
      return;
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

    if ((text.includes('hola') || text.includes('menu') || text.includes('catalogo')) && (!ped.paso || ped.paso === 'inicio')) {
      pedidos[from] = { paso: 'nombre', productos: [] };
      await send(`Hola, bendecido día 🙏\nBienvenido a KAIROS SHOP 👑\n\nAntes de empezar, ¿cómo te llamas? (Nombre del comercial)`);
      return;
    }

    if (ped.paso === 'nombre') {
      ped.nombreComercial = rawText;
      ped.paso = 'catalogo'; pedidos[from] = ped;
      await send(`Gracias ${rawText} 👑\n\n📋 CATÁLOGO:\n✅ Pedestal 18" - *23 USD*\n✅ J10
