// BOT KAIROS - PARTE 1
const http = require('http');
const QRCode = require('qrcode');
let ULTIMO_QR = '';
http.createServer(async (req, res) => {
  if (req.url === '/qr') {
    if (!ULTIMO_QR) { res.end('Aun no hay QR, espera 20 seg y recarga.'); return; }
    let img = await QRCode.toDataURL(ULTIMO_QR);
    res.end('<h1>KAIROS - Escanea</h1><img src="' + img + '" style="width:350px">');
    return;
  }
  res.end('KAIROS OK - Ve a /qr');
}).listen(process.env.PORT || 3000);

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const ADMIN_NUM = '5356947882';
const esLouis = from === LOUIS_JID || num === ADMIN_NUM || num === '56947882';
const GRUPO_LOCAL = '120363417801594416@g.us';
const GRUPO_MENSAJERIA = '120363419483851412@g.us';
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
function buscarMensajeria(t) {
  t = t.toUpperCase(); let mejor = null;
  for (let [z, p] of MENSAJERIA) { if (t.includes(z)) { if (!mejor || z.length > mejor[0].length) mejor = [z, p]; } }
  return mejor;
}
function esGrande(n) {
  n = n.toUpperCase();
  return n.includes('NEVERA') || n.includes('FRIO') || n.includes('FRÍO') || n.includes('PLANTA') || n.includes('EXHIBIDORA') || n.includes('TV');
}
function comisionDe(prods) { let t = 0; for (let p of prods) t += esGrande(p.nombre) ? 2500 : 1200; return t; }
let TASA_USD = 450, TASA_EUR = 480;
async function actualizarTasa() {
  try { let r = await fetch('https://api.eltoque.com/v1/trmi'); let j = await r.json(); if (j && j.tasa) TASA_USD = Math.round(j.tasa) + 10; } catch(e) {}
  try { let r2 = await fetch('https://api.eltoque.com/v1/trmi?moneda=EUR'); let j2 = await r2.json(); if (j2 && j2.tasa) TASA_EUR = Math.round(j2.tasa) + 10; } catch(e) {}
}
actualizarTasa();
setInterval(actualizarTasa, 15 * 60 * 1000);
let PEDIDOS = {}; let VALES = {}; let CONTADOR = 0; let ACTUALIZANDO = null; let ADMIN_OK = new Set();


// BOT KAIROS - PARTE 2 - PEGA ABAJO DE LA PARTE 1
async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('sesion-kairos');
  const sock = makeWASocket({ logger: pino({ level: 'silent' }), auth: state, printQRInTerminal: true });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) { ULTIMO_QR = qr; console.log('QR NUEVO - VE A /qr'); }
    if (connection === 'close') {
      let rec = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (rec) start();
    } else if (connection === 'open') console.log('KAIROS CONECTADO');
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;
    const from = m.key.remoteJid;
    const num = from.replace('@s.whatsapp.net','').replace('@lid','');
    const rawText = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim();
    const text = rawText.toLowerCase().trim();
    const send = async (t) => { await sock.sendMessage(from, { text: t }); };
    const esLouis = from === LOUIS_JID || num === ADMIN_NUM || num === '56947882';
    const esAdmin = ADMIN_OK.has(from) || esLouis;

    if (text === 'soy admin kairos123') { ADMIN_OK.add(from); await send('Bienvenido Admin KAIROS. Ya puedes usar: actualizar almacen 1, quitar almacen, quitar producto, agotado.'); return; }
    if (text === 'mi id') { await send('Tu ID es: ' + from); return; }
    if (text === 'ver grupos' && esAdmin) {
      try { let g = await sock.groupFetchAllParticipating(); let l = Object.values(g).map(x => x.subject + '\nID: ' + x.id).join('\n\n'); await send('GRUPOS:\n\n' + l); } catch(e) { await send('Error: ' + e.message); }
      return;
    }
    if (text === 'tasa' || text === 'toque') { await send('El Toque +10\nUSD: ' + TASA_USD + ' MN\nEUR: ' + TASA_EUR + ' MN'); return; }

    if (esAdmin && /^actualizar\s+almac[eé]n\s+[123]$/.test(text)) {
      ACTUALIZANDO = text.match(/([123])/)[1];
      await send('Vas a actualizar ALMACEN ' + ACTUALIZANDO + '\nManda la lista, un producto por linea:\nPanel solar LONGi 635 - 400\nAl enviar, se BORRA lo anterior.');
      return;
    }
    if (esAdmin && ACTUALIZANDO) {
      let lineas = rawText.split('\n');
      for (let k in CATALOGO) { if (CATALOGO[k].almacen === ACTUALIZANDO) delete CATALOGO[k]; }
      let ag = [];
      for (let l of lineas) {
        let lim = l.trim().replace(/^[✅☑️✔️•\-\* ]+/, '').trim(); if (!lim) continue;
        let pa = lim.split(' - '); let nom = pa[0].trim(); let pre = pa[1] ? parseFloat(pa[1].replace(/[^0-9.]/g,'')) : 0;
        let cl = nom.toUpperCase(); CATALOGO[cl] = { nombre: nom, precioUSD: pre, almacen: ACTUALIZANDO }; AGOTADOS.delete(cl); ag.push(nom + ' - ' + pre + ' USD');
      }
      await send('Listo. Almacen ' + ACTUALIZANDO + ' actualizado. Se borro lo anterior.\n\n' + ag.join('\n')); ACTUALIZANDO = null; return;
    }
    if (esAdmin && /^quitar\s+almac[eé]n\s+[123]$/.test(text)) {
      let n = text.match(/([123])/)[1]; for (let k in CATALOGO) { if (CATALOGO[k].almacen === n) delete CATALOGO[k]; }
      await send('Almacen ' + n + ' quitado completo.'); return;
    }
    if (esAdmin && text.startsWith('quitar producto ')) {
      let nom = rawText.substring(15).trim().toUpperCase();
      if (CATALOGO[nom]) { delete CATALOGO[nom]; await send('Producto ' + nom + ' quitado.'); } else await send('No encontre ese producto.');
      return;
    }
    if (esAdmin && text.startsWith('agotado ')) { let nom = rawText.substring(8).trim().toUpperCase(); AGOTADOS.add(nom); await send(nom + ' marcado como AGOTADO.'); return; }
    if (esAdmin && text === 'ver catalogo') {
      let t = 'CATALOGO\n\n';
      for (let a of ['1','2','3']) { t += '--- ALMACEN ' + a + ' ---\n'; for (let k in CATALOGO) { if (CATALOGO[k].almacen === a) t += CATALOGO[k].nombre + ' - ' + CATALOGO[k].precioUSD + ' USD' + (AGOTADOS.has(k) ? ' AGOTADO' : '') + '\n'; } t += '\n'; }
      await send(t); return;
    }

    let mc = rawText.match(/kairos[-\s]?(\d+)\s+confirmado/i);
    if (esLouis && mc) {
      let nv = mc[1]; let v = VALES[nv]; if (!v) { await send('No encontre vale ' + nv); return; }
      v.estado = 'confirmado';
      let res = 'VALE KAIROS-' + nv + ' CONFIRMADO\n\nCliente: ' + v.cliente + '\nProductos:\n' + v.productos.map(p => '- ' + p.nombre + ' x' + p.cant + ' - ' + (p.cant * p.precioUSD) + ' USD').join('\n') + '\nTotal USD: ' + v.totalUSD + '\nTotal MN: ' + (v.totalUSD * TASA_USD) + '\nMensajeria: ' + v.costoMensajeria + ' MN';
      if (v.tipo === 'recogida') {
        res += '\nRecogida en: ' + DIRECCIONES[v.almacen] + '\nSIN DIRECCION DEL CLIENTE';
        await sock.sendMessage(GRUPO_LOCAL, { text: res });
        await sock.sendMessage(v.gestor, { text: 'Tu vale KAIROS-' + nv + ' ya esta CONFIRMADO. Recoger en: ' + DIRECCIONES[v.almacen] });
      } else {
        res += '\nMensajeria a: ' + v.direccion + '\nSIN NUMERO DEL CLIENTE';
        await sock.sendMessage(GRUPO_MENSAJERIA, { text: res });
        await sock.sendMessage(v.gestor, { text: 'Tu vale KAIROS-' + nv + ' ya esta CONFIRMADO. Va por mensajeria.' });
      }
      await send('Vale ' + nv + ' enviado al grupo.'); return;
    }
    let me = rawText.match(/vale\s+kairos[-\s]?(\d+)\s+entregado/i);
    if (esLouis && me) {
      let nv = me[1]; let v = VALES[nv]; if (!v) { await send('No encontre vale ' + nv); return; }
      v.estado = 'entregado'; let com = comisionDe(v.productos);
      await sock.sendMessage(v.gestor, { text: 'VALE KAIROS-' + nv + ' YA SE ENTREGO. Tu comision: ' + com + ' MN' });
      await send('Entrega notificada. Comision: ' + com); return;
    }

    if (['hola','buenas','hello','buenos dias','bendecido'].some(w => text.includes(w))) {
      await send('Hola, bendecido dia, bienvenido a KAIROS. Soy el gestor de KAIROS.\n\nEscribe la palabra: *catálogo* para ver los almacenes.'); return;
    }
    if (text === 'catálogo' || text === 'catalogo') {
      let t = 'CATALOGO KAIROS\n\n';
      for (let a of ['1','2','3']) { t += '--- ALMACEN ' + a + ' ---\n'; let hay = false; for (let k in CATALOGO) { if (CATALOGO[k].almacen === a) { hay = true; t += CATALOGO[k].nombre + ' - ' + CATALOGO[k].precioUSD + ' USD' + (AGOTADOS.has(k) ? ' AGOTADO' : '') + '\n'; } } if (!hay) t += '(Vacio)\n'; t += '\n'; }
      t += '¿Que producto deseas? Escribe el nombre exacto.'; await send(t); return;
    }

    let claveProd = text.toUpperCase();
    if (CATALOGO[claveProd] && !PEDIDOS[from]) {
      if (AGOTADOS.has(claveProd)) { await send('Ese producto esta AGOTADO.'); return; }
      PEDIDOS[from] = { gestor: from, productos: [{ nombre: CATALOGO[claveProd].nombre, precioUSD: CATALOGO[claveProd].precioUSD, cant: 0, almacen: CATALOGO[claveProd].almacen }], paso: 'cantidad', actual: 0 };
      await send(CATALOGO[claveProd].nombre + ' - ' + CATALOGO[claveProd].precioUSD + ' USD\n\n¿Cuantos quieres? Ej: 2'); return;
    }

    let ped = PEDIDOS[from];
    if (ped) {
      if (ped.paso === 'cantidad') {
        let cant = parseInt(text); if (isNaN(cant) || cant <= 0) { await send('Pon un numero, ej: 2'); return; }
        ped.productos[ped.actual].cant = cant; ped.paso = 'otra';
        await send('¿Quieres otra cosa? Escribe *SI* o *NO*'); return;
      }
      if (ped.paso === 'otra') {
        if (text === 'no' || text === 'nop') { ped.paso = 'datos'; await send('Perfecto. Ahora dime:\nNombre Apellido Carnet\nEj: Juan Perez 12345678901'); return; }
        if (text.startsWith('si')) { await send('Dime el nombre del otro producto:'); ped.paso = 'otro_nombre'; return; }
        await send('¿Quieres otra cosa? Escribe SI o NO'); return;
      }
      if (ped.paso === 'otro_nombre') {
        let c2 = text.toUpperCase();
        if (CATALOGO[c2]) { ped.productos.push({ nombre: CATALOGO[c2].nombre, precioUSD: CATALOGO[c2].precioUSD, cant: 0, almacen: CATALOGO[c2].almacen }); ped.actual = ped.productos.length - 1; ped.paso = 'cantidad'; await send(CATALOGO[c2].nombre + ' - ' + CATALOGO[c2].precioUSD + ' USD\n¿Cuantos quieres?'); }
        else await send('No encontre ese producto. Escribe el nombre exacto del catalogo.');
        return;
      }
      if (ped.paso === 'datos') { ped.cliente = rawText; ped.paso = 'tipo'; await send('¿Mensajeria o recogida al local?\nEscribe: *mensajería* o *recogida*'); return; }
      if (ped.paso === 'tipo') {
        if (text.includes('recogida')) {
          ped.tipo = 'recogida'; ped.almacen = ped.productos[0].almacen; CONTADOR++;
          let totalUSD = ped.productos.reduce((s,p) => s + p.precioUSD * p.cant, 0);
          let vale = { numero: CONTADOR, gestor: from, cliente: ped.cliente, productos: ped.productos, tipo: 'recogida', almacen: ped.almacen, totalUSD: totalUSD, costoMensajeria: 0, estado: 'pendiente' };
          VALES[CONTADOR] = vale; delete PEDIDOS[from];
          let tv = 'VALE KAIROS-' + String(CONTADOR).padStart(3,'0') + ' (PENDIENTE)\n\nCliente: ' + vale.cliente + '\nProductos:\n' + vale.productos.map(p => '- ' + p.nombre + ' x' + p.cant + ' = ' + (p.precioUSD * p.cant) + ' USD').join('\n') + '\n\nTotal:\nUSD: ' + totalUSD + '\nEUR: ' + (totalUSD * TASA_USD / TASA_EUR).toFixed(0) + '\nMN: ' + (totalUSD * TASA_USD) + '\n\nRecogida en:\n' + DIRECCIONES[vale.almacen] + '\n\nPara confirmar, Louis debe poner: kairos-' + String(CONTADOR).padStart(3,'0') + ' confirmado';
          await sock.sendMessage(LOUIS_JID, { text: tv }); await send('Vale creado y enviado a Louis para confirmar.'); return;
        }
        if (text.includes('mensajer')) { ped.tipo = 'mensajeria'; ped.paso = 'direccion'; await send('Dime la direccion completa y municipio / zona, para calcular la mensajeria.\nEj: Calle 10 #123, Centro Habana'); return; }
        await send('Escribe: mensajería o recogida'); return;
      }
      if (ped.paso === 'direccion') {
        ped.direccion = rawText; let enc = buscarMensajeria(rawText); let base = enc ? enc[1] : 0;
        let totalCant = ped.productos.reduce((s,p) => s + p.cant, 0); let esDoble = totalCant >= 3; let extra = 0; let det = '';
        for (let p of ped.productos) { let n = p.nombre.toUpperCase(); if (n.includes('NEVERA') && (n.includes('11') || n.includes('16'))) { extra += 500; det += '\n+500 Nevera 11/16'; } if (n.includes('EXHIBIDORA')) { extra += 1000; det += '\n+1000 Exhibidora'; } if (n.includes('FRIO') || n.includes('FRÍO')) { extra += 800; det += '\n+800 Frio 15 pies'; } }
        let costo = base; if (esDoble) { costo = base * 2; det += '\nDoble por 3 o mas equipos'; } costo += extra;
        ped.costoMensajeria = costo; ped.zonaEncontrada = enc ? enc[0] : 'Fuera de La Habana - Preguntar'; CONTADOR++;
        let totalUSD = ped.productos.reduce((s,p) => s + p.precioUSD * p.cant, 0);
        let vale = { numero: CONTADOR, gestor: from, cliente: ped.cliente, productos: ped.productos, tipo: 'mensajeria', direccion: ped.direccion, totalUSD: totalUSD, costoMensajeria: costo, estado: 'pendiente' };
        VALES[CONTADOR] = vale; delete PEDIDOS[from];
        let tv = 'VALE KAIROS-' + String(CONTADOR).padStart(3,'0') + ' (PENDIENTE)\n\nCliente: ' + vale.cliente + '\nProductos:\n' + vale.productos.map(p => '- ' + p.nombre + ' x' + p.cant + ' = ' + (p.precioUSD * p.cant) + ' USD').join('\n') + '\n\nTotal:\nUSD: ' + totalUSD + '\nEUR: ' + (totalUSD * TASA_USD / TASA_EUR).toFixed(0) + '\nMN: ' + (totalUSD * TASA_USD) + '\n\nMensajeria: ' + costo + ' MN\nZona: ' + ped.zonaEncontrada + det + '\nDireccion: ' + vale.direccion + '\n\nPara confirmar, Louis debe poner: kairos-' + String(CONTADOR).padStart(3,'0') + ' confirmado';
        await sock.sendMessage(LOUIS_JID, { text: tv }); await send('Vale creado. Mensajeria: ' + costo + ' MN (' + ped.zonaEncontrada + '). Enviado a Louis.'); return;
      }
    }
  });
}
start();
