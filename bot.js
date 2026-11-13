const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs');
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

// ===== CONFIG KAIROS 👑 - 68 PUNTOS =====
let TASA_SITIO = 915;
let TASA_MN = 925;
let MODO = "auto";
let pedidos = {};
let colaNoche = [];

if (!fs.existsSync('data')) fs.mkdirSync('data');
function cargar(nombre, defecto) {
  try { return JSON.parse(fs.readFileSync(`data/${nombre}.json`, 'utf8')); } catch { return defecto; }
}
function guardar(nombre, data) {
  fs.writeFileSync(`data/${nombre}.json`, JSON.stringify(data, null, 2));
}

let CONTADOR_VALE = cargar('contador', 1);
let comisiones = cargar('comisiones', {});
let VALES = cargar('vales', {});
let CLIENTES = cargar('clientes', {});
let LISTA_ESPERA = cargar('lista_espera', []);

const ADMIN_NUMERO = "5356947882@s.whatsapp.net";
const SEGUNDO_JEFE_NUMERO = "5351126531@s.whatsapp.net";

function fechaCuba() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Havana' }));
}
function hoyCuba() {
  return fechaCuba().toLocaleDateString('en-CA', { timeZone: 'America/Havana' });
}
function horaCubaNum() { return fechaCuba().getHours(); }

let ALMACEN = cargar('almacen', {
  "J10": { A1: 5, A2: 5 }, "F6": { A1: 5, A2: 5 }, "BEE F6": { A1: 5, A2: 5 },
  "F39": { A1: 5, A2: 5 }, "F22": { A1: 5, A2: 5 },
  "PEDESTAL": { A1: 5, A2: 5 }, "NEVERA": { A1: 3, A2: 2 }, "FRIO": { A1: 3, A2: 2 },
  "EXHIBIDORA": { A1: 2, A2: 1 }, "TV": { A1: 3, A2: 2 }, "COLCHON": { A1: 3, A2: 2 }
});
function stockTotal(clave) {
  if (!ALMACEN[clave]) return 0;
  if (typeof ALMACEN[clave] === 'number') return ALMACEN[clave];
  return (ALMACEN[clave].A1 || 0) + (ALMACEN[clave].A2 || 0);
}
function descontarStock(clave, cant) {
  if (typeof ALMACEN[clave] === 'number') { ALMACEN[clave] = Math.max(0, ALMACEN[clave] - cant); return; }
  let queda = cant;
  if (ALMACEN[clave].A1 >= queda) { ALMACEN[clave].A1 -= queda; }
  else { queda -= ALMACEN[clave].A1; ALMACEN[clave].A1 = 0; ALMACEN[clave].A2 = Math.max(0, ALMACEN[clave].A2 - queda); }
}

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
// Detecta cantidad escrita junto al producto: "J10 3" o "J10 x3"
function extraerCantidad(texto) {
  let m = texto.match(/(?:x|\s)(\d{1,2})\s*$/i);
  if (m) return parseInt(m[1]);
  return null;
}

const FAQ = {
  "garantia": "Dale, tiene 30 días de garantía en tienda. Si falla, te lo cambiamos, no te dejamos botado 👑",
  "donde": "Estamos en La Habana, hacemos domicilio a toda La Habana. Dime tu reparto y te calculo mensajería.",
  "aceptas": "Sí mi hermano, aceptamos USD, Euros y CUP al cambio del día y transferencia.",
  "horario": "Estamos de 8 AM a 5 PM. Después de las 5 te dejamos en cola y te atendemos a las 8 AM."
};

const PALABRAS_PROHIBIDAS = ["http://", "https://", "t.me/", "otro negocio", "www."];
function esSpam(texto) {
  let t = texto.toLowerCase();
  return PALABRAS_PROHIBIDAS.some(p => t.includes(p));
}

function calcularComision(nc, cantEquipos) {
  let ventasSemana = comisiones[nc]?.ventas || 0;
  let porEquipo = 500;
  if (ventasSemana >= 8) porEquipo = 750;
  else if (ventasSemana >= 5) porEquipo = 600;
  return cantEquipos * porEquipo;
}

setInterval(() => {
  let h = horaCubaNum();
  if (h === 23) {
    guardar('vales', VALES); guardar('comisiones', comisiones); guardar('almacen', ALMACEN); guardar('clientes', CLIENTES);
    console.log(`💾 Respaldo 11 PM Cuba - Vales: ${Object.keys(VALES).length}`);
  }
}, 3600000);

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
    const esSegundo = (from === SEGUNDO_JEFE_NUMERO);
    const esAutorizado = esAdmin || esSegundo;

    if (!esAutorizado && esSpam(rawText)) {
      await send(`No se permiten links de otros negocios en KAIROS 👑`);
      return;
    }

    // ===== ADMIN / SEGUNDO JEFE =====
    if (esAutorizado && text.startsWith('cancelar kairos-')) {
      let codigo = text.replace('cancelar ', '').toUpperCase().trim();
      if (!VALES[codigo]) { await send(`Ese vale ${codigo} no existe.`); return; }
      let v = VALES[codigo];
      v.productos.forEach(p => {
        if (typeof ALMACEN[p.clave] === 'number') ALMACEN[p.clave] += p.cant;
        else ALMACEN[p.clave].A1 += p.cant;
      });
      if (comisiones[v.comercial]) comisiones[v.comercial].total -= v.comision;
      delete VALES[codigo];
      guardar('vales', VALES); guardar('almacen', ALMACEN); guardar('comisiones', comisiones);
      await send(`Vale ${codigo} cancelado. Equipo devuelto. Ese vale ya no vale.`);
      return;
    }
    if (esAutorizado && text === 'cierre 5pm') {
      let hoy = hoyCuba();
      let pendientes = Object.values(VALES).filter(v => v.fecha === hoy && v.estado === 'pendiente');
      if (pendientes.length === 0) { await send('No hay vales pendientes hoy.'); return; }
      let msg = `Cierre 5 PM - ${hoy}\nRevisa y manda OK confirmado KAIROS-XXX:\n`;
      pendientes.forEach(v => { msg += `- ${v.codigo} ${v.productos.map(p=>p.nombre).join(', ')} Cliente: ${v.cliente} Comercial: ${v.comercial} - ${v.totalUSD} USD\n`; });
      await send(msg); return;
    }
    if (esAutorizado && text.startsWith('ok confirmado kairos-')) {
      let codigo = text.replace('ok confirmado ', '').toUpperCase().trim();
      if (!VALES[codigo]) { await send(`Vale ${codigo} no existe.`); return; }
      VALES[codigo].estado = 'confirmado';
      VALES[codigo].confirmado_por = esAdmin ? 'Louis' : 'Segundo Jefe (51126531)';
      guardar('vales', VALES);
      await send(`Vale ${codigo} confirmado por ${VALES[codigo].confirmado_por}. ✅`);
      return;
    }
    if (esAutorizado && text === 'ver vales') {
      let hoy = hoyCuba();
      let hoyVales = Object.values(VALES).filter(v => v.fecha === hoy);
      if (hoyVales.length === 0) { await send('Hoy no hay vales.'); return; }
      let msg = `📋 Vales hoy (${hoy}):\n`;
      hoyVales.forEach(v => { msg += `${v.codigo} - ${v.estado} - ${v.cliente} - ${v.comercial}\n`; });
      await send(msg); return;
    }
    if (esAutorizado && text === 'resumen del dia') {
      let hoy = hoyCuba();
      let hoyVales = Object.values(VALES).filter(v => v.fecha === hoy);
      let totalUSD = hoyVales.reduce((s,v)=>s+v.totalUSD,0);
      let totalCom = hoyVales.reduce((s,v)=>s+v.comision,0);
      let top = Object.entries(comisiones).sort((a,b)=>b[1].ventas - a[1].ventas)[0];
      await send(`📊 Resumen ${hoy}\nVales: ${hoyVales.length}\nVendiste: ${totalUSD} USD\nDebes comisiones: ${totalCom} CUP\nTop: ${top ? top[0] + ' - ' + top[1].ventas + ' ventas' : 'Nadie aún'}`);
      return;
    }
    if (esAutorizado && text === 'top gestores') {
      let lista = Object.entries(comisiones).sort((a,b)=>b[1].ventas - a[1].ventas).slice(0,3);
      let msg = `🏆 TOP GESTORES\n`;
      lista.forEach(([n,d],i)=>{ msg += `${i+1}. ${n} - ${d.ventas} ventas - ${d.total} CUP\n`; });
      await send(msg || 'Aún no hay ventas'); return;
    }
    if (esAutorizado && text === 'cola noche') {
      if (colaNoche.length === 0) { await send('No hubo pedidos de noche.'); return; }
      let msg = `🌙 Cola noche:\n`;
      colaNoche.forEach(p=>{ msg += `- ${p.cliente} quiere ${p.equipo}\n`; });
      await send(msg); return;
    }
    if (esAutorizado && text === 'ver lista espera') {
      if (LISTA_ESPERA.length === 0) { await send('Lista de espera vacía.'); return; }
      await send(`📋 Lista espera:\n` + LISTA_ESPERA.map(l=>`- ${l.cliente} quiere ${l.equipo} - ${l.telefono}`).join('\n')); return;
    }

    if (esAdmin && text.startsWith('actualizar stock')) {
      let partes = rawText.split(' ');
      let cant = parseInt(partes[partes.length-1]);
      let clave = partes.slice(2, -1).join(' ').toUpperCase();
      if (ALMACEN[clave] !== undefined && !isNaN(cant)) {
        if (typeof ALMACEN[clave] === 'number') ALMACEN[clave] = cant;
        else { ALMACEN[clave].A1 = cant; ALMACEN[clave].A2 = 0; }
        guardar('almacen', ALMACEN);
        await send(`✅ Almacén actualizado 👑\n${clave} = ${cant} disponibles (A1)`);
      } else await send(`No encontré ese producto. Ej: actualizar stock J10 5`);
      return;
    }
    if (esAdmin && text === 'ver almacen') {
      let txt = `📦 *ALMACÉN KAIROS*\n\n`;
      for (let k in ALMACEN) txt += `${k}: Total ${stockTotal(k)} (A1: ${ALMACEN[k].A1 || ALMACEN[k]} | A2: ${ALMACEN[k].A2 || 0})\n`;
      await send(txt); return;
    }
    if (esAdmin && text === 'comisiones') {
      let txt = `💰 *COMISIONES - SOLO LOUIS*\n\n`;
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
    if (esAdmin && text.startsWith('oferta relampago')) {
      await send(`⚡ Oferta relámpago activada: J10 a 38 USD por 2 horas. Publica esto en tu canal 👑`);
      return;
    }

    let hora = horaCubaNum();
    let esNoche = hora >= 17 || hora < 8;

    let ped = pedidos[from] || { paso: 'inicio', productos: [], nombreComercial: '' };

    // ===== ARREGLO 1: EL "1" NO REINICIA SI YA ESTAS PIDIENDO =====
    // Solo si NO estas en un pedido, hola/menu/1 te manda a inicio
    let estaEnPedido = ped.paso && ped.paso !== 'inicio';
    if (!estaEnPedido && (text.includes('hola') || text.includes('menu') || text.includes('catalogo') || text === '1')) {
      if (esNoche) {
        await send(`Hola, bendecido día 🙏\nEstamos cerrados, son las ${fechaCuba().toLocaleTimeString('es-CU')} en Cuba.\nPero te dejo en cola. Dime qué equipo quieres y te atendemos a las 8 AM 👑`);
        return;
      }
      pedidos[from] = { paso: 'nombre', productos: [] };
      await send(`Hola, bendecido día 🙏\nBienvenido a KAIROS SHOP 👑\n\nAntes de empezar, ¿cómo te llamas? (Nombre del comercial)`);
      return;
    }

    if (text.includes('garantia')) { await send(FAQ.garantia); return; }
    if (text.includes('donde estan') || text.includes('donde queda')) { await send(FAQ.donde); return; }
    if (text.includes('aceptas')) { await send(FAQ.aceptas); return; }

    if (text.startsWith('lista espera')) {
      let partes = rawText.split(' ');
      LISTA_ESPERA.push({ equipo: partes[2]?.toUpperCase(), cliente: partes[3] || 'Cliente', telefono: partes[4] || from });
      guardar('lista_espera', LISTA_ESPERA);
      await send(`Anotado en lista de espera 👑 Te avisamos cuando llegue.`);
      return;
    }

    // Comando para salir y empezar de nuevo
    if (text === 'cancelar' || text === 'salir') {
      delete pedidos[from];
      await send(`Listo, cancelado 👑 Escribe *hola* cuando quieras empezar de nuevo.`);
      return;
    }

    if (ped.paso === 'nombre') {
      ped.nombreComercial = rawText;
      ped.paso = 'catalogo'; pedidos[from] = ped;
      await send(`Gracias ${rawText} 👑\n\n📋 CATÁLOGO:\n✅ Pedestal 18" - *23 USD*\n✅ J10 - *40 USD*\n✅ F6 - *35 USD*\n✅ Bee F6 - *32 USD*\n✅ F39 - *42 USD*\n✅ F22 - *70 USD*\n✅ Nevera / Frío / Exhibidora / TV / Colchón\n\n¿Cuál quieres? Escribe el modelo, ej: *J10* o *J10 3* si quieres 3`);
      return;
    }

    // ===== ARREGLO 2: ELEGIR PRODUCTO + CANTIDAD =====
    let claveProd = buscarProducto(rawText);
    if (claveProd && (ped.paso === 'catalogo' || ped.paso === 'elegido' || ped.paso === 'otro')) {
      if (stockTotal(claveProd) <= 0) {
        await send(`Dale mi hermano, ${claveProd} se acabó ahora mismo 😅\nTe anoto en lista de espera? Escribe: *lista espera ${claveProd} tu_nombre tu_telefono*`);
        return;
      }
      let info = CATALOGO[claveProd];
      let cantDirecta = extraerCantidad(rawText);
      // Si escribió "J10 3" ya viene la cantidad, no preguntar
      if (cantDirecta) {
        if (cantDirecta > stockTotal(claveProd)) {
          await send(`Solo quedan ${stockTotal(claveProd)} de ${info.nombre}. Escribe una cantidad menor.`);
          return;
        }
        let existente = ped.productos.find(p=>p.clave===claveProd);
        if (existente) existente.cant += cantDirecta;
        else ped.productos.push({ clave: claveProd, nombre: info.nombre, precio: info.precio, cant: cantDirecta });
        ped.paso = 'elegido'; pedidos[from] = ped;
        let lista = ped.productos.map(p=>`• ${p.nombre} x${p.cant} - ${p.precio*p.cant} USD`).join('\n');
        await send(`✅ Agregado: ${info.nombre} x${cantDirecta}\n\n🛒 Tu pedido hasta ahora:\n${lista}\n\n¿Quieres otro equipo?\n\n1. Sí, ver otros\n2. No, ya escogí / Quiero pedir estos`);
        return;
      }
      // Si solo escribió "J10", preguntar cantidad
      ped.productoPendiente = claveProd;
      ped.paso = 'cantidad'; pedidos[from] = ped;
      await send(`✅ *${info.nombre} - ${info.precio} USD*\n${info.desc}\n\n¿Cuántos quieres de ${info.nombre}?\nEscribe el número, ej: *2*\nQuedan ${stockTotal(claveProd)} disponibles`);
      return;
    }

    // ===== PASO CANTIDAD =====
    if (ped.paso === 'cantidad') {
      let cant = parseInt(text);
      if (isNaN(cant) || cant <= 0) {
        await send(`Escribe solo el número, mi hermano. Ej: *2*`);
        return;
      }
      let clave = ped.productoPendiente;
      let info = CATALOGO[clave];
      if (cant > stockTotal(clave)) {
        await send(`Solo quedan ${stockTotal(clave)} de ${info.nombre}. ¿Quieres esos ${stockTotal(clave)}? Escribe *${stockTotal(clave)}* o escoge otro.`);
        return;
      }
      let existente = ped.productos.find(p=>p.clave===clave);
      if (existente) existente.cant += cant;
      else ped.productos.push({ clave: clave, nombre: info.nombre, precio: info.precio, cant: cant });
      ped.paso = 'elegido'; pedidos[from] = ped;
      let lista = ped.productos.map(p=>`• ${p.nombre} x${p.cant} - ${p.precio*p.cant} USD`).join('\n');
      await send(`🛒 Tu pedido hasta ahora:\n${lista}\n\n¿Quieres otro equipo?\n\n1. Sí, ver otros\n2. No, ya escogí / Quiero pedir estos`);
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
      let hoy = hoyCuba();
      let valesHoyGestor = Object.values(VALES).filter(v => v.comercial === ped.nombreComercial && v.fecha === hoy);
      if (valesHoyGestor.length >= 5) {
        await send(`Llegaste a 5 vales hoy. Pide OK de Louis para hacer otro 👑`);
        return;
      }
      let numeroVale = `KAIROS-${String(CONTADOR_VALE).padStart(3, '0')}`;
      CONTADOR_VALE++;
      guardar('contador', CONTADOR_VALE);
      let totalUSD = ped.productos.reduce((s,p)=>s+p.precio*p.cant,0);
      let listaProd = ped.productos.map(p=>`• ${p.nombre} x${p.cant} - ${p.precio*p.cant} USD`).join('\n');
      let cantEquipos = ped.productos.reduce((s,p)=>s+p.cant,0);
      let comision = calcularComision(ped.nombreComercial, cantEquipos);
      let nc = ped.nombreComercial || 'Sin nombre';
      if (!comisiones[nc]) comisiones[nc] = { ventas: 0, total: 0 };
      comisiones[nc].ventas += 1; comisiones[nc].total += comision;
      guardar('comisiones', comisiones);
      ped.productos.forEach(p=>{ descontarStock(p.clave, p.cant); });
      guardar('almacen', ALMACEN);
      if (!CLIENTES[from]) CLIENTES[from] = { nombre: nc, puntos: 0, compras: 0 };
      CLIENTES[from].puntos += 10;
      CLIENTES[from].compras += 1;
      CLIENTES[from].ultima_compra = hoy;
      let msgPuntos = `Tienes ${CLIENTES[from].puntos} puntos KAIROS.`;
      if (CLIENTES[from].puntos >= 50) {
        CLIENTES[from].puntos = 0;
        msgPuntos = `🎉 Tienes 50 puntos! $5 USD de descuento en tu próxima compra.`;
      }
      guardar('clientes', CLIENTES);
      VALES[numeroVale] = {
        codigo: numeroVale,
        comercial: nc,
        cliente: ped.nombreCliente,
        chat: from,
        productos: ped.productos,
        direccion: ped.direccion,
        pago: ped.pago,
        mensajeria: ped.mensajeria,
        nota: ped.nota,
        comision: comision,
        totalUSD: totalUSD,
        fecha: hoy,
        estado: 'pendiente',
        confirmado_por: null
      };
      guardar('vales', VALES);
      await send(`✅ Pedido confirmado 👑\n\n🧾 Vale: *${numeroVale}*\n👤 Comercial: ${nc}\n👤 Cliente: ${ped.nombreCliente}\n\n📦 Productos:\n${listaProd}\nTotal: ${totalUSD} USD\n💰 Pago: ${ped.pago}\n🚚 Mensajería: ${ped.mensajeria} CUP\n📍 Dirección: ${ped.direccion}\n📝 Nota: ${ped.nota}\n\n⭐ ${msgPuntos}\nGracias por comprar en KAIROS SHOP 👑\n\n⏳ Pendiente OK de Louis a las 5 PM`);
      try {
        await sock.sendMessage(ADMIN_NUMERO, { text: `🔔 *NUEVO VALE ${numeroVale}*\n\n👤 Comercial: ${nc}\n👤 Cliente: ${ped.nombreCliente}\n📱 Chat: ${from}\n📍 Dirección: ${ped.direccion}\n\n📦 Productos:\n${listaProd}\n💰 Pago: ${ped.pago}\n🚚 Mensajería: ${ped.mensajeria} CUP\n📝 NOTA: ${ped.nota}\n💰 Comisión ${nc}: ${comision} CUP\n\n¡Atender! 👑\nPara confirmar: *OK confirmado ${numeroVale}*` });
        await sock.sendMessage(SEGUNDO_JEFE_NUMERO, { text: `🔔 Nuevo vale ${numeroVale} - ${nc} - ${ped.nombreCliente} - ${totalUSD} USD. Si Louis no está, tú puedes confirmar con: OK confirmado ${numeroVale}` });
      } catch(e) { console.log('Error aviso admin', e); }
      delete pedidos[from];
      return;
    }
  });
}
start();
