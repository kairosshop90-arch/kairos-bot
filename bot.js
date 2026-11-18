// BOT KAIROS - VERSION LIMPIA CON QR - v2
const http = require('http');
const QRCode = require('qrcode');
let ULTIMO_QR = '';

http.createServer(async (req, res) => {
  if (req.url === '/qr') {
    if (!ULTIMO_QR) { res.end('Aun no hay QR, espera 20 segundos y recarga. Si ya estas vinculado, no sale QR.'); return; }
    let img = await QRCode.toDataURL(ULTIMO_QR);
    res.end('<h1>KAIROS - Escanea para vincular</h1><img src="' + img + '" style="width:350px"><br><br><a href="/qr">Recargar</a>');
    return;
  }
  res.end('KAIROS OK - Ve a /qr para ver el QR');
}).listen(process.env.PORT || 3000);

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

const ADMIN_NUM = '5356947882';
const LOUIS_JID = '5356947882@s.whatsapp.net';
const GRUPO_LOCAL = '120363417801594416@g.us';
const GRUPO_MENSAJERIA = '120363419483851412@g.us';

let ALMACENES = { 1: {}, 2: {}, 3: {} };
let DIRECCIONES = {
  1: 'Calle 1ra / 2da y 4ta No.23308. Altura del Mirador',
  2: 'Calle 2da #18532 / E y D. Luyanó Moderno, San Miguel del Padrón',
  3: 'En espera de dirección'
};
let CATALOGO = {};
let AGOTADOS = new Set();

let MENSAJERIA = [
  ['SAN MIGUEL', 1000], ['GUANABACOA', 2000], ['ROBLE', 2500], ['JATA', 2500], ['MIKITO', 2500],
  ['NARANJO', 2500], ['SANTA FE', 3000], ['BARRERAS', 4000], ['MINAS', 4000], ['CAMPO FLORIDO', 5000],
  ['REGLA', 2000], ['CASA BLANCA', 2500], ['BAHIA', 2500], ['COJIMAR', 2500],
  ['VILLA PANAMERICANA', 2500], ['ALAMAR', 2500], ['CAMILO', 2500],
  ['COTORRO', 2500], ['SANTA MARIA DEL ROSARIO', 3500], ['AL BERRO', 3500], ['LOMA DE TIERRA', 3500],
  ['CUATRO CAMINO', 4000], ['DIEZ DE OCTUBRE', 2000], ['VIBORA', 2000], ['MONACO', 2000],
  ['SANTO SUAREZ', 2000], ['SEVILLANO', 2000], ['LAWTON', 2000],
  ['ARROYO NARANJO', 2500], ['MANTILLA', 2500], ['PARRAGA', 2500], ['PALMA', 2500],
  ['CALABAZAR', 3000], ['REPARTO ELECTRICO', 2500], ['MANAGUA', 4000], ['LAS GUASIMAS', 3500],
  ['CENTRO HABANA', 2000], ['HABANA VIEJA', 2000], ['CERRO', 2000], ['CASINO DEPORTIVO', 2500],
  ['AYESTARAN', 2500], ['BOYERO', 2500], ['CAMAGUEY', 2500], ['VEDADO', 2000], ['PLAZA', 2000],
  ['PLAYA', 3000], ['JAIMANITA', 4000], ['SANTA FE PLAYA', 4500], ['MARIANAO', 3500],
  ['LA LISA', 3500], ['PUNTA BRAVA', 5000], ['VALLE GRANDE', 5000], ['ARROYO ARENA', 4500],
  ['SAN AGUSTIN', 4000], ['GUANABO', 6000], ['CIEN', 3000], ['ALDABO', 3000],
  ['ALTA HABANA', 3000], ['SANTIAGO DE LAS VEGAS', 4500], ['WAJAY', 5000], ['EL CHICO', 5000]
];

function buscarMensajeria(texto) {
  let t = texto.toUpperCase();
  let mejor = null;
  for (let [zona, precio] of MENSAJERIA) {
    if (t.includes(zona)) { if (!mejor || zona.length > mejor[0].length) mejor = [zona, precio]; }
  }
  return mejor;
}
function esGrande(nombre) {
  let n = nombre.toUpperCase();
  return n.includes('NEVERA') || n.includes('FRIO') || n.includes('FRÍO') || n.includes('PLANTA') || n.includes('EXHIBIDORA') || n.includes('TV') || n.includes('TELEVISOR');
}
function comisionDe(productos) {
  let total = 0;
  for (let p of productos) { total += esGrande(p.nombre) ? 2500 : 1200; }
  return total;
}

let TASA_USD = 450, TASA_EUR = 480;
async function actualizarTasa() {
  try {
    let r = await fetch('https://api.eltoque.com/v1/trmi');
    let j = await r.json();
    if (j && j.tasa) { TASA_USD = Math.round(j.tasa) + 10; }
  } catch(e) {}
  try {
    let r2 = await fetch('https://api.eltoque.com/v1/trmi?moneda=EUR');
    let j2 = await r2.json();
    if (j2 && j2.tasa) { TASA_EUR = Math.round(j2.tasa) + 10; }
  } catch(e) {}
}
actualizarTasa();
setInterval(actualizarTasa, 15 * 60 * 1000);

let PEDIDOS = {};
let VALES = {};
let CONTADOR = 0;
let ACTUALIZANDO = null;
let ADMIN_OK = new Set();

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('sesion-kairos');
  const sock = makeWASocket({ logger: pino({ level: 'silent' }), auth: state, printQRInTerminal: true });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (
