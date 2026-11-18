// ============================================
// KAIROS BOT - VERSION FINAL - BIEN HECHA
// Archivo: bot.js - Start: node bot.js
// ============================================
const http = require('http');
const QRCode = require('qrcode');
let ULTIMO_QR = '';

http.createServer(async (req, res) => {
  if (req.url === '/qr') {
    if (!ULTIMO_QR) { res.end('Aun no hay QR, espera 20 seg y recarga.'); return; }
    const img = await QRCode.toDataURL(ULTIMO_QR);
    res.end('<h1>KAIROS - Escanea el QR</h1><img src="' + img + '" style="width:350px">');
    return;
  }
  res.end('KAIROS OK - Ve a /qr para vincular');
}).listen(process.env.PORT || 3000);

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

// --- TUS DATOS ---
const LOUIS_JID = '5356947882@s.whatsapp.net';
const LOUIS_LID = '132624865579031@lid';
const GRUPO_LOCAL = '120363417801594416@g.us';
const GRUPO_MENSAJERIA = '120363419483851412@g.us';
const DIRECCIONES = {
  1: 'Calle 1ra / 2da y 4ta No.23308. Altura del Mirador',
  2: 'Calle 2da #18532 / E y D. Luyano Moderno, San Miguel del Padron',
  3: 'En espera de direccion'
};

// --- ESTADO ---
let CATALOGO = {};
let AGOTADOS = new Set();
let PEDIDOS = {};
let VALES = {};
let CONTADOR = 0;
let ACTUALIZANDO = null;
let ADMIN_OK = new Set();
let TASA_USD = 450, TASA_EUR = 480;

// --- TASA EL TOQUE +10 ---
async function actualizarTasa() {
  try { const r = await fetch('https://api.eltoque.com/v1/trmi'); const j = await r.json(); if (j?.tasa) TASA_USD = Math.round(j.tasa) + 10; } catch (e) {}
  try { const r2 = await fetch('https://api.eltoque.com/v1/trmi?moneda=EUR'); const j2 = await r2.json(); if (j2?.tasa) TASA_EUR = Math.round(j2.tasa) + 10; } catch (e) {}
}
actualizarTasa();
setInterval(actualizarTasa, 15 * 60 * 1000);

// --- MENSAJERIA ---
const MENSAJERIA = [
  ['SAN MIGUEL', 1000], ['GUANABACOA', 2000], ['REGLA', 2000], ['CENTRO HABANA', 2000],
  ['VEDADO', 2000], ['PLAYA', 3000], ['COTORRO', 2500], ['DIEZ DE OCTUBRE', 2000],
  ['CERRO', 2000], ['MARIANAO', 3500], ['GUANABO', 6000], ['ALAMAR', 2500],
  ['COJIMAR', 2500], ['VIBORA', 2000], ['LAWTON', 2000], ['ARROYO NARANJO', 2500],
  ['BOYERO', 2500], ['LA LISA', 3500], ['HABANA VIEJA', 2000], ['PLAZA', 2000]
];
function buscarMensajeria(t) {
  t = t.toUpperCase(); let mejor = null;
  for (const [z, p] of MENSAJERIA) { if (t.includes(z)) { if (!mejor || z.length > mejor[0].length) mejor = [z, p]; } }
  return mejor;
}
function esGrande(n) { n = n.toUpperCase(); return n.includes('NEVERA') || n.includes('FRIO') || n.includes('FRÍO') || n.includes('PLANTA') || n.includes('EXHIBIDORA') || n.includes('TV'); }
function comisionDe(prods) { let t = 0; for (const p of prods) t += esGr
