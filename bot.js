// KAIROS BOT - VERSION FINAL COMPLETA
const http = require('http');
const QRCode = require('qrcode');
const fs = require('fs');
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

// ===== GUARDADO PARA QUE NO SE BORRE AL REINICIAR =====
let CATALOGO = {};
let AGOTADOS = new Set();
let ADMIN_OK = new Set();
let GESTORES = {};
try { if (fs.existsSync('catalogo.json')) CATALOGO = JSON.parse(fs.readFileSync('catalogo.json')); } catch(e) {}
try { if (fs.existsSync('admins.json')) JSON.parse(fs.readFileSync('admins.json')).forEach(id => ADMIN_OK.add(id)); } catch(e) {}
try { if (fs.existsSync('agotados.json')) JSON.parse(fs.readFileSync('agotados.json')).forEach(x => AGOTADOS.add(x)); } catch(e) {}
try { if (fs.existsSync('gestores.json')) GESTORES = JSON.parse(fs.readFileSync('gestores.json')); } catch(e) {}

function guardarTodo() {
  try { fs.writeFileSync('catalogo.json', JSON.stringify(CATALOGO)); } catch(e) {}
  try { fs.writeFileSync('admins.json', JSON.stringify([...ADMIN_OK])); } catch(e) {}
  try { fs.writeFileSync('agotados.json', JSON.stringify([...AGOTADOS])); } catch(e) {}
  try { fs.writeFileSync('gestores.json', JSON.stringify(GESTORES)); } catch(e) {}
}

let PEDIDOS = {};
let VALES = {};
let CONTADOR = 0;
let ACTUALIZANDO = {};
let PIDIENDO_NOMBRE = new Set();
let TASA_USD = 450, TASA_EUR = 480;

async function actualizarTasa() {
  try { const r = await fetch('https://api.eltoque.com/v1/trmi'); const j = await r.json(); if (j?.tasa) TASA_USD = Math.round(j.tasa) + 10; } catch(e) {}
  try { const r2 = await fetch('https://api.eltoque.com/v1/trmi?moneda=EUR'); const j2 = await r2.json(); if (j2?.tasa) TASA_EUR = Math.round(j2.tasa) + 10; } catch(e) {}
  console.log('Tasa actualizada: USD ' + TASA_USD + ' / EUR ' + TASA_EUR);
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



    // EN LOS GRUPOS NO RESPONDE, SOLO ESCUCHA A LOUIS PARA CONFIRMAR
if (from.endsWith('@g.us')) {
  const quienHabla = m.key.participant || m.participant || '';
  const esLouisGrupo = quienHabla === LOUIS_JID || quienHabla === LOUIS_LID || quienHabla.includes('5356947882') || quienHabla.includes('132624865579031');
  const mcGrupo = rawText.match(/kairos[-\s]?(\d+)\s+confirmado/i);
  if (esLouisGrupo && mcGrupo) {
    // deja que siga abajo a confirmar, no lo cortes
  } else {
    return; // en el grupo nadie mas lo activa
  }
}
    const nombreGestor = m.pushName || from;
    const rawText = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim();
    const text = rawText.toLowerCase().trim();
    const send = async (t) => { await sock.sendMessage(from, { text: t }); };
    const esLouis = from === LOUIS_JID || from === LOUIS_LID;
    const esAdmin = ADMIN_OK.has(from) || esLouis;

    if (text === 'mi id') { await send('Tu ID es: ' + from); return; }
    if (text === 'cancelar' || text === 'reiniciar' || text === 'menu') { delete PEDIDOS[from]; delete ACTUALIZANDO[from]; PIDIENDO_NOMBRE.delete(from); await send('Listo, borre lo que estabas haciendo. Escribe *catalogo*'); return; }
    if (text === 'soy admin kairos123') {
      ADMIN_OK.add(from); guardarTodo();
      await send('Bienvenido Admin KAIROS.\nYa quedaste guardado, no tienes que volver a poner esto.\nComandos: actualizar almacen 1, quitar producto X, agotado X, ver catalogo');
      return;
    }
    if (text === 'tasa' || text === 'toque') { await send('El Toque +10\nUSD: ' + TASA_USD + ' MN\nEUR: ' + TASA_EUR + ' MN'); return; }

    // ===== PRIMERA VEZ DEL GESTOR: PEDIR NOMBRE Y GUARDARLO =====
    if (!esAdmin && !GESTORES[from] && !PIDIENDO_NOMBRE.has(from)) {
      PIDIENDO_NOMBRE.add(from);
      await send('Hola, bienvenido a KAIROS.\nEres nuevo, dime tu nombre completo para guardarte.\nEj: Maria Lopez');
      return;
    }
    if (!esAdmin && PIDIENDO_NOMBRE.has(from)) {
      const nombre = rawText.trim();
      if (nombre.length < 3 || nombre.toLowerCase() === 'hola' || nombre.toLowerCase() === 'catalogo') { await send('Dime tu nombre completo, ej: Maria Lopez'); return; }
      GESTORES[from] = nombre;
      PIDIENDO_NOMBRE.delete(from);
      guardarTodo();
      await send('Perfecto ' + nombre + ', ya quedaste guardado.\nCada vale que mandes saldra con tu nombre.\n\nEscribe: *catalogo*');
      return;
    }

    // ===== ACTUALIZAR ALMACEN =====
    if (esAdmin && text.includes('actualizar')) {
      let num = '1';
      if (text.includes('2')) num = '2';
      if (text.includes('3')) num = '3';
      ACTUALIZANDO[from] = num;
      delete PEDIDOS[from];
      await send('Vas a actualizar ALMACEN ' + num + '\nManda la lista ahora, un producto por linea.\nEj: Arrocera Estelectric -- 27');
      return;
    }
    if (esAdmin && ACTUALIZANDO[from]) {
      const miAlmacen = ACTUALIZANDO[from];
      for (const k in CATALOGO) { if (CATALOGO[k].almacen === miAlmacen) delete CATALOGO[k]; }
      const ag = [];
      for (const l of rawText.split('\n')) {
        let linea = l.trim();
        if (!linea) continue;
        linea = linea.replace(/^[☑️✅✔️•\-\* ]+/u, '').trim();
        if (!linea) continue;
        linea = linea.replace(/\(.*?USD.*?\)/gi, '').trim();
        const mPrecio = linea.match(/(.+?)[\s\-–—]*(\d+(\.\d+)?)\s*(USD|usd)?\s*$/);
        if (!mPrecio) continue;
        let nom = mPrecio[1].trim().replace(/[-–—\s]+$/,'').trim();
        let pre = parseFloat(mPrecio[2]);
        if (!nom || !pre) continue;
        const cl = nom.toUpperCase();
        CATALOGO[cl] = { nombre: nom, precioUSD: pre, almacen: miAlmacen };
        AGOTADOS.delete(cl);
        ag.push(nom + ' - ' + pre + ' USD');
      }
      guardarTodo();
      await send('Listo. Almacen ' + miAlmacen + ' actualizado.\n\n' + ag.join('\n'));
      delete ACTUALIZANDO[from];
      return;
    }
    if (esAdmin && text.startsWith('quitar producto ')) {
      const n = rawText.substring(15).trim().toUpperCase();
      if (CATALOGO[n]) { delete CATALOGO[n]; guardarTodo(); await send('Quitado: ' + n); } else await send('No encontre ese producto.');
      return;
    }
    if (esAdmin && text.startsWith('agotado ')) { const n = rawText.substring(8).trim().toUpperCase(); AGOTADOS.add(n); guardarTodo(); await send(n + ' marcado AGOTADO.'); return; }
    if (esAdmin && text === 'ver catalogo') {
      let t = 'CATALOGO KAIROS\n\n';
      for (const a of ['1','2','3']) { t += '--- ALMACEN ' + a + ' ---\n'; for (const k in CATALOGO) { if (CATALOGO[k].almacen === a) t += CATALOGO[k].nombre + ' - ' + CATALOGO[k].precioUSD + ' USD' + (AGOTADOS.has(k) ? ' AGOTADO' : '') + '\n'; } t += '\n'; }
      await send(t); return;
    }

    // ===== CONFIRMAR VALE =====
    const mc = rawText.match(/kairos[-\s]?(\d+)\s+confirmado/i);
    if (esLouis && mc) {
      const nv = parseInt(mc[1], 10);
      const v = VALES[nv]; if (!v) { await send('No encontre vale ' + nv); return; }
      v.estado = 'confirmado';
      const totalMNFinal = v.metodoPago === 'EUR' ? v.totalUSD * TASA_EUR : v.totalUSD * TASA_USD;
      let res = 'VALE KAIROS-' + String(nv).padStart(3, '0') + ' CONFIRMADO\n\nGestor: ' + v.gestorNombre + '\nCliente: ' + v.cliente + '\nTelefono cliente: ' + v.telefonoCliente + '\nPago: ' + v.metodoPago + '\nProductos:\n' + v.productos.map(p => '- ' + p.nombre + ' x' + p.cant + ' = ' + (p.cant * p.precioUSD) + ' USD').join('\n') + '\nTotal: ' + v.totalUSD + ' ' + v.metodoPago + '\nTotal MN ref: ' + totalMNFinal + ' MN (Toque +10)\nMensajeria: ' + v.costoMensajeria + ' MN';
      if (v.tipo === 'recogida') {
        res += '\nRecogida en: ' + DIRECCIONES[v.almacen];
        await sock.sendMessage(GRUPO_LOCAL, { text: res });
        await sock.sendMessage(v.gestor, { text: 'Tu vale KAIROS-' + String(nv).padStart(3, '0') + ' CONFIRMADO. Recoger en: ' + DIRECCIONES[v.almacen] });
      } else {
        res += '\nMensajeria a: ' + v.direccion;
        await sock.sendMessage(GRUPO_MENSAJERIA, { text: res });
        await sock.sendMessage(v.gestor, { text: 'Tu vale KAIROS-' + String(nv).padStart(3, '0') + ' CONFIRMADO. Va por mensajeria.' });
      }
      await send('Vale ' + nv + ' enviado al grupo.'); return;
    }
    const me = rawText.match(/vale\s+kairos[-\s]?(\d+)\s+entregado/i);
    if (esLouis && me) {
      const nv = parseInt(me[1], 10);
      const v = VALES[nv]; if (!v) { await send('No encontre vale ' + nv); return; }
      const com = comisionDe(v.productos);
      await sock.sendMessage(v.gestor, { text: 'VALE KAIROS-' + String(nv).padStart(3, '0') + ' ENTREGADO. Tu comision: ' + com + ' MN' });
      await send('Entrega notificada. Comision: ' + com); return;
    }

    if (text.includes('hola') || text.includes('buenas') || text.includes('bendecido')) { delete PEDIDOS[from]; await send('Hola, bendecido dia, bienvenido a KAIROS. Soy el gestor de KAIROS.\n\nEscribe: *catalogo*'); return; }
    if (text === 'catálogo' || text === 'catalogo') {
      let t = 'CATALOGO KAIROS\n\n';
      for (const a of ['1','2','3']) {
        t += '--- ALMACEN ' + a + ' ---\n';
        let lista = Object.values(CATALOGO).filter(p => p.almacen === a);
        if (lista.length === 0) t += '(Vacio)\n';
        else lista.forEach((p, i) => { t += (i+1) + '. ' + p.nombre + ' - ' + p.precioUSD + ' USD' + (AGOTADOS.has(p.nombre.toUpperCase()) ? ' AGOTADO' : '') + '\n'; });
        t += '\n';
      }
      t += 'Escribe el numero o el nombre del producto que quieres.'; await send(t); return;
    }

    // ===== ELEGIR POR NUMERO O NOMBRE =====
    if (!PEDIDOS[from]) {
      let productoEncontrado = null;
      if (/^[0-9]+$/.test(text.trim())) {
        const lista = Object.values(CATALOGO);
        const idx = parseInt(text.trim()) - 1;
        if (lista[idx]) productoEncontrado = lista[idx];
      } else {
        const clave = text.toUpperCase();
        if (CATALOGO[clave]) productoEncontrado = CATALOGO[clave];
        else { for (const k in CATALOGO) { if (k.includes(clave) || clave.includes(k.split(' ')[0])) { productoEncontrado = CATALOGO[k]; break; } } }
      }
      if (productoEncontrado) {
        const claveReal = productoEncontrado.nombre.toUpperCase();
        if (AGOTADOS.has(claveReal)) { await send('Ese producto esta AGOTADO.'); return; }
        PEDIDOS[from] = { gestor: from, gestorNombre: GESTORES[from] || nombreGestor, productos: [{ nombre: productoEncontrado.nombre, precioUSD: productoEncontrado.precioUSD, cant: 0, almacen: productoEncontrado.almacen }], paso: 'cantidad', actual: 0 };
        await send(productoEncontrado.nombre + ' - ' + productoEncontrado.precioUSD + ' USD\n\nCuantos quieres? Ej: 2'); return;
      }
    }

    const ped = PEDIDOS[from];
    if (ped) {
      if (ped.paso === 'cantidad') {
        const cant = parseInt(text); if (isNaN(cant) || cant <= 0) { await send('Pon un numero, ej: 2'); return; }
        ped.productos[ped.actual].cant = cant; ped.paso = 'otra'; await send('Quieres otra cosa? Escribe *SI* o *NO*'); return;
      }
      if (ped.paso === 'otra') {
        if (text === 'no') { ped.paso = 'datos'; await send('Perfecto. Dime:\nNombre Apellido Carnet\nEj: Juan Perez 12345678901'); return; }
        if (text.startsWith('si')) { ped.paso = 'otro_nombre'; await send('Dime el nombre o numero del otro producto:'); return; }
        await send('Escribe SI o NO'); return;
      }
      if (ped.paso === 'otro_nombre') {
        let enc = null;
        if (/^[0-9]+$/.test(text.trim())) { const lista = Object.values(CATALOGO); enc = lista[parseInt(text.trim()) - 1]; }
        else { const clave = text.toUpperCase(); if (CATALOGO[clave]) enc = CATALOGO[clave]; else { for (const k in CATALOGO) { if (k.includes(clave)) { enc = CATALOGO[k]; break; } } } }
        if (enc) { ped.productos.push({ nombre: enc.nombre, precioUSD: enc.precioUSD, cant: 0, almacen: enc.almacen }); ped.actual = ped.productos.length - 1; ped.paso = 'cantidad'; await send(enc.nombre + ' - ' + enc.precioUSD + ' USD\nCuantos?'); }
        else await send('No encontre ese producto. Escribe el nombre o numero exacto.');
        return;
      }
      if (ped.paso === 'datos') { ped.cliente = rawText; ped.paso = 'telefono'; await send('Perfecto. Ahora dime el TELEFONO del cliente para que la mensajeria lo llame.\nEj: 5351234567'); return; }
      if (ped.paso === 'telefono') {
        ped.telefonoCliente = rawText;
        ped.paso = 'pago';
        const totalUSD = ped.productos.reduce((s, p) => s + p.precioUSD * p.cant, 0);
        const totalEUR = totalUSD;
        const totalMN = totalUSD * TASA_USD;
        let resumen = 'RESUMEN DE TU PEDIDO\n\n';
        ped.productos.forEach(p => { resumen += '- ' + p.nombre + ' x' + p.cant + ' = ' + (p.precioUSD * p.cant) + ' USD\n'; });
        resumen += '\nTotal a pagar, escoge como vas a pagar:\n';
        resumen += '1. USD: ' + totalUSD + ' USD\n';
        resumen += '2. EUR: ' + totalEUR + ' EUR\n';
        resumen += '3. MN: ' + totalMN + ' MN (Toque +10)\n\n';
        resumen += 'Escribe: 1, 2 o 3';
        await send(resumen);
        return;
      }
      if (ped.paso === 'pago') {
        if (text === '1' || text.includes('usd') || text.includes('dolar')) ped.metodoPago = 'USD';
        else if (text === '2' || text.includes('eur')) ped.metodoPago = 'EUR';
        else if (text === '3' || text.includes('mn') || text.includes('cup') || text.includes('peso')) ped.metodoPago = 'MN';
        else { await send('Escribe: 1 para USD, 2 para EUR, 3 para MN'); return; }
        ped.paso = 'tipo';
        await send('Pago: ' + ped.metodoPago + '\n\nMensajeria o recogida?\nEscribe: *mensajeria* o *recogida*');
        return;
      }
      if (ped.paso === 'tipo') {
        if (text.includes('recogida')) {
          CONTADOR++; const totalUSD = ped.productos.reduce((s, p) => s + p.precioUSD * p.cant, 0);
          const totalMNFinal = ped.metodoPago === 'EUR' ? totalUSD * TASA_EUR : totalUSD * TASA_USD;
          const vale = { numero: CONTADOR, gestor: from, gestorNombre: ped.gestorNombre || GESTORES[from] || nombreGestor, cliente: ped.cliente, telefonoCliente: ped.telefonoCliente, metodoPago: ped.metodoPago, productos: ped.productos, tipo: 'recogida', almacen: ped.productos[0].almacen, totalUSD, costoMensajeria: 0 };
          VALES[CONTADOR] = vale; delete PEDIDOS[from];
          const tv = 'VALE KAIROS-' + String(CONTADOR).padStart(3, '0') + ' (PENDIENTE)\n\nGestor: ' + vale.gestorNombre + '\nCliente: ' + vale.cliente + '\nTelefono cliente: ' + vale.telefonoCliente + '\nPago: ' + vale.metodoPago + '\nProductos:\n' + vale.productos.map(p => '- ' + p.nombre + ' x' + p.cant + ' = ' + (p.precioUSD * p.cant) + ' USD').join('\n') + '\n\nTotal: ' + totalUSD + ' ' + vale.metodoPago + '\nTotal MN ref: ' + totalMNFinal + ' MN (Toque +10)\n\nRecogida en:\n' + DIRECCIONES[vale.almacen] + '\n\nLouis pon: kairos-' + String(CONTADOR).padStart(3, '0') + ' confirmado';
          await sock.sendMessage(LOUIS_LID, { text: tv }); await send('Vale creado y enviado a Louis.'); return;
        }
        if (text.includes('mensajer')) { ped.paso = 'direccion'; await send('Dime la direccion completa y municipio.\nEj: Calle 10 #123, Centro Habana'); return; }
        await send('Escribe: mensajeria o recogida'); return;
      }
      if (ped.paso === 'direccion') {
        ped.direccion = rawText; const enc = buscarMensajeria(rawText); let costo = enc ? enc[1] : 0;
        const totalCant = ped.productos.reduce((s, p) => s + p.cant, 0); if (totalCant >= 3) costo = costo * 2;
        ped.costoMensajeria = costo; CONTADOR++; const totalUSD = ped.productos.reduce((s, p) => s + p.precioUSD * p.cant, 0);
        const totalMNFinal = ped.metodoPago === 'EUR' ? totalUSD * TASA_EUR : totalUSD * TASA_USD;
        const vale = { numero: CONTADOR, gestor: from, gestorNombre: ped.gestorNombre || GESTORES[from] || nombreGestor, cliente: ped.cliente, telefonoCliente: ped.telefonoCliente, metodoPago: ped.metodoPago, productos: ped.productos, tipo: 'mensajeria', direccion: ped.direccion, totalUSD, costoMensajeria: costo };
        VALES[CONTADOR] = vale; delete PEDIDOS[from];
        const tv = 'VALE KAIROS-' + String(CONTADOR).padStart(3, '0') + ' (PENDIENTE)\n\nGestor: ' + vale.gestorNombre + '\nCliente: ' + vale.cliente + '\nTelefono cliente: ' + vale.telefonoCliente + '\nPago: ' + vale.metodoPago + '\nProductos:\n' + vale.productos.map(p => '- ' + p.nombre + ' x' + p.cant + ' = ' + (p.precioUSD * p.cant) + ' USD').join('\n') + '\n\nTotal: ' + totalUSD + ' ' + vale.metodoPago + '\nTotal MN ref: ' + totalMNFinal + ' MN (Toque +10)\n\nMensajeria: ' + costo + ' MN\nZona: ' + (enc ? enc[0] : 'Preguntar') + '\nDireccion: ' + vale.direccion + '\n\nLouis pon: kairos-' + String(CONTADOR).padStart(3, '0') + ' confirmado';
        await sock.sendMessage(LOUIS_LID, { text: tv }); await send('Vale creado. Mensajeria: ' + costo + ' MN. Enviado a Louis.'); return;
      }
    }
  });
}
start();
