// KAIROS BOT - VERSION FINAL COMPLETA
const http = require('http');
const QRCode = require('qrcode');
let ULTIMO_QR = '';

http.createServer(async (req, res) => {
  if (req.url === '/qr') {
    if (!ULTIMO_QR) { res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); res.end('<h1>Aun no hay QR, espera 20 seg y recarga</h1><a href="/qr">Recargar</a>'); return; }
    const img = await QRCode.toDataURL(ULTIMO_QR);
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
    res.end('<h1>KAIROS - Escanea el QR</h1><img src="' + img + '" style="width:350px">');
    return;
  }
  res.writeHead(200, {'Content-Type':'text/plain; charset=utf-8'});
  res.end('KAIROS OK - Ve a /qr para vincular');
}).listen(process.env.PORT || 10000, () => console.log('Puerto abierto'));

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

const LOUIS_JID = '5356947882@s.whatsapp.net';
const LOUIS_LID = '132624865579031@lid';
const GRUPO_LOCAL = '120363417801594416@g.us';
const GRUPO_MENSAJERIA = '120363419483851412@g.us';

const DIRECCIONES = {
  1: 'Calle 1ra / 2da y 4ta No.23308. Altura del Mirador',
  2: 'Calle 2da #18532 / E y D. Luyano Moderno, San Miguel del Padron',
  3: 'En espera de direccion'
};

let CATALOGO = {};
let AGOTADOS = new Set();
let PEDIDOS = {};
let VALES = {};
let CONTADOR = 0;
let ACTUALIZANDO = null;
let ADMIN_OK = new Set();
let TASA_USD = 450, TASA_EUR = 480;

async function actualizarTasa() {
  try { const r = await fetch('https://api.eltoque.com/v1/trmi'); const j = await r.json(); if (j?.tasa) TASA_USD = Math.round(j.tasa) + 10; } catch(e) {}
  try { const r2 = await fetch('https://api.eltoque.com/v1/trmi?moneda=EUR'); const j2 = await r2.json(); if (j2?.tasa) TASA_EUR = Math.round(j2.tasa) + 10; } catch(e) {}
}
actualizarTasa();
setInterval(actualizarTasa, 15 * 60 * 1000);

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
function comisionDe(prods) { let t = 0; for (const p of prods) t += esGrande(p.nombre) ? 2500 : 1200; return t; }

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('sesion-kairos');
  const sock = makeWASocket({ logger: pino({ level: 'silent' }), auth: state });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (u) => {
    if (u.qr) { ULTIMO_QR = u.qr; console.log('QR NUEVO - VE A /qr'); }
    if (u.connection === 'close') {
      const rec = u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (rec) start();
    } else if (u.connection === 'open') { console.log('KAIROS CONECTADO'); ULTIMO_QR = ''; }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;
    const from = m.key.remoteJid;
    const rawText = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim();
    const text = rawText.toLowerCase().trim();
    const send = async (t) => { await sock.sendMessage(from, { text: t }); };
    const esLouis = from === LOUIS_JID || from === LOUIS_LID;
    const esAdmin = ADMIN_OK.has(from) || esLouis;

    if (text === 'mi id') { await send('Tu ID es: ' + from); return; }
    if (text === 'cancelar' || text === 'reiniciar' || text === 'menu') { delete PEDIDOS[from]; ACTUALIZANDO = null; await send('Listo, borre lo que estabas haciendo. Escribe *catalogo*'); return; }
    if (text === 'soy admin kairos123') { ADMIN_OK.add(from); await send('Bienvenido Admin KAIROS.\nComandos: actualizar almacen 1, quitar producto X, agotado X, ver catalogo'); return; }
    if (text === 'tasa' || text === 'toque') { await send('El Toque +10\nUSD: ' + TASA_USD + ' MN\nEUR: ' + TASA_EUR + ' MN'); return; }

if (esAdmin && ACTUALIZANDO) {
  for (const k in CATALOGO) { if (CATALOGO[k].almacen === ACTUALIZANDO) delete CATALOGO[k]; }
  const ag = [];

  for (const l of rawText.split('\n')) {
    let linea = l.trim();
    if (!linea) continue;
    // Quita el check, emojis, puntos
    linea = linea.replace(/^[☑️✅✔️•\-\* ]+/u, '').trim();
    if (!linea) continue;

    // Quita cosas como ( 15 USD ) que estan en medio, no son el precio
    linea = linea.replace(/\(.*?USD.*?\)/gi, '').trim();

    // El precio es SIEMPRE el ultimo numero de la linea
    // Ej: "Arrocera Estelectric --27 usd" -> precio 27, nombre "Arrocera Estelectric"
    // Ej: "Fogón d petróleo -- 78" -> precio 78
    // Ej: "Triciclo Ktikova 3100" -> precio 3100
    const mPrecio = linea.match(/(.+?)[\s\-–—]*(\d+(\.\d+)?)\s*(USD|usd)?\s*$/);
    if (!mPrecio) continue;

    let nom = mPrecio[1].trim().replace(/[-–—\s]+$/,'').trim();
    let pre = parseFloat(mPrecio[2]);
    if (!nom || !pre) continue;

    const cl = nom.toUpperCase();
    CATALOGO[cl] = { nombre: nom, precioUSD: pre, almacen: ACTUALIZANDO };
    AGOTADOS.delete(cl);
    ag.push(nom + ' - ' + pre + ' USD');
  }
  await send('Listo. Almacen ' + ACTUALIZANDO + ' actualizado.\n\n' + ag.join('\n'));
  ACTUALIZANDO = null;
  return;
}


    
    if (esAdmin && ACTUALIZANDO) {
      for (const k in CATALOGO) { if (CATALOGO[k].almacen === ACTUALIZANDO) delete CATALOGO[k]; }
      const ag = [];
      for (const l of rawText.split('\n')) {
        const lim = l.trim().replace(/^[✅☑️✔️•\-\* ]+/, '').trim(); if (!lim) continue;
        const pa = lim.split(' - '); const nom = pa[0].trim(); const pre = pa[1] ? parseFloat(pa[1].replace(/[^0-9.]/g, '')) : 0;
        const cl = nom.toUpperCase(); CATALOGO[cl] = { nombre: nom, precioUSD: pre, almacen: ACTUALIZANDO }; AGOTADOS.delete(cl); ag.push(nom + ' - ' + pre + ' USD');
      }
      await send('Listo. Almacen ' + ACTUALIZANDO + ' actualizado.\n\n' + ag.join('\n')); ACTUALIZANDO = null; return;
    }
    if (esAdmin && text.startsWith('quitar producto ')) {
      const n = rawText.substring(15).trim().toUpperCase();
      if (CATALOGO[n]) { delete CATALOGO[n]; await send('Quitado: ' + n); } else await send('No encontre ese producto.');
      return;
    }
    if (esAdmin && text.startsWith('agotado ')) { const n = rawText.substring(8).trim().toUpperCase(); AGOTADOS.add(n); await send(n + ' marcado AGOTADO.'); return; }
    if (esAdmin && text === 'ver catalogo') {
      let t = 'CATALOGO KAIROS\n\n';
      for (const a of ['1','2','3']) { t += '--- ALMACEN ' + a + ' ---\n'; for (const k in CATALOGO) { if (CATALOGO[k].almacen === a) t += CATALOGO[k].nombre + ' - ' + CATALOGO[k].precioUSD + ' USD' + (AGOTADOS.has(k) ? ' AGOTADO' : '') + '\n'; } t += '\n'; }
      await send(t); return;
    }

    const mc = rawText.match(/kairos[-\s]?(\d+)\s+confirmado/i);
    if (esLouis && mc) {
      const nv = mc[1]; const v = VALES[nv]; if (!v) { await send('No encontre vale ' + nv); return; }
      v.estado = 'confirmado';
      let res = 'VALE KAIROS-' + nv + ' CONFIRMADO\n\nCliente: ' + v.cliente + '\nProductos:\n' + v.productos.map(p => '- ' + p.nombre + ' x' + p.cant + ' = ' + (p.cant * p.precioUSD) + ' USD').join('\n') + '\nTotal USD: ' + v.totalUSD + '\nTotal MN: ' + (v.totalUSD * TASA_USD) + '\nMensajeria: ' + v.costoMensajeria + ' MN';
      if (v.tipo === 'recogida') {
        res += '\nRecogida en: ' + DIRECCIONES[v.almacen];
        await sock.sendMessage(GRUPO_LOCAL, { text: res });
        await sock.sendMessage(v.gestor, { text: 'Tu vale KAIROS-' + nv + ' CONFIRMADO. Recoger en: ' + DIRECCIONES[v.almacen] });
      } else {
        res += '\nMensajeria a: ' + v.direccion;
        await sock.sendMessage(GRUPO_MENSAJERIA, { text: res });
        await sock.sendMessage(v.gestor, { text: 'Tu vale KAIROS-' + nv + ' CONFIRMADO. Va por mensajeria.' });
      }
      await send('Vale ' + nv + ' enviado al grupo.'); return;
    }
    const me = rawText.match(/vale\s+kairos[-\s]?(\d+)\s+entregado/i);
    if (esLouis && me) {
      const nv = me[1]; const v = VALES[nv]; if (!v) { await send('No encontre vale ' + nv); return; }
      const com = comisionDe(v.productos);
      await sock.sendMessage(v.gestor, { text: 'VALE KAIROS-' + nv + ' ENTREGADO. Tu comision: ' + com + ' MN' });
      await send('Entrega notificada. Comision: ' + com); return;
    }

    if (text.includes('hola') || text.includes('buenas') || text.includes('bendecido')) { delete PEDIDOS[from]; await send('Hola, bendecido dia, bienvenido a KAIROS. Soy el gestor de KAIROS.\n\nEscribe: *catalogo*'); return; }
    if (text === 'catálogo' || text === 'catalogo') {
      let t = 'CATALOGO KAIROS\n\n';
      for (const a of ['1','2','3']) { t += '--- ALMACEN ' + a + ' ---\n'; let hay = false; for (const k in CATALOGO) { if (CATALOGO[k].almacen === a) { hay = true; t += CATALOGO[k].nombre + ' - ' + CATALOGO[k].precioUSD + ' USD' + (AGOTADOS.has(k) ? ' AGOTADO' : '') + '\n'; } } if (!hay) t += '(Vacio)\n'; t += '\n'; }
      t += 'Escribe el nombre exacto del producto que quieres.'; await send(t); return;
    }

    const clave = text.toUpperCase();
    if (CATALOGO[clave] && !PEDIDOS[from]) {
      if (AGOTADOS.has(clave)) { await send('Ese producto esta AGOTADO.'); return; }
      PEDIDOS[from] = { gestor: from, productos: [{ nombre: CATALOGO[clave].nombre, precioUSD: CATALOGO[clave].precioUSD, cant: 0, almacen: CATALOGO[clave].almacen }], paso: 'cantidad', actual: 0 };
      await send(CATALOGO[clave].nombre + ' - ' + CATALOGO[clave].precioUSD + ' USD\n\nCuantos quieres? Ej: 2'); return;
    }

    const ped = PEDIDOS[from];
    if (ped) {
      if (ped.paso === 'cantidad') {
        const cant = parseInt(text); if (isNaN(cant) || cant <= 0) { await send('Pon un numero, ej: 2'); return; }
        ped.productos[ped.actual].cant = cant; ped.paso = 'otra'; await send('Quieres otra cosa? Escribe *SI* o *NO*'); return;
      }
      if (ped.paso === 'otra') {
        if (text === 'no') { ped.paso = 'datos'; await send('Perfecto. Dime:\nNombre Apellido Carnet\nEj: Juan Perez 12345678901'); return; }
        if (text.startsWith('si')) { ped.paso = 'otro_nombre'; await send('Dime el nombre del otro producto:'); return; }
        await send('Escribe SI o NO'); return;
      }
      if (ped.paso === 'otro_nombre') {
        if (CATALOGO[clave]) { ped.productos.push({ nombre: CATALOGO[clave].nombre, precioUSD: CATALOGO[clave].precioUSD, cant: 0, almacen: CATALOGO[clave].almacen }); ped.actual = ped.productos.length - 1; ped.paso = 'cantidad'; await send(CATALOGO[clave].nombre + ' - ' + CATALOGO[clave].precioUSD + ' USD\nCuantos?'); }
        else await send('No encontre ese producto. Escribe el nombre exacto.');
        return;
      }
      if (ped.paso === 'datos') { ped.cliente = rawText; ped.paso = 'tipo'; await send('Mensajeria o recogida?\nEscribe: *mensajeria* o *recogida*'); return; }
      if (ped.paso === 'tipo') {
        if (text.includes('recogida')) {
          CONTADOR++; const totalUSD = ped.productos.reduce((s, p) => s + p.precioUSD * p.cant, 0);
          const vale = { numero: CONTADOR, gestor: from, cliente: ped.cliente, productos: ped.productos, tipo: 'recogida', almacen: ped.productos[0].almacen, totalUSD, costoMensajeria: 0 };
          VALES[CONTADOR] = vale; delete PEDIDOS[from];
          const tv = 'VALE KAIROS-' + String(CONTADOR).padStart(3, '0') + ' (PENDIENTE)\n\nCliente: ' + vale.cliente + '\nProductos:\n' + vale.productos.map(p => '- ' + p.nombre + ' x' + p.cant + ' = ' + (p.precioUSD * p.cant) + ' USD').join('\n') + '\n\nTotal USD: ' + totalUSD + '\nTotal MN: ' + (totalUSD * TASA_USD) + '\n\nRecogida en:\n' + DIRECCIONES[vale.almacen] + '\n\nLouis pon: kairos-' + String(CONTADOR).padStart(3, '0') + ' confirmado';
          await sock.sendMessage(LOUIS_LID, { text: tv }); await send('Vale creado y enviado a Louis.'); return;
        }
        if (text.includes('mensajer')) { ped.paso = 'direccion'; await send('Dime la direccion completa y municipio.\nEj: Calle 10 #123, Centro Habana'); return; }
        await send('Escribe: mensajeria o recogida'); return;
      }
      if (ped.paso === 'direccion') {
        ped.direccion = rawText; const enc = buscarMensajeria(rawText); let costo = enc ? enc[1] : 0;
        const totalCant = ped.productos.reduce((s, p) => s + p.cant, 0); if (totalCant >= 3) costo = costo * 2;
        ped.costoMensajeria = costo; CONTADOR++; const totalUSD = ped.productos.reduce((s, p) => s + p.precioUSD * p.cant, 0);
        const vale = { numero: CONTADOR, gestor: from, cliente: ped.cliente, productos: ped.productos, tipo: 'mensajeria', direccion: ped.direccion, totalUSD, costoMensajeria: costo };
        VALES[CONTADOR] = vale; delete PEDIDOS[from];
        const tv = 'VALE KAIROS-' + String(CONTADOR).padStart(3, '0') + ' (PENDIENTE)\n\nCliente: ' + vale.cliente + '\nProductos:\n' + vale.productos.map(p => '- ' + p.nombre + ' x' + p.cant + ' = ' + (p.precioUSD * p.cant) + ' USD').join('\n') + '\n\nTotal USD: ' + totalUSD + '\nTotal MN: ' + (totalUSD * TASA_USD) + '\n\nMensajeria: ' + costo + ' MN\nZona: ' + (enc ? enc[0] : 'Preguntar') + '\nDireccion: ' + vale.direccion + '\n\nLouis pon: kairos-' + String(CONTADOR).padStart(3, '0') + ' confirmado';
        await sock.sendMessage(LOUIS_LID, { text: tv }); await send('Vale creado. Mensajeria: ' + costo + ' MN. Enviado a Louis.'); return;
      }
    }
  });
}
start();
