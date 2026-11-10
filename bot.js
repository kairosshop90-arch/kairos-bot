const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('KAIROS BOT ACTIVO ✅'));
app.listen(process.env.PORT || 3000);

async function start() {
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({ version, logger: pino({ level: 'silent' }), auth: state, browser: ["Kairos Bot", "Chrome", "1.0"] });
  sock.ev.on('creds.update', saveCreds);

  let codigoPedido = false;

  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect } = u;
    console.log('Estado conexion:', connection);

    // Cuando ya está conectando, pedimos el código UNA sola vez
    if (connection === 'connecting' && !sock.authState.creds.registered && !codigoPedido) {
      codigoPedido = true;
      // Esperamos 5 segundos a que abra el socket
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode('15702171840');
          console.log('====================================');
          console.log('CODIGO BUENO USA ESTE: ' + code);
          console.log('TIENES 30 SEGUNDOS PARA PONERLO');
          console.log('====================================');
        } catch (e) {
          console.log('Fallo codigo, reintentando...', e.message);
          codigoPedido = false; // para que lo intente de nuevo
        }
      }, 5000);
    }

    if (connection === 'open') console.log('BOT LISTO ✅ CONECTADO');
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) start();
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;
    const text = (m.message.conversation || m.message.extendedTextMessage?.text || '').toLowerCase();
    const from = m.key.remoteJid;
    const send = async (t) => { await sock.sendMessage(from, { text: t }); };

    if (text.includes('hola') || text.includes('menu') || text.includes('catalogo') || text === '1') {
      await send(`👑 *KAIROS SHOP* 👑\n\n✅ Pedestal 18" - *23 USD*\n✅ J10 Recargable - *40 USD*\n✅ F6 SACO - *35 USD*\n✅ Bee F6 - *32 USD* / Mayor: 30 USD\n✅ F39 Solar - *42 USD*\n✅ F22 SACO - *70 USD*\n\nNuevo en caja + Garantía 15 días\nMensajería en toda La Habana\n\n¿Cuál quieres? Escribe el modelo, ej: *J10*`);
      return;
    }
    if (text.includes('j10')) { await send(`✅ *J10 RECARGABLE - 40 USD*\nSolar + Bluetooth + Luz + Radio FM\nBatería 20.000 mAh, hasta 12h\n\n¿Te lo aparto? Escribe *SI + tu municipio*`); return; }
    if (text.includes('f39')) { await send(`✅ *F39 SOLAR - 42 USD*\nSolar + Bluetooth + Luz\n\n¿Te lo aparto? Escribe *SI + tu municipio*`); return; }
    if (text.includes('f22')) { await send(`✅ *F22 SACO - 70 USD*\n\n¿Te lo aparto? Escribe *SI + tu municipio*`); return; }
    if (text.includes('f6')) { await send(`✅ *F6 SACO - 35 USD*\n✅ Bee F6 - 32 USD / Mayor: 30 USD\n\n¿Te lo aparto? Escribe *SI + tu municipio*`); return; }
    if (text.includes('pedestal') || text.includes('18')) { await send(`✅ *Pedestal 18" - 23 USD*\n\n¿Te lo aparto? Escribe *SI + tu municipio*`); return; }
    if (text.includes('si')) { await send(`¡Perfecto! ✅ Te lo aparto.\nPásame tu nombre, teléfono y dirección exacta para la mensajería.`); return; }
  });
}
start();
