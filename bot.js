const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('KAIROS BOT ACTIVO ✅'));
app.listen(process.env.PORT || 3000);

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({ logger: pino({ level: 'silent' }), printQRInTerminal: true, auth: state });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect } = u;
    if (connection === 'open') console.log('BOT LISTO ✅');
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
