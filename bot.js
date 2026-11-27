const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const http = require('http');

let ULTIMO_QR = null;

async function start() {
  console.log('Iniciando Baileys...');
  const { state, saveCreds } = await useMultiFileAuthState('sesion-prueba-qr');
  const sock = makeWASocket({ auth: state, printQRInTerminal: false });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (u) => {
    console.log('CONNECTION UPDATE:', JSON.stringify(u));
    if (u.qr) {
      ULTIMO_QR = u.qr;
      console.log('QR NUEVO GENERADO');
    }
    if (u.connection === 'open') console.log('CONECTADO OK');
  });
}

http.createServer(async (req, res) => {
  if (req.url === '/qr') {
    if (!ULTIMO_QR) return res.end('Aun no hay QR - espera 10 seg y recarga');
    const img = await QRCode.toDataURL(ULTIMO_QR);
    return res.end(`<img src="${img}" style="width:300px">`);
  }
  res.end('BOT PRUEBA OK - Ve a /qr');
}).listen(process.env.PORT || 10000, () => {
  console.log('Puerto abierto');
  start();
});
