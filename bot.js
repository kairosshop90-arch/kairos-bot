const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', qr => { qrcode.generate(qr, { small: true }); });
client.on('ready', () => { console.log('BOT LISTO ✅'); });

client.on('message', async msg => {
  const text = msg.body.toLowerCase();
  const send = async (m) => { await client.sendMessage(msg.from, m); };

  if (text.includes('hola') || text.includes('menu') || text.includes('catalogo') || text === '1') {
    await send(`👑 *KAIROS SHOP* 👑\n\n✅ Pedestal 18" - *23 USD*\n✅ J10 Recargable - *40 USD*\n✅ F6 SACO - *35 USD*\n✅ Bee F6 - *32 USD* / Mayor: 30 USD\n✅ F39 Solar - *42 USD*\n✅ F22 SACO - *70 USD*\n\nNuevo en caja + Garantía 15 días\nMensajería en toda La Habana\n\n¿Cuál quieres? Escribe el modelo, ej: *J10*`);
    return;
  }

  if (text.includes('j10')) {
    await send(`✅ *J10 RECARGABLE - 40 USD*\nSolar + Bluetooth + Luz + Radio FM\nBatería 20.000 mAh, hasta 12h\n\n¿Te lo aparto? Escribe *SI + tu municipio*`);
    return;
  }

  if (text.includes('f39')) {
    await send(`✅ *F39 SOLAR - 42 USD*\nSolar + Bluetooth + Luz\n\n¿Te lo aparto? Escribe *SI + tu municipio*`);
    return;
  }

  if (text.includes('f22')) {
    await send(`✅ *F22 SACO - 70 USD*\n\n¿Te lo aparto? Escribe *SI + tu municipio*`);
    return;
  }

  if (text.includes('f6')) {
    await send(`✅ *F6 SACO - 35 USD*\n✅ Bee F6 - 32 USD / Mayor: 30 USD\n\n¿Te lo aparto? Escribe *SI + tu municipio*`);
    return;
  }

  if (text.includes('pedestal') || text.includes('18')) {
    await send(`✅ *Pedestal 18" - 23 USD*\n\n¿Te lo aparto? Escribe *SI + tu municipio*`);
    return;
  }

  if (text.includes('si')) {
    await send(`¡Perfecto! ✅ Te lo aparto.\nPásame tu nombre, teléfono y dirección exacta para la mensajería.`);
    return;
  }
});

client.initialize();
