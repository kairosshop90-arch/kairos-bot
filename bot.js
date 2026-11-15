const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const fs = require('fs');
const pino = require('pino');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
let ultimoQR = '';

app.get('/', (req, res) => res.send('Kairos bot activo'));
app.get('/qr', (req, res) => {
  if(!ultimoQR) return res.send('Ya estas conectado, no hay QR.');
  res.send(`<h2>Escanea este QR</h2><img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ultimoQR)}">`);
});
app.listen(PORT, () => console.log('Puerto ' + PORT));

function cargar(n, d){ try{ if(fs.existsSync(n+'.json')) return JSON.parse(fs.readFileSync(n+'.json','utf8')); }catch(e){} return d; }
function guardar(n, d){ fs.writeFileSync(n+'.json', JSON.stringify(d, null, 2)); }

let CATALOGO = cargar('catalogo', {
  'J20': { nombre: 'J20', precio: 45 },
  'J10': { nombre: 'J10', precio: 30 },
  'A1': { nombre: 'A1', precio: 25 }
});
let TASA = cargar('tasa', { valor: 915, actualizado: '' });
let PEDIDOS = cargar('pedidos', []);
let PEDIDOS_PENDIENTES = {};
let ADMIN_JID = '5356947882@s.whatsapp.net';

async function actualizarTasa(){
  try{
    let res = await fetch('https://api.eltoque.com/v1/trmi', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    let data = await res.json();
    let lista = data.trmi || data || [];
    let usd = Array.isArray(lista) ? lista.find(x => (x.moneda||'').toString().toUpperCase().includes('USD')) : null;
    let v = usd ? parseFloat(usd.tasa || usd.valor) : null;
    if(v && v > 100 && v < 2000){ TASA.valor = Math.round(v); TASA.actualizado = new Date().toLocaleString('es-CU'); guardar('tasa', TASA); }
  }catch(e){}
}

async function main(){
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }) });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (u) => {
    if(u.qr) ultimoQR = u.qr;
    if(u.connection === 'open'){ ultimoQR = ''; console.log('CONECTADO'); actualizarTasa(); setInterval(actualizarTasa, 30*60*1000); }
    if(u.connection === 'close' && u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) main();
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if(!m.message || m.key.fromMe) return;
    const from = m.key.remoteJid;
    const texto = m.message.conversation || m.message.extendedTextMessage?.text || '';
    const text = texto.trim();
    const lower = text.toLowerCase();

    async function send(msg){ await sock.sendMessage(from, { text: msg }); }

    // ===== TASA =====
    if(lower === 'tasa'){
      await send(`Tasa Toque: ${TASA.valor} CUP\nTu cobro: ${TASA.valor + 10} CUP`);
      return;
    }

    // ===== PEDIDO - ESTO ES LO QUE TU QUIERES =====
    if(lower.startsWith('pedido ')){
      let resto = text.slice(7).trim();
      let partes = resto.split('-').map(s => s.trim());
      let primera = partes[0] || '';
      let clave = primera.split(' ')[0].toUpperCase();
      let cant = parseInt(primera.split('x')[1]) || 1;
      let cliente = partes[1] || 'Cliente';
      let direccion = partes[2] || '';
      let envio = partes[3] || 'mensajeria';

      if(!CATALOGO[clave]){ await send(`Ese producto no existe. Tenemos: ${Object.keys(CATALOGO).join(', ')}`); return; }

      let precioUSD = CATALOGO[clave].precio;
      let precioMN = precioUSD * (TASA.valor + 10);

      PEDIDOS_PENDIENTES[from] = { clave, cant, cliente, direccion, envio, precioUSD, precioMN };

      await send(`🛒 PEDIDO RECIBIDO\n\n📦 Producto: ${clave} x${cant}\n👤 Cliente: ${cliente}\n📍 Dirección: ${direccion}\n🚚 Envío: ${envio}\n\n💰 ¿Cómo paga?\n1️⃣ USD: ${precioUSD * cant} USD\n2️⃣ MN: ${precioMN * cant} CUP (a ${TASA.valor + 10} = Toque ${TASA.valor} + 10)\n\nResponde:\npago USD  o  pago MN`);
      return;
    }

    // ===== PAGO =====
    if(lower === 'pago usd' || lower === 'pago mn'){
      let p = PEDIDOS_PENDIENTES[from];
      if(!p){ await send(`No tienes pedido pendiente. Primero escribe:\npedido J20 x1 - Maria 56947882 - San Miguel - mensajeria`); return; }
      let forma = lower === 'pago usd' ? `${p.precioUSD * p.cant} USD` : `${p.precioMN * p.cant} CUP`;
      PEDIDOS.push({ ...p, pago: forma, fecha: new Date().toLocaleString('es-CU') });
      guardar('pedidos', PEDIDOS);
      delete PEDIDOS_PENDIENTES[from];
      await send(`✅ PEDIDO CONFIRMADO\n\n${p.clave} x${p.cant} - ${p.cliente}\nDir: ${p.direccion} - ${p.envio}\nPago: ${forma}\n\nGracias por comprar en Kairos 🙏\n\n¿Tienes duda? Escribe: duda + tu pregunta`);
      return;
    }

    // ===== J10 SOLO - TAMBIEN COMO ANTES =====
    if(CATALOGO[lower.toUpperCase()]){
      let p = CATALOGO[lower.toUpperCase()];
      await send(`📦 ${p.nombre}\nPrecio: ${p.precio} USD / ${p.precio * (TASA.valor + 10)} CUP\n\nPara pedirlo escribe:\npedido ${p.nombre} x1 - Tu nombre telefono - Tu direccion - mensajeria`);
      return;
    }

    if(lower === 'menu' || lower === 'ayuda' || lower === 'menu'){
      await send(`🤖 KAIROS\n\nPara pedir escribe:\npedido J20 x1 - Maria 56947882 - San Miguel - mensajeria\n\nProductos: ${Object.keys(CATALOGO).join(', ')}\n\nLuego responde: pago USD o pago MN\nVer tasa: tasa`);
      return;
    }
  });
}
main();
