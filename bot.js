// ============ BOT KAIROS - COMPLETO ============
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const fs = require('fs');
const pino = require('pino');

// ===== CONFIG =====
const GRUPO_INFO = '120207401234567890@g.us'; // <-- PON AQUÍ EL ID REAL DE TU GRUPO DE DUDAS
const GRUPO_PEDIDOS = '120207409876543210@g.us'; // <-- PON AQUÍ EL ID DE TU GRUPO DE PEDIDOS SI LO USAS

const DIRECCIONES = {
  1: 'Calle 1ra / 2da y 4ta No.23308. Altura del Mirador',
  2: 'Calle 2da #18532 / E y D. Luyano Moderno, San Miguel del Padron',
  3: 'En espera de direccion'
};

let TASA_USD = 450;
let TASA_EUR = 500;

// ===== CATALOGO ALMACEN 1 =====
let CATALOGO = [
  { nombre: 'Arrocera Estelectric', precioUSD: 27, almacen: 1 },
  { nombre: 'Arrocera Marwa', precioUSD: 24, almacen: 1 },
  { nombre: 'Alarma solar', precioUSD: 23, almacen: 1 },
  { nombre: 'Batidora Desmatt', precioUSD: 28, almacen: 1 },
  { nombre: 'Bomba de agua Cofix', precioUSD: 38, almacen: 1 },
  { nombre: 'Bocina Chiquita', precioUSD: 10, almacen: 1 },
  { nombre: 'Bicicleta 20', precioUSD: 92, almacen: 1 },
  { nombre: 'Bocina mediana', precioUSD: 63, almacen: 1 },
  { nombre: 'Bocina grande', precioUSD: 89, almacen: 1 },
  { nombre: 'Cocina eléctrica 1h Premier', precioUSD: 15, almacen: 1 },
  { nombre: 'Cocina eléctrica 2h', precioUSD: 20, almacen: 1 },
  { nombre: 'Cocina infrarrojo Marwa', precioUSD: 31, almacen: 1 },
  { nombre: 'Cocina infrarrojo Eko', precioUSD: 31, almacen: 1 },
  { nombre: 'Cocina de inducción 1h', precioUSD: 25, almacen: 1 },
  { nombre: 'Cocina de inducción 2h', precioUSD: 47, almacen: 1 },
  { nombre: 'Colchón EON', precioUSD: 77, almacen: 1 },
  { nombre: 'Cafetera eléctrica Maf', precioUSD: 25.5, almacen: 1 },
  { nombre: 'Cocina de gas 1h Eko', precioUSD: 20, almacen: 1 },
  { nombre: 'Cajita descodificadora Gynipot', precioUSD: 27, almacen: 1 },
  { nombre: 'Estación de energía', precioUSD: 480, almacen: 1 },
  { nombre: 'Fogón de petróleo', precioUSD: 78, almacen: 1 },
  { nombre: 'Freidora de aire Deicha', precioUSD: 45, almacen: 1 },
  { nombre: 'Freidora Eko', precioUSD: 60, almacen: 1 },
  { nombre: 'Inversor', precioUSD: 320, almacen: 1 },
  { nombre: 'Juego de cuchillos', precioUSD: 16, almacen: 1 },
  { nombre: 'Juego de sartén más cazuela', precioUSD: 20, almacen: 1 },
  { nombre: 'Lavadora semiautomática Eko', precioUSD: 15, almacen: 1 },
  { nombre: 'Moto eléctrica KVITOVA', precioUSD: 1399, almacen: 1 },
  { nombre: 'Nevera Royal 3.5 pies', precioUSD: 220, almacen: 1 },
  { nombre: 'Olla de presión SJT 5lt', precioUSD: 28, almacen: 1 },
  { nombre: 'Olla de micro presión', precioUSD: 20, almacen: 1 },
  { nombre: 'Olla multifuncional con evaporera', precioUSD: 40, almacen: 1 },
  { nombre: 'Planta de soldar Maf', precioUSD: 78, almacen: 1 },
  { nombre: 'Reina Mimi', precioUSD: 49, almacen: 1 },
  { nombre: 'TV 43 pulgadas JMD', precioUSD: 255, almacen: 1 },
  { nombre: 'Ventilador de pared Freshcool', precioUSD: 28, almacen: 1 },
  { nombre: 'Ventilador recargable de pedestal Cloud', precioUSD: 68, almacen: 1 },
  { nombre: 'Ventilador recargable J10', precioUSD: 40, almacen: 1 },
  { nombre: 'Ventilador recargable F6', precioUSD: 32, almacen: 1 },
  { nombre: 'Triciclo Ktikova', precioUSD: 3100, almacen: 1 },
  { nombre: 'Bicicleta 26', precioUSD: 110, almacen: 1 },
];

// ===== ESTADO =====
let INFO_PRODUCTOS = {}; // { "ARROCERA MARWA": {texto, fuente, fecha} }
let PENDIENTES_INFO = {}; // { "ARROCERA MARWA": gestorJid }
let PEDIDOS = {};

if (fs.existsSync('datos.json')) {
  try {
    let d = JSON.parse(fs.readFileSync('datos.json'));
    if (d.INFO_PRODUCTOS) INFO_PRODUCTOS = d.INFO_PRODUCTOS;
    if (d.PENDIENTES_INFO) PENDIENTES_INFO = d.PENDIENTES_INFO;
    if (d.TASA_USD) TASA_USD = d.TASA_USD;
    if (d.TASA_EUR) TASA_EUR = d.TASA_EUR;
  } catch (e) {}
}

function guardarTodo() {
  fs.writeFileSync('datos.json', JSON.stringify({ INFO_PRODUCTOS, PENDIENTES_INFO, TASA_USD, TASA_EUR }, null, 2));
}

// ===== FUNCIONES CLAVE - ARREGLO POR NOMBRE, NO POR LUGAR =====
function normalizar(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function buscarProducto(clave) {
  let nClave = normalizar(clave);
  let keys = Object.keys(INFO_PRODUCTOS);
  // 1. EXACTO POR NOMBRE
  for (let k of keys) { if (normalizar(k) === nClave) return k; }
  // 2. Si hay varios que contienen ese nombre, NO devolver el primero, avisar
  let coinc = keys.filter(k => normalizar(k).includes(nClave));
  if (coinc.length > 1) return 'MULTIPLE:' + coinc.join(' | ');
  if (coinc.length === 1) return coinc[0];
  return null;
}

function buscarEnCatalogo(clave) {
  let nClave = normalizar(clave);
  let exacto = CATALOGO.find(p => normalizar(p.nombre) === nClave);
  if (exacto) return exacto;
  let coinc = CATALOGO.filter(p => normalizar(p.nombre).includes(nClave));
  if (coinc.length === 1) return coinc[0];
  if (coinc.length > 1) return { multiple: coinc };
  return null;
}

function formatearInfo(txt) {
  // Respeta los saltos de línea que manda Yordan, no los borra
  let lineas = txt.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lineas.length <= 1) {
    lineas = txt.split(/\. +/).map(l => l.trim()).filter(l => l.length > 0);
  }
  return lineas.map(l => {
    l = l.replace(/^[✅✔️•\-\* ]+/, '').trim();
    if (l.length < 2) return null;
    if (!l.endsWith('.')) l += '.';
    return '✅ ' + l;
  }).filter(Boolean).join('\n');
}

// ===== BOT =====
async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }), printQRInTerminal: true });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (u) => {
    if (u.connection === 'close') {
      let reason = u.lastDisconnect?.error?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) start();
    }
    if (u.connection === 'open') console.log('KAIROS CONECTADO ✅');
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (let m of messages) {
      try {
        if (!m.message || m.key.fromMe) continue;
        let from = m.key.remoteJid;
        let rawText = m.message.conversation || m.message.extendedTextMessage?.text || '';
        if (!rawText) continue;
        let text = rawText.toLowerCase().trim();

        const send = async (t) => { await sock.sendMessage(from, { text: t }); };

        // ================= GRUPO DE DUDAS / INFO =================
        if (from === GRUPO_INFO) {
          // Ver lo que hay guardado
          if (text === 'lista info') {
            let lista = Object.keys(INFO_PRODUCTOS);
            if (!lista.length) { await send('No hay ninguna info guardada todavía.'); continue; }
            await send('INFO guardada:\n' + lista.map(k => '- ' + k).join('\n'));
            continue;
          }

          // Guardar info - lo puede hacer Yordan o tú
          if (text.startsWith('info ')) {
            let parte = rawText.replace(/^info\s+/i, '').trim();
            // Quita el "PRODUCTO:" que manda Yordan
            parte = parte.replace(/^producto\s*:\s*/i, '').trim();

            let prod = '';
            let txtInfo = '';

            if (parte.includes('//')) {
              let p = parte.split('//');
              prod = p[0].trim().toUpperCase();
              txtInfo = p.slice(1).join('//').trim();
            } else if (parte.toLowerCase().includes('caracteristicas:')) {
              let idxCar = parte.toLowerCase().indexOf('caracteristicas:');
              let antes = parte.substring(0, idxCar).trim();
              txtInfo = parte.substring(idxCar + 'caracteristicas:'.length).trim();
              if (antes.includes(' - ')) {
                prod = antes.split(' - ')[0].trim().toUpperCase();
                txtInfo = antes.split(' - ')[1].trim() + '\n' + txtInfo;
              } else prod = antes.trim().toUpperCase();
            } else if (parte.includes(':')) {
              let idx = parte.indexOf(':');
              prod = parte.substring(0, idx).trim().toUpperCase();
              txtInfo = parte.substring(idx + 1).trim();
            } else {
              await send('Para guardar pon: info Nombre // caracteristica');
              continue;
            }

            if (!prod || !txtInfo || prod === 'PRODUCTO') { await send('No entendí el nombre. Pon: info Arrocera Marwa // info'); continue; }

            // Guarda POR NOMBRE EXACTO, no por lugar
            INFO_PRODUCTOS[prod] = { texto: txtInfo, fuente: 'Admin en Dudas', fecha: new Date().toLocaleDateString('es-CU') };
            guardarTodo();
            await send('✅ Guardado INFO de ' + prod);

            // Si había un gestor esperando ESE nombre, se la mandamos
            if (PENDIENTES_INFO[prod]) {
              let g = PENDIENTES_INFO[prod];
              await sock.sendMessage(g, { text: `📦 *${prod} - KAIROS*\n\n${formatearInfo(txtInfo)}` });
              delete PENDIENTES_INFO[prod];
              guardarTodo();
              await send('Ya se la mandé al gestor que la pidió.');
            }
            continue;
          }

          // Si en el grupo piden info, también responde por nombre
          if (text.startsWith('info ')) continue;
          continue;
        }

        // ================= PRIVADO GESTOR =================
        // PEDIR INFO - POR NOMBRE, NO POR LUGAR
        if (text.startsWith('info ')) {
          let clave = rawText.replace(/^info\s+/i, '').trim();
          if (!clave) { await send('Escribe: info + nombre. Ej: info arrocera marwa'); continue; }

          let encontrado = buscarProducto(clave);

          if (encontrado && encontrado.startsWith('MULTIPLE:')) {
            await send('¿Cuál de estas quieres?\n' + encontrado.replace('MULTIPLE: ', '').split(' | ').map(s => '- ' + s).join('\n') + '\n\nEscribe: info + nombre completo. Ej: info arrocera marwa');
            continue;
          }

          if (encontrado && INFO_PRODUCTOS[encontrado]) {
            await send(`📦 *${encontrado} - KAIROS*\n\n${formatearInfo(INFO_PRODUCTOS[encontrado].texto)}`);
            continue;
          }

          // No la tiene, la pide al grupo por nombre exacto
          let claveUpper = clave.toUpperCase();
          // Evita pedir 2 veces lo mismo
          if (!PENDIENTES_INFO[claveUpper]) {
            PENDIENTES_INFO[claveUpper] = from;
            guardarTodo();
            await sock.sendMessage(GRUPO_INFO, { text: `❓ INFO PEDIDA\nProducto: ${claveUpper}\nGestor esperando...` });
          }
          await send('No la tengo, ya la pedí al grupo. Cuando Yordan la ponga te la mando.');
          continue;
        }

        // ===== CATALOGO =====
        if (text === 'catalogo' || text === 'catálogo' || text === 'menu' || text === 'menú') {
          let lista = CATALOGO.map((p, i) => `${i + 1}. ${p.nombre} - ${p.precioUSD} USD`).join('\n');
          await send('📦 *CATÁLOGO KAIROS - ALMACÉN 1*\n\n' + lista + '\n\nEscribe el nombre del producto para pedirlo. Ej: Arrocera Marwa');
          continue;
        }

        // ===== PEDIDO SIMPLE =====
        if (text === 'hola' || text === 'inicio' || text === 'empezar') {
          await send('Hola 👋 Soy KAIROS\n\nEscribe *catalogo* para ver productos\nEscribe *info + nombre* para ver detalles. Ej: info arrocera marwa');
          continue;
        }

        // Buscar producto en catálogo para pedido
        let prodCat = buscarEnCatalogo(rawText);
        if (prodCat && !prodCat.multiple) {
          let ped = { productos: [{ nombre: prodCat.nombre, precioUSD: prodCat.precioUSD, cant: 1, almacen: prodCat.almacen }], paso: 'datos' };
          PEDIDOS[from] = ped;
          let totalUSD = prodCat.precioUSD;
          let totalMN = Math.round(totalUSD * TASA_USD);
          await send(`RESUMEN\n\nProducto: ${prodCat.nombre} x1 = ${totalUSD} USD\nTotal: ${totalUSD} USD / ${totalMN} MN\n\n¿Recogida o Domicilio?\nEscribe: *LOCAL* o *DOMICILIO*`);
          continue;
        }
        if (prodCat && prodCat.multiple) {
          await send('¿Cuál quieres?\n' + prodCat.multiple.map(p => '- ' + p.nombre + ' - ' + p.precioUSD + ' USD').join('\n') + '\n\nEscribe el nombre completo.');
          continue;
        }

        // ===== FLUJO PEDIDO =====
        let ped = PEDIDOS[from];
        if (ped) {
          if (ped.paso === 'datos') {
            if (text === 'local' || text === 'recogida' || text === 'tienda') {
              ped.tipo = 'recogida';
              ped.almacen = ped.productos[0].almacen;
              ped.paso = 'pago';
              let totalUSD = ped.productos.reduce((s, p) => s + p.precioUSD * p.cant, 0);
              let totalMN = Math.round(totalUSD * TASA_USD);
              await send(`LOCAL de recogida - Almacén ${ped.almacen}:\n${DIRECCIONES[ped.almacen]}\n\nTotal: ${totalUSD} USD / ${totalMN} MN\n\n¿Cómo paga?\n*1* = USD\n*2* = EUR\n*3* = MN`);
              continue;
            }
            if (text === 'domicilio' || text === 'envio' || text === 'envío') {
              ped.tipo = 'domicilio';
              ped.paso = 'direccion';
              await send('Pásame la dirección completa de entrega.');
              continue;
            }
            await send('Escribe *LOCAL* o *DOMICILIO*');
            continue;
          }
          if (ped.paso === 'direccion') {
            ped.direccion = rawText;
            ped.paso = 'pago';
            let totalUSD = ped.productos.reduce((s, p) => s + p.precioUSD * p.cant, 0);
            let totalMN = Math.round(totalUSD * TASA_USD);
            await send(`Dirección: ${rawText}\nTotal: ${totalUSD} USD / ${totalMN} MN\n\n¿Cómo paga?\n*1* = USD\n*2* = EUR\n*3* = MN`);
            continue;
          }
          if (ped.paso === 'pago') {
            let metodo = text === '1' ? 'USD' : text === '2' ? 'EUR' : text === '3' ? 'MN' : '';
            if (!metodo) { await send('Escribe *1* = USD, *2* = EUR, *3* = MN'); continue; }
            ped.pago = metodo;
            ped.paso = 'cliente';
            await send('Ahora pásame: Nombre + Carnet + Teléfono. Ej: Juan Perez 12345678901 55555555');
            continue;
          }
          if (ped.paso === 'cliente') {
            ped.cliente = rawText;
            delete PEDIDOS[from];
            let totalUSD = ped.productos.reduce((s, p) => s + p.precioUSD * p.cant, 0);
            let totalMN = Math.round(totalUSD * TASA_USD);
            let totalEUR = Math.round(totalUSD * TASA_USD / TASA_EUR);
            await send(`✅ PEDIDO REGISTRADO\n\nCliente: ${ped.cliente}\nProducto: ${ped.productos.map(p => p.nombre).join(', ')}\nTipo: ${ped.tipo}\n${ped.tipo === 'recogida' ? 'Recoger en: ' + DIRECCIONES[ped.almacen] : 'Entregar en: ' + ped.direccion}\nPago: ${ped.pago}\nTotal: ${totalUSD} USD / ${totalEUR} EUR / ${totalMN} MN`);
            continue;
          }
        }

        // Si no entendió
        await send('No entendí. Escribe *catalogo* para ver productos o *info + nombre* para ver detalles.');

      } catch (e) {
        console.log('Error:', e);
      }
    }
  });
}

start();
