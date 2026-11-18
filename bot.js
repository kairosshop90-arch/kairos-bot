// BOT KAIROS - DESDE 0 - v1
// Para que Render no se queje del puerto
const http = require('http');
http.createServer((req, res) => { res.end('KAIROS OK 👑'); }).listen(process.env.PORT || 3000);
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

const ADMIN_NUM = '5356947882';
const LOUIS_JID = '5356947882@s.whatsapp.net';
const GRUPO_LOCAL = '120363417801594416@g.us';
const GRUPO_MENSAJERIA = '120363419483851412@g.us';

// ALMACENES
let ALMACENES = { 1: {}, 2: {}, 3: {} };
let DIRECCIONES = {
  1: 'Calle 1ra / 2da y 4ta No.23308. Altura del Mirador',
  2: 'Calle 2da #18532 / E y D. Luyanó Moderno, San Miguel del Padrón',
  3: 'En espera de dirección'
};
// CATALOGO: clave = NOMBRE EN MAYUSCULA, valor = {nombre, precioUSD, almacen}
let CATALOGO = {};
let AGOTADOS = new Set();

// MENSAJERIA - precio base por zona, buscamos por palabra
let MENSAJERIA = [
  ['SAN MIGUEL', 1000], ['SAN MIGUEL', 1500],
  ['GUANABACOA', 2000], ['ROBLE', 2500], ['JATA', 2500], ['MIKITO', 2500], ['NARANJO', 2500],
  ['SANTA FE', 3000], ['BARRERAS', 4000], ['MINAS', 4000], ['CAMPO FLORIDO', 5000],
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

// TASA EL TOQUE + 10
let TASA_USD = 450, TASA_EUR = 480;
async function actualizarTasa() {
  try {
    let r = await fetch('https://api.eltoque.com/v1/trmi');
    let j = await r.json();
    if (j && j.tasa) { TASA_USD = Math.round(j.tasa) + 10; }
  } catch(e) { console.log('No pude actualizar El Toque, uso ' + TASA_USD); }
  try {
    let r2 = await fetch('https://api.eltoque.com/v1/trmi?moneda=EUR');
    let j2 = await r2.json();
    if (j2 && j2.tasa) { TASA_EUR = Math.round(j2.tasa) + 10; }
  } catch(e) {}
}
actualizarTasa();
setInterval(actualizarTasa, 15 * 60 * 1000);

// ESTADOS
let PEDIDOS = {}; // por gestor jid
let VALES = {}; // numero -> vale
let CONTADOR = 0;
let ACTUALIZANDO = null;
let ADMIN_OK = new Set();

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('sesion-kairos');
  const sock = makeWASocket({ logger: pino({ level: 'silent' }), auth: state, printQRInTerminal: true });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect } = u;
    if (connection === 'close') {
      let rec = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (rec) start();
    } else if (connection === 'open') console.log('✅ KAIROS CONECTADO');
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

    // ADMIN - identificarse
    if (text === 'soy admin kairos123') {
      ADMIN_OK.add(from);
      await send('✅ Bienvenido Admin KAIROS 👑\nYa puedes usar: actualizar almacén 1, quitar almacén, quitar producto, agotado, etc.');
      return;
    }
    if (text === 'mi id') { await send('Tu ID es: ' + from); return; }
    if (text === 'ver grupos' && esAdmin) {
      try {
        let grupos = await sock.groupFetchAllParticipating();
        let lista = Object.values(grupos).map(g => '📦 ' + g.subject + '\nID: ' + g.id).join('\n\n');
        await send('🏪 GRUPOS:\n\n' + lista);
      } catch(e) { await send('Error: ' + e.message); }
      return;
    }
    if (text === 'tasa' || text === 'toque') {
      await send('💵 El Toque +10\nUSD: ' + TASA_USD + ' MN\nEUR: ' + TASA_EUR + ' MN');
      return;
    }

    // ===== ADMIN - ALMACENES =====
    if (esAdmin && /^actualizar\s+almac[eé]n\s+[123]$/.test(text)) {
      ACTUALIZANDO = text.match(/([123])/)[1];
      await send('📦 Vas a actualizar el ALMACÉN ' + ACTUALIZANDO + '\n\nManda la lista, un producto por línea, con precio:\nPanel solar LONGi 635 - 400\nCasco de moto - 50\n\nAl enviar, se BORRA lo anterior de ese almacén y queda solo lo nuevo.');
      return;
    }
    if (esAdmin && ACTUALIZANDO) {
      let lineas = rawText.split('\n');
      // Borrar anterior de ese almacén
      for (let k in CATALOGO) { if (CATALOGO[k].almacen === ACTUALIZANDO) delete CATALOGO[k]; }
      let agregados = [];
      for (let l of lineas) {
        let limpio = l.trim().replace(/^[✅☑️✔️•\-\* ]+/, '').trim();
        if (!limpio) continue;
        let partes = limpio.split(' - ');
        let nombre = partes[0].trim();
        let precio = partes[1] ? parseFloat(partes[1].replace(/[^0-9.]/g,'')) : 0;
        let clave = nombre.toUpperCase();
        CATALOGO[clave] = { nombre: nombre, precioUSD: precio, almacen: ACTUALIZANDO };
        AGOTADOS.delete(clave);
        agregados.push(nombre + ' - ' + precio + ' USD');
      }
      await send('✅ Listo Louis 👑\nAlmacén ' + ACTUALIZANDO + ' actualizado. Se borró lo anterior.\n\n' + agregados.join('\n'));
      ACTUALIZANDO = null;
      return;
    }
    if (esAdmin && /^quitar\s+almac[eé]n\s+[123]$/.test(text)) {
      let n = text.match(/([123])/)[1];
      for (let k in CATALOGO) { if (CATALOGO[k].almacen === n) delete CATALOGO[k]; }
      await send('✅ Almacén ' + n + ' quitado completo.');
      return;
    }
    if (esAdmin && text.startsWith('quitar producto ')) {
      let nombre = rawText.substring(15).trim().toUpperCase();
      if (CATALOGO[nombre]) { delete CATALOGO[nombre]; await send('✅ Producto ' + nombre + ' quitado.'); }
      else await send('No encontré ese producto.');
      return;
    }
    if (esAdmin && text.startsWith('agotado ')) {
      let nombre = rawText.substring(8).trim().toUpperCase();
      AGOTADOS.add(nombre);
      await send('✅ ' + nombre + ' marcado como AGOTADO.');
      return;
    }
    if (esAdmin && text === 'ver catalogo') {
      let t = '📦 CATÁLOGO\n\n';
      for (let a of ['1','2','3']) {
        t += '--- ALMACÉN ' + a + ' ---\n';
        for (let k in CATALOGO) { if (CATALOGO[k].almacen === a) t += CATALOGO[k].nombre + ' - ' + CATALOGO[k].precioUSD + ' USD' + (AGOTADOS.has(k) ? ' ❌ AGOTADO' : '') + '\n'; }
        t += '\n';
      }
      await send(t || 'Catálogo vacío.');
      return;
    }

    // ===== LOUIS - CONFIRMAR / ENTREGAR =====
    let mc = rawText.match(/kairos[-\s]?(\d+)\s+confirmado/i);
    if (esLouis && mc) {
      let numVale = mc[1];
      let v = VALES[numVale];
      if (!v) { await send('No encontré el vale ' + numVale); return; }
      v.estado = 'confirmado';
      let resumen = '✅ VALE KAIROS-' + numVale + ' CONFIRMADO 👑\n\nCliente: ' + v.cliente + '\nProductos:\n' + v.productos.map(p => '- ' + p.nombre + ' x' + p.cant + ' - ' + (p.cant * p.precioUSD) + ' USD').join('\n') + '\nTotal USD: ' + v.totalUSD + '\nTotal MN: ' + (v.totalUSD * TASA_USD) + '\nMensajería: ' + v.costoMensajeria + ' MN';
      if (v.tipo === 'recogida') {
        resumen += '\nRecogida en: ' + DIRECCIONES[v.almacen] + '\nSIN DIRECCIÓN DEL CLIENTE';
        await sock.sendMessage(GRUPO_LOCAL, { text: resumen });
        await sock.sendMessage(v.gestor, { text: '✅ Tu vale KAIROS-' + numVale + ' ya está CONFIRMADO 👑\nEl cliente puede recoger en: ' + DIRECCIONES[v.almacen] });
      } else {
        resumen += '\nMensajería a: ' + v.direccion + '\nSIN NÚMERO DEL CLIENTE';
        await sock.sendMessage(GRUPO_MENSAJERIA, { text: resumen });
        await sock.sendMessage(v.gestor, { text: '✅ Tu vale KAIROS-' + numVale + ' ya está CONFIRMADO 👑\nVa por mensajería.' });
      }
      await send('✅ Vale ' + numVale + ' enviado al grupo correspondiente.');
      return;
    }
    let me = rawText.match(/vale\s+kairos[-\s]?(\d+)\s+entregado/i);
    if (esLouis && me) {
      let numVale = me[1];
      let v = VALES[numVale];
      if (!v) { await send('No encontré el vale ' + numVale); return; }
      v.estado = 'entregado';
      let com = comisionDe(v.productos);
      await sock.sendMessage(v.gestor, { text: '🎉 VALE KAIROS-' + numVale + ' YA SE ENTREGÓ 👑\nTu comisión ganada: ' + com + ' MN' });
      await send('✅ Entrega notificada al gestor. Comisión: ' + com);
      return;
    }

    // ===== GESTOR - FLUJO DE VENTA =====
    if (['hola','buenas','hello','buenos dias','bendecido'].some(w => text.includes(w))) {
      await send('👑 Hola, bendecido día, bienvenido a KAIROS 👑\n\nSoy el gestor de KAIROS.\n\nEscribe la palabra: *catálogo* para ver los almacenes.');
      return;
    }
    if (text === 'catálogo' || text === 'catalogo') {
      let t = '📦 CATÁLOGO KAIROS 👑\n\nTenemos 3 almacenes:\n\n';
      for (let a of ['1','2','3']) {
        t += '--- ALMACÉN ' + a + ' ---\n';
        let hay = false;
        for (let k in CATALOGO) {
          if (CATALOGO[k].almacen === a) { hay = true; t += CATALOGO[k].nombre + ' - ' + CATALOGO[k].precioUSD + ' USD' + (AGOTADOS.has(k) ? ' ❌ AGOTADO' : '') + '\n'; }
        }
        if (!hay) t += '(Vacío)\n';
        t += '\n';
      }
      t += '¿Qué producto deseas? Escribe el nombre exacto.';
      await send(t);
      return;
    }

    // Si el gestor escribe un nombre de producto
    let claveProd = text.toUpperCase();
    if (CATALOGO[claveProd] && !PEDIDOS[from]) {
      if (AGOTADOS.has(claveProd)) { await send('❌ Ese producto está AGOTADO en este momento.'); return; }
      PEDIDOS[from] = { gestor: from, productos: [{ nombre: CATALOGO[claveProd].nombre, precioUSD: CATALOGO[claveProd].precioUSD, cant: 0, almacen: CATALOGO[claveProd].almacen }], paso: 'cantidad', actual: 0 };
      await send('✅ ' + CATALOGO[claveProd].nombre + ' - ' + CATALOGO[claveProd].precioUSD + ' USD\n\n¿Cuántos quieres? Escribe la cantidad, ej: 2');
      return;
    }

    // Flujo paso a paso
    let ped = PEDIDOS[from];
    if (ped) {
      if (ped.paso === 'cantidad') {
        let cant = parseInt(text);
        if (isNaN(cant) || cant <= 0) { await send('Pon un número, ej: 2'); return; }
        ped.productos[ped.actual].cant = cant;
        ped.paso = 'otra';
        await send('¿Quieres otra cosa? Escribe *SI* + nombre del producto, o *NO* para seguir.');
        return;
      }
      if (ped.paso === 'otra') {
        if (text === 'no' || text === 'nop') {
          ped.paso = 'datos';
          await send('Perfecto. Ahora dime los datos del cliente:\n\nNombre Apellido Carnet\n\nEj: Juan Pérez 12345678901');
          return;
        }
        if (text.startsWith('si')) {
          await send('Dime el nombre del otro producto:');
          ped.paso = 'otro_nombre';
          return;
        }
        await send('¿Quieres otra cosa? Escribe SI o NO');
        return;
      }
      if (ped.paso === 'otro_nombre') {
        let c2 = text.toUpperCase();
        if (CATALOGO[c2]) {
          ped.productos.push({ nombre: CATALOGO[c2].nombre, precioUSD: CATALOGO[c2].precioUSD, cant: 0, almacen: CATALOGO[c2].almacen });
          ped.actual = ped.productos.length - 1;
          ped.paso = 'cantidad';
          await send('✅ ' + CATALOGO[c2].nombre + ' - ' + CATALOGO[c2].precioUSD + ' USD\n¿Cuántos quieres?');
        } else await send('No encontré ese producto. Escribe el nombre exacto del catálogo.');
        return;
      }
      if (ped.paso === 'datos') {
        ped.cliente = rawText;
        ped.paso = 'tipo';
        await send('¿Mensajería o recogida al local?\n\nEscribe: *mensajería* o *recogida*');
        return;
      }
      if (ped.paso === 'tipo') {
        if (text.includes('recogida')) {
          ped.tipo = 'recogida';
          ped.almacen = ped.productos[0].almacen;
          // Crear vale
          CONTADOR++;
          let totalUSD = ped.productos.reduce((s,p) => s + p.precioUSD * p.cant, 0);
          let vale = { numero: CONTADOR, gestor: from, cliente: ped.cliente, productos: ped.productos, tipo: 'recogida', almacen: ped.almacen, totalUSD: totalUSD, costoMensajeria: 0, estado: 'pendiente' };
          VALES[CONTADOR] = vale;
          delete PEDIDOS[from];
          let textoVale = '🧾 VALE KAIROS-' + String(CONTADOR).padStart(3,'0') + ' (PENDIENTE)\n\nCliente: ' + vale.cliente + '\nProductos:\n' + vale.productos.map(p => '- ' + p.nombre + ' x' + p.cant + ' = ' + (p.precioUSD * p.cant) + ' USD').join('\n') + '\n\nTotal a pagar:\nUSD: ' + totalUSD + '\nEUR: ' + (totalUSD * TASA_USD / TASA_EUR).toFixed(0) + '\nMN: ' + (totalUSD * TASA_USD) + '\n\nRecogida en:\n' + DIRECCIONES[vale.almacen] + '\n\nPara confirmar, Louis debe poner: kairos-' + String(CONTADOR).padStart(3,'0') + ' confirmado';
          await sock.sendMessage(LOUIS_JID, { text: textoVale });
          await send('✅ Vale creado y enviado a Louis para confirmar. Espera la confirmación 👑');
          return;
        }
        if (text.includes('mensajer')) {
          ped.tipo = 'mensajeria';
          ped.paso = 'direccion';
          await send('Dime la dirección completa del cliente y el municipio / zona, para calcular la mensajería.\n\nEj: Calle 10 #123, Centro Habana');
          return;
        }
        await send('Escribe: mensajería o recogida');
        return;
      }
      if (ped.paso === 'direccion') {
        ped.direccion = rawText;
        let encontrado = buscarMensajeria(rawText);
        let base = encontrado ? encontrado[1] : 0;
        let totalCant = ped.productos.reduce((s,p) => s + p.cant, 0);
        let esDoble = totalCant >= 3;
        let extra = 0;
        let detalle = '';
        for (let p of ped.productos) {
          let n = p.nombre.toUpperCase();
          if (n.includes('NEVERA') && (n.includes('11') || n.includes('16'))) { extra += 500; detalle += '\n+500 Nevera 11/16 pies'; }
          if (n.includes('EXHIBIDORA')) { extra += 1000; detalle += '\n+1000 Exhibidora'; }
          if (n.includes('FRIO') || n.includes('FRÍO')) { extra += 800; detalle += '\n+800 Frío 15 pies'; }
        }
        let costo = base;
        if (esDoble) { costo = base * 2; detalle += '\nDoble por 3 o más equipos / equipo grande'; }
        costo += extra;
        ped.costoMensajeria = costo;
        ped.zonaEncontrada = encontrado ? encontrado[0] : 'Fuera de La Habana - Preguntar';
        CONTADOR++;
        let totalUSD = ped.productos.reduce((s,p) => s + p.precioUSD * p.cant, 0);
        let vale = { numero: CONTADOR, gestor: from, cliente: ped.cliente, productos: ped.productos, tipo: 'mensajeria', direccion: ped.direccion, totalUSD: totalUSD, costoMensajeria: costo, estado: 'pendiente' };
        VALES[CONTADOR] = vale;
        delete PEDIDOS[from];
        let textoVale = '🧾 VALE KAIROS-' + String(CONTADOR).padStart(3,'0') + ' (PENDIENTE)\n\nCliente: ' + vale.cliente + '\nProductos:\n' + vale.productos.map(p => '- ' + p.nombre + ' x' + p.cant + ' = ' + (p.precioUSD * p.cant) + ' USD').join('\n') + '\n\nTotal a pagar:\nUSD: ' + totalUSD + '\nEUR: ' + (totalUSD * TASA_USD / TASA_EUR).toFixed(0) + '\nMN: ' + (totalUSD * TASA_USD) + '\n\nMensajería: ' + costo + ' MN\nZona: ' + ped.zonaEncontrada + detalle + '\nDirección: ' + vale.direccion + '\n\nPara confirmar, Louis debe poner: kairos-' + String(CONTADOR).padStart(3,'0') + ' confirmado';
        await sock.sendMessage(LOUIS_JID, { text: textoVale });
        await send('✅ Vale creado. Mensajería calculada: ' + costo + ' MN (' + ped.zonaEncontrada + '). Enviado a Louis para confirmar 👑');
        return;
      }
    }
  });
}
start();
