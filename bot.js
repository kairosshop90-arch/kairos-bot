const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const fs = require('fs');
const pino = require('pino');
const express = require('express');

// ============ SERVIDOR PARA RENDER + QR ============
const app = express();
const PORT = process.env.PORT || 3000;
let ultimoQR = '';

app.get('/', (req, res) => res.send('Kairos bot activo'));

app.get('/qr', (req, res) => {
  if(!ultimoQR) return res.send('Ya estas conectado, no hay QR para escanear. Si quieres uno nuevo, borra la sesion en Render y vuelve a desplegar.');
  res.send(`<h2>Escanea este QR con WhatsApp</h2><img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ultimoQR)}">`);
});

app.listen(PORT, () => console.log('Puerto abierto en ' + PORT));

// ============ GUARDAR Y CARGAR ============
function cargar(nombre, defecto){
  try{ if(fs.existsSync(nombre+'.json')) return JSON.parse(fs.readFileSync(nombre+'.json','utf8')); }catch(e){}
  return defecto;
}
function guardar(nombre, datos){ fs.writeFileSync(nombre+'.json', JSON.stringify(datos, null, 2)); }

// ============ DATOS ============
let CATALOGO = cargar('catalogo', {
  'J20': { nombre: 'J20', precio: 45 },
  'J10': { nombre: 'J10', precio: 30 },
  'A1': { nombre: 'A1', precio: 25 }
});
let TASA = cargar('tasa', { valor: 915, actualizado: '' });
let SPAM_CONTADOR = cargar('spam_contador', {});
let BANEADOS = cargar('baneados', {});
let PEDIDOS = cargar('pedidos', []);
let DUDAS = cargar('dudas', {});
let PEDIDOS_PENDIENTES = {};
let GRUPOS_ESCUCHA = cargar('grupos_escucha', []);
let ADMIN_JID = 'TU_NUMERO@s.whatsapp.net';
let SEGUNDO_JID = 'SEGUNDO_NUMERO@s.whatsapp.net';

function esSpam(texto){
  if(!texto) return false;
  let t = texto.toLowerCase();
  return t.includes('http') || t.includes('www.') || t.includes('.com') || t.includes('t.me') || t.includes('instagram.com');
}

// ============ IR AL TOQUE CADA 30 MINUTOS ============
let sockGlobal = null;
async function actualizarTasaElToque(avisar){
  try{
    let tasaNueva = null;
    try{
      let res = await fetch('https://api.eltoque.com/v1/trmi', { headers: { 'User-Agent': 'Mozilla/5.0' } });
      let data = await res.json();
      let lista = data.trmi || data || [];
      if(Array.isArray(lista)){
        let usd = lista.find(x => (x.moneda || x.currency || '').toString().toUpperCase().includes('USD'));
        if(usd) tasaNueva = parseFloat(usd.tasa || usd.valor || usd.rate || usd.precio);
      }
      if(!tasaNueva && data.USD) tasaNueva = parseFloat(data.USD);
    }catch(e){}
    if(!tasaNueva){
      try{
        let res2 = await fetch('https://eltoque.com/', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        let html = await res2.text();
        let m = html.match(/USD[^0-9]{0,20}([0-9]{3,4}[.,][0-9]{2})/i);
        if(m) tasaNueva = parseFloat(m[1].replace(',','.'));
      }catch(e){}
    }
    if(tasaNueva && tasaNueva > 100 && tasaNueva < 2000){
      let vieja = TASA.valor;
      if(Math.abs(tasaNueva - vieja) >= 1){
        TASA.valor = Math.round(tasaNueva);
        TASA.actualizado = new Date().toLocaleString('es-CU');
        guardar('tasa', TASA);
        console.log(`TASA ACTUALIZADA TOQUE: ${vieja} -> ${TASA.valor}`);
        if(avisar && sockGlobal){
          try{ await sockGlobal.sendMessage(ADMIN_JID, { text: `💵 Tasa El Toque actualizada\nAntes: ${vieja} CUP\nAhora: ${TASA.valor} CUP\nTu cobro (Toque+10): ${TASA.valor + 10} CUP\nActualizado: ${TASA.actualizado}` }); }catch(e){}
        }
      }
      return TASA.valor;
    }
    return TASA.valor;
  }catch(e){
    console.log('Error buscando tasa El Toque: ' + e.message);
    return TASA.valor;
  }
}

async function main(){
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }) });
  sockGlobal = sock;
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (u) => {
    if(u.qr){
      ultimoQR = u.qr;
      console.log('Nuevo QR generado, ve a /qr');
    }
    if(u.connection === 'open'){
      ultimoQR = '';
      console.log('BOT CONECTADO');
      actualizarTasaElToque(false);
      setInterval(() => actualizarTasaElToque(true), 30 * 60 * 1000);
    }
    if(u.connection === 'close' && u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) main();
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if(!m.message || m.key.fromMe) return;
    const from = m.key.remoteJid;
    const remitente = m.key.participant || from;
    const pushName = m.pushName || 'Gestor';
    const textoOriginal = m.message.conversation || m.message.extendedTextMessage?.text || '';
    const text = textoOriginal.trim();
    const lower = text.toLowerCase();
    const esGrupo = from.endsWith('@g.us');
    const esAdmin = remitente === ADMIN_JID;
    const esSegundo = remitente === SEGUNDO_JID;

    async function send(msg){
      await sock.sendMessage(from, { text: msg, mentions: [remitente] });
    }

    if(lower === 'mi id'){
      await send(`Tu ID: ${remitente}\nGrupo ID: ${from}`);
      return;
    }

    if(lower.startsWith('tasa ') && (esAdmin || esSegundo)){
      let v = parseFloat(text.replace(/tasa /i,'').trim());
      if(v){ TASA.valor = v; TASA.actualizado = new Date().toLocaleString('es-CU'); guardar('tasa', TASA); await send(`✅ Tasa actualizada manual\nToque: ${v} CUP\nTu cobro (Toque+10): ${v+10} CUP`); }
      return;
    }
    if(lower === 'tasa'){
      await send(`Tasa Toque: ${TASA.valor} CUP\nTu cobro: ${TASA.valor+10} CUP\nActualizado: ${TASA.actualizado || 'pendiente'}\nEl bot revisa El Toque cada 30 min solo.\nPara cambiar manual: tasa 920`);
      return;
    }
    if(lower === 'actualizar tasa' && (esAdmin || esSegundo)){
      await send(`Buscando tasa en El Toque...`);
      let v = await actualizarTasaElToque(false);
      await send(`Tasa actual: ${v} CUP\nTu cobro: ${v+10} CUP`);
      return;
    }

    if(esGrupo){
      if(esSpam(textoOriginal) && !esAdmin && !esSegundo){
        try{ await sock.sendMessage(from, { delete: m.key }); }catch(e){}
        if(BANEADOS[remitente] && Date.now() < BANEADOS[remitente]) return;
        if(!SPAM_CONTADOR[remitente]) SPAM_CONTADOR[remitente] = 0;
        SPAM_CONTADOR[remitente]++;
        guardar('spam_contador', SPAM_CONTADOR);
        if(SPAM_CONTADOR[remitente] === 1){
          await send(`⚠️ @${remitente.split('@')[0]} No se permite links de otros negocios.\n1ra vez = Advertencia. 2da = Baneo 30 min. 3ra = Expulsado.`);
          return;
        }
        if(SPAM_CONTADOR[remitente] === 2){
          BANEADOS[remitente] = Date.now() + 30*60*1000;
          guardar('baneados', BANEADOS);
          await send(`🚫 @${remitente.split('@')[0]} BANEADO 30 MINUTOS por 2do link.\nTodo lo que mandes en estos 30 min se borra.`);
          return;
        }
        if(SPAM_CONTADOR[remitente] >= 3){
          SPAM_CONTADOR[remitente] = 0;
          delete BANEADOS[remitente];
          guardar('spam_contador', SPAM_CONTADOR);
          guardar('baneados', BANEADOS);
          try{ await sock.groupParticipantsUpdate(from, [remitente], 'remove'); }catch(e){}
          await send(`❌ @${remitente.split('@')[0]} EXPULSADO por 3er link de otro negocio.`);
          return;
        }
        return;
      }
      if(BANEADOS[remitente] && Date.now() < BANEADOS[remitente]){
        try{ await sock.sendMessage(from, { delete: m.key }); }catch(e){}
        return;
      }
      if(GRUPOS_ESCUCHA.includes(from) && !esAdmin && !esSegundo){
        if(!DUDAS[from]) DUDAS[from] = [];
        DUDAS[from].push({ pregunta: textoOriginal, quien: pushName, fecha: new Date().toLocaleString('es-CU') });
        guardar('dudas', DUDAS);
        await send(`✅ Duda guardada, ${pushName}. Louis la va a responder pronto.`);
        try{ await sock.sendMessage(ADMIN_JID, { text: `❓ Nueva duda de ${pushName} en ${from}:\n${textoOriginal}` }); }catch(e){}
        return;
      }
    }

    if(lower.startsWith('duda ')){
      let pregunta = text.slice(5).trim();
      if(!DUDAS[from]) DUDAS[from] = [];
      DUDAS[from].push({ pregunta, quien: pushName, fecha: new Date().toLocaleString('es-CU') });
      guardar('dudas', DUDAS);
      await send(`✅ Duda guardada\n"${pregunta}"\nLouis la va a responder pronto.`);
      return;
    }

    if(lower === 'pago usd' || lower === 'pago mn'){
      let p = PEDIDOS_PENDIENTES[from];
      if(!p){ await send(`No tienes pedido pendiente. Haz primero: pedido J20 x1 - Maria 56947882 - San Miguel - mensajeria`); return; }
      let forma = lower === 'pago usd' ? `USD ${p.precioUSD * p.cant}` : `MN ${p.precioMN * p.cant} CUP`;
      PEDIDOS.push({ ...p, pago: forma, fecha: new Date().toLocaleString('es-CU') });
      guardar('pedidos', PEDIDOS);
      delete PEDIDOS_PENDIENTES[from];
      await send(`✅ Pedido confirmado\n${p.clave} x${p.cant} - ${p.cliente}\nTel: ${p.telefono}\nDir: ${p.direccion} - ${p.envio}\nPago: ${forma}\n\n---\n❓ ¿Tienes alguna duda?\nEscribe: duda + tu pregunta\nEjemplo: duda ¿A qué hora llega la mensajería?`);
      return;
    }

    if(lower.startsWith('pedido ')){
      let resto = text.slice(7).trim();
      let partes = resto.split('-').map(s => s.trim());
      let primera = partes[0] || '';
      let clave = primera.split(' ')[0].toUpperCase();
      let cant = parseInt(primera.split('x')[1]) || 1;
      let cliente = partes[1] || pushName;
      let telefono = '';
      let mTel = cliente.match(/\d{8,}/);
      if(mTel) telefono = mTel[0];
      let direccion = partes[2] || '';
      let envio = partes[3] || 'mensajeria';
      if(!CATALOGO[clave]){ await send(`Ese producto no existe. Productos: ${Object.keys(CATALOGO).join(', ')}`); return; }
      let precioUSD = CATALOGO[clave].precio;
      let precioMN = precioUSD * (TASA.valor + 10);
      PEDIDOS_PENDIENTES[from] = { clave, cant, cliente, telefono, direccion, envio, precioUSD, precioMN };
      await send(`🛒 Pedido: ${clave} x${cant}\nCliente: ${cliente}\nDir: ${direccion} - ${envio}\n\n¿Cómo paga?\n1️⃣ USD: ${precioUSD * cant} USD\n2️⃣ MN: ${precioMN * cant} CUP (a ${TASA.valor + 10} = Toque ${TASA.valor} + 10)\n\nResponde: pago USD o pago MN`);
      return;
    }

    if(lower === 'ayuda' || lower === 'menu'){
      await send(`🤖 Comandos:\n- pedido J20 x1 - Maria 56947882 - San Miguel - mensajeria\n- pago USD / pago MN\n- duda + tu pregunta\n- tasa (ver tasa)\n- actualizar tasa\n- mi id`);
      return;
    }
  });
}

main();
