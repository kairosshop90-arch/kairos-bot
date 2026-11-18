const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

// ===== TUS DATOS =====
const LOUIS_JID = '5356947882@s.whatsapp.net'; // Tu numero 56947882
const LOUIS_LID = '132624865579031@lid';
const GRUPO_RECOGIDA = '120207345678901234@g.us'; // <-- PON ID DE GRUPO RECOGIDA
const GRUPO_MENSAJERIA = '120207345678901235@g.us'; // <-- PON ID DE GRUPO MENSAJERIA

// ===== PRODUCTOS =====
const PRODUCTOS = [
  { nombre: 'Panel Solar LONGi 635W', precioUSD: 150 },
  { nombre: 'Inversor 5KW', precioUSD: 400 },
  { nombre: 'Bateria Litio 5KW', precioUSD: 800 },
  { nombre: 'Panel Solar 550W', precioUSD: 120 },
];

// Tasas
const TASA_MN = 400; // 1 USD = 400 MN
const TASA_EUR = 0.92; // 1 USD = 0.92 EUR

// Direcciones de locales
const DIRECCIONES = {
  '1': 'Centro Habana - Calle Neptuno #123',
  '2': 'Vedado - Calle 23 #456',
  '3': 'Marianao - Ave 51 #789',
};

// Mensajeria por zona
function costoMensajeria(zona) {
  zona = zona.toLowerCase();
  if (zona.includes('centro') || zona.includes('vedado') || zona.includes('plaza')) return { costo: 500, detalle: 'Zona Centro - 500 MN' };
  if (zona.includes('playa') || zona.includes('marianao') || zona.includes('lisa')) return { costo: 800, detalle: 'Zona Lejos - 800 MN' };
  return { costo: 700, detalle: 'Zona ' + zona + ' - 700 MN' };
}

const GESTORES = {}; // from -> nombre
const PEDIDOS = {}; // from -> pedido en curso
const VALES = {}; // numero -> vale
let CONTADOR = 1;

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_kairos');
  const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }) });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect } = u;
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) start();
    }
    if (connection === 'open') console.log('KAIROS CONECTADO ✅');
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;
    const from = m.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const rawText = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim();
    const text = rawText.toLowerCase();
    const isLouis = from === LOUIS_JID || from === LOUIS_LID;
    const send = (t) => sock.sendMessage(from, { text: t });

    // ===== LOUIS CONFIRMA =====
    if (isLouis && text.includes('confirmado')) {
      const mc = rawText.match(/kairos[-\s]?(\d+)/i);
      if (mc) {
        const num = parseInt(mc[1]);
        const vale = VALES[num];
        if (!vale) { await send('Ese vale no existe.'); return; }
        vale.estado = 'confirmado'; delete VALES[num];
        let soloNombre = vale.cliente.replace(/\d+/g, '').trim();
        let textoGrupo = 'VALE KAIROS-' + String(num).padStart(3, '0') + ' ✅ CONFIRMADO\n\n';
        textoGrupo += 'Nombre: ' + soloNombre + '\n';
        if (vale.tipo === 'recogida') {
          textoGrupo += 'RECOGIDA en Local - Almacen ' + vale.almacen + ':\n' + DIRECCIONES[vale.almacen] + '\n';
          textoGrupo += 'Productos:\n' + vale.productos.map(p => '- ' + p.nombre + ' x' + p.cant).join('\n');
          textoGrupo += '\n\nPAGA EN: ' + vale.formaPago + ' - ' + vale.totalPagar;
          textoGrupo += '\nGestor: ' + vale.nombreGestor;
          await sock.sendMessage(GRUPO_RECOGIDA, { text: textoGrupo });
          await sock.sendMessage(vale.gestor, { text: '✅ Tu vale KAIROS-' + String(num).padStart(3, '0') + ' esta CONFIRMADO.\nEl cliente recoge en: ' + DIRECCIONES[vale.almacen] });
        } else {
          textoGrupo += 'Telefono: ' + vale.telefono + '\n';
          textoGrupo += 'MENSAJERIA\nDireccion: ' + vale.direccion + '\nZona: ' + (vale.zona || '') + '\n';
          textoGrupo += 'Productos:\n' + vale.productos.map(p => '- ' + p.nombre + ' x' + p.cant).join('\n');
          textoGrupo += '\n\nMENSAJERIA:\n' + (vale.detalleMensajeria || '') + '\nTotal Mensajeria: ' + vale.costoMensajeria + ' MN';
          textoGrupo += '\n\nPAGA EN: ' + vale.formaPago + ' - ' + vale.totalPagar;
          textoGrupo += '\nGestor: ' + vale.nombreGestor;
          await sock.sendMessage(GRUPO_MENSAJERIA, { text: textoGrupo });
          await sock.sendMessage(vale.gestor, { text: '✅ Tu vale KAIROS-' + String(num).padStart(3, '0') + ' esta CONFIRMADO.\nMensajeria: ' + vale.costoMensajeria + ' MN a ' + vale.direccion });
        }
        await send('Vale KAIROS-' + String(num).padStart(3, '0') + ' confirmado y enviado al grupo de ' + vale.tipo + '.');
        return;
      }
    }

    if (isGroup) return;
    if (isLouis) return;

    let ped = PEDIDOS[from];

    // ===== BIENVENIDA =====
    if (!GESTORES[from] && !ped) {
      PEDIDOS[from] = { paso: 'nombre_gestor', productos: [] };
      await send('🙏 Bendecido día para ti, comercial de Kairos ✨\n¿Cómo se llama? 😊');
      return;
    }
    if (ped && ped.paso === 'nombre_gestor') {
      const nombreGestor = rawText.trim();
      GESTORES[from] = nombreGestor;
      delete PEDIDOS[from];
      await send('🙏 Bendecido día para ti también, *' + nombreGestor + '* ✨\n\nYa te guardé, comercial de Kairos ✅\n\nPara empezar a vender, escribe:\n📦 *CATALOGO*');
      return;
    }
    if (GESTORES[from] && (text === 'hola' || text === 'buenas' || text === 'buenos dias')) {
      await send('🙏 Bendecido día para ti, *' + GESTORES[from] + '*, comercial de Kairos ✨\n\n¿Vamos a hacer un pedido? 😊\nEscribe 📦 *CATALOGO*');
      return;
    }

    // ===== CATALOGO =====
    if (text === 'catalogo') {
      let msg = '📦 *CATALOGO KAIROS* ✨\n\n';
      PRODUCTOS.forEach((p, i) => { msg += '*' + (i + 1) + '.* ' + p.nombre + '\n   💲 ' + p.precioUSD + ' USD\n'; });
      msg += '\nCuando quieras pedir, escribe:\n👉 *PEDIDO*';
      await send(msg);
      return;
    }

    // ===== PEDIDO =====
    if (text === 'pedido') {
      PEDIDOS[from] = { paso: 'elegir', productos: [] };
      await send('🙏 Perfecto, comercial de Kairos ✨\n\n¿Qué quieres pedir?\n\nPuedes poner el *número* del producto o el *nombre completo*\n\nEj: *1* o *Panel Solar LONGi 635W*');
      return;
    }

    if (!ped) {
      await send('🙏 Bendecido día, *' + (GESTORES[from] || '') + ' ✨\nEscribe 📦 *CATALOGO* para ver los productos.');
      return;
    }

    // ===== ELEGIR =====
    if (ped.paso === 'elegir') {
      let prod = null;
      if (/^\d+$/.test(rawText.trim())) {
        let idx = parseInt(rawText.trim()) - 1;
        if (PRODUCTOS[idx]) prod = PRODUCTOS[idx];
      } else {
        prod = PRODUCTOS.find(p => p.nombre.toLowerCase() === rawText.toLowerCase())
          || PRODUCTOS.find(p => p.nombre.toLowerCase().includes(rawText.toLowerCase()))
          || PRODUCTOS.find(p => rawText.toLowerCase().includes(p.nombre.toLowerCase().split(' ')[0].toLowerCase()));
      }
      if (!prod) { await send('No encontré ese producto 😅\nRevisa el catálogo y pon el *número* o el *nombre completo*\nEj: *1*'); return; }
      ped.productoActual = prod;
      ped.paso = 'cantidad';
      await send('✅ *' + prod.nombre + '*\n💲 ' + prod.precioUSD + ' USD\n\n¿Cuántos quieres?');
      return;
    }

    // ===== CANTIDAD =====
    if (ped.paso === 'cantidad') {
      const cant = parseInt(rawText);
      if (!cant || cant <= 0) { await send('Pon un número válido, ej: 2'); return; }
      ped.productos.push({ ...ped.productoActual, cant });
      ped.paso = 'otro';
      await send('Agregado ✅ ' + ped.productoActual.nombre + ' x' + cant + '\n\n¿Quieres agregar otro producto?\nEscribe *SI* y el nombre o número, o *NO* para seguir.');
      return;
    }

    // ===== OTRO =====
    if (ped.paso === 'otro') {
      if (text === 'no') {
        ped.paso = 'datos';
        await send('Perfecto.\n\nAhora dime los datos del cliente:\n*Nombre Apellido Carnet*\nEj: Juan Perez 12345678901');
        return;
      }
      if (text === 'si') {
        ped.paso = 'elegir';
        await send('Dime qué otro producto quieres, por número o nombre:');
        return;
      }
      // Si pone directo otro producto
      ped.paso = 'elegir';
      // Re-procesar como elegir
      let prod = null;
      if (/^\d+$/.test(rawText.trim())) {
        let idx = parseInt(rawText.trim()) - 1;
        if (PRODUCTOS[idx]) prod = PRODUCTOS[idx];
      } else {
        prod = PRODUCTOS.find(p => p.nombre.toLowerCase().includes(rawText.toLowerCase()));
      }
      if (prod) {
        ped.productoActual = prod; ped.paso = 'cantidad';
        await send('✅ *' + prod.nombre + '*\n¿Cuántos quieres?');
      } else {
        await send('No entendí. Escribe *SI* o *NO*');
        ped.paso = 'otro';
      }
      return;
    }

    // ===== DATOS =====
    if (ped.paso === 'datos') {
      ped.cliente = rawText;
      ped.paso = 'telefono';
      await send('Ya tengo el nombre y carnet.\n\nAhora dime el *numero de telefono del cliente*\nEj: 5356947882');
      return;
    }

    // ===== TELEFONO =====
    if (ped.paso === 'telefono') {
      ped.telefono = rawText.replace(/[^0-9]/g, '');
      ped.paso = 'tipo';
      await send('Perfecto.\n\n¿Cómo lo quiere el cliente?\n\nEscribe:\n🚚 *MENSAJERIA* - se lo llevamos a su casa\n🏪 *LOCAL* - lo recoge en el local');
      return;
    }

    // ===== TIPO =====
    if (ped.paso === 'tipo') {
      if (text.includes('local')) {
        ped.tipo = 'recogida'; ped.paso = 'almacen';
        await send('¿En qué almacén recoge?\n\n1 - Centro Habana\n2 - Vedado\n3 - Marianao\n\nEscribe el número: 1, 2 o 3');
        return;
      }
      if (text.includes('mensajeria') || text.includes('mensaje')) {
        ped.tipo = 'mensajeria'; ped.paso = 'direccion';
        await send('Dime la *dirección completa* del cliente:');
        return;
      }
      await send('Escribe *MENSAJERIA* o *LOCAL*');
      return;
    }

    // ===== ALMACEN =====
    if (ped.paso === 'almacen') {
      if (!DIRECCIONES[rawText.trim()]) { await send('Pon 1, 2 o 3'); return; }
      ped.almacen = rawText.trim();
      ped.paso = 'pago';
      let totalUSD = ped.productos.reduce((s, p) => s + p.precioUSD * p.cant, 0);
      await send('Total sin mensajería: ' + totalUSD + ' USD\n\n¿Cómo paga el cliente?\n\n1 - USD\n2 - MN\n3 - EUR\n\nEscribe 1, 2 o 3');
      return;
    }

    // ===== DIRECCION =====
    if (ped.paso === 'direccion') {
      ped.direccion = rawText;
      ped.paso = 'zona';
      await send('¿En qué zona es?\nEj: Vedado, Centro Habana, Playa, Marianao...');
      return;
    }

    // ===== ZONA =====
    if (ped.paso === 'zona') {
      ped.zona = rawText;
      const cm = costoMensajeria(rawText);
      ped.costoMensajeria = cm.costo;
      ped.detalleMensajeria = cm.detalle;
      ped.paso = 'pago';
      let totalUSD = ped.productos.reduce((s, p) => s + p.precioUSD * p.cant, 0);
      await send('🚚 Mensajería: ' + cm.detalle + '\nTotal productos: ' + totalUSD + ' USD\n\n¿Cómo paga el cliente?\n\n1 - USD\n2 - MN\n3 - EUR\n\nEscribe 1, 2 o 3');
      return;
    }

    // ===== PAGO =====
    if (ped.paso === 'pago') {
      let totalUSD = ped.productos.reduce((s, p) => s + p.precioUSD * p.cant, 0);
      let forma = '', totalPagar = '';
      if (rawText === '1') { forma = 'USD'; totalPagar = totalUSD + ' USD'; }
      else if (rawText === '2') { forma = 'MN'; totalPagar = (totalUSD * TASA_MN + (ped.costoMensajeria || 0)) + ' MN'; }
      else if (rawText === '3') { forma = 'EUR'; totalPagar = (totalUSD * TASA_EUR).toFixed(2) + ' EUR'; }
      else { await send('Pon 1, 2 o 3'); return; }

      const vale = {
        numero: CONTADOR, gestor: from, nombreGestor: GESTORES[from] || from,
        cliente: ped.cliente, telefono: ped.telefono, productos: ped.productos,
        tipo: ped.tipo, direccion: ped.direccion || '', almacen: ped.almacen || '',
        costoMensajeria: ped.costoMensajeria || 0, detalleMensajeria: ped.detalleMensajeria || '',
        zona: ped.zona || '', formaPago: forma, totalPagar, totalUSD
      };
      VALES[CONTADOR] = vale;

      let tv = 'VALE KAIROS-' + String(CONTADOR).padStart(3, '0') + ' (PENDIENTE)\n\n';
      tv += 'Gestor: ' + vale.nombreGestor + '\n';
      tv += 'Nombre: ' + vale.cliente + '\n';
      tv += 'Telefono: ' + vale.telefono + '\n';
      if (vale.tipo === 'recogida') tv += 'RECOGIDA - Almacen ' + vale.almacen + ': ' + DIRECCIONES[vale.almacen] + '\n';
      else tv += 'MENSAJERIA - Direccion: ' + vale.direccion + ' - Zona: ' + vale.zona + ' - Mensajeria: ' + vale.costoMensajeria + ' MN\n';
      tv += 'Productos:\n' + vale.productos.map(p => '- ' + p.nombre + ' x' + p.cant + ' = ' + (p.precioUSD * p.cant) + ' USD').join('\n');
      tv += '\n\nPAGA EN: ' + forma + ' - ' + totalPagar;
      tv += '\n\nLouis pon: Confirmado kairos-' + String(CONTADOR).padStart(3, '0');

      await sock.sendMessage(LOUIS_JID, { text: tv });
      await sock.sendMessage(LOUIS_LID, { text: tv });
      await send('✅ Vale KAIROS-' + String(CONTADOR).padStart(3, '0') + ' enviado a Louis para confirmar.\nTe aviso cuando lo confirme.');
      CONTADOR++;
      delete PEDIDOS[from];
      return;
    }
  });
}
start();
