const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const pino = require('pino')
const express = require('express')
const app = express()
const PORT = process.env.PORT || 3000
app.get('/', (req, res) => res.send('KAIROS SHOP BOT ONLINE 👑'))
app.listen(PORT, () => console.log('Server en puerto ' + PORT))

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('sesion-kairos')
    const sock = makeWASocket({ logger: pino({ level: 'silent' }), auth: state, printQRInTerminal: false })
    if (!sock.authState.creds.registered) {
        const code = await sock.requestPairingCode('15702171840')
        console.log('TU CODIGO ES: ' + code)
    }
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
            if (shouldReconnect) start()
        } else if (connection === 'open') {
            console.log('✅ BOT KAIROS SHOP CONECTADO 👑')
        }
    })
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0]
        if (!m.message || m.key.fromMe) return
        const from = m.key.remoteJid
        const text = (m.message.conversation || m.message.extendedTextMessage?.text || '').toLowerCase().trim()
        const send = (txt) => sock.sendMessage(from, { text: txt })
        if (['hola','hi','menu','inicio','kairos','buenas'].includes(text)) {
            await send(`👑 Hola, bienvenido a *KAIROS SHOP* 👑\nTodo para tu hogar, al mejor precio\n\n¿Qué quieres ver hoy?\n\n1️⃣ Ventiladores\n2️⃣ Cocina\n3️⃣ Transporte\n4️⃣ Hogar / Electro\n5️⃣ Energía\n6️⃣ Hablar con persona\n\nEscribe el número`)
            return
        }
        if (text.includes('ventilador') || text === '1') {
            await send(`💨 *VENTILADORES - KAIROS SHOP* 👑\n\n✅ Pared Freshcool - *28 USD* / Cant: 25 USD\n✅ Pedestal 18" - *23 USD*\n✅ J10 Recargable - *40 USD*\n✅ F6 SACO - *35 USD*\n✅ Bee F6 - *32 USD* / Mayor: 30 USD\n✅ F39 Solar - *42 USD*\n✅ F22 SACO - *70 USD*\n\nNuevo en caja + Garantía 15 días\nMensajería en toda La Habana\n\n¿Cuál quieres? Escribe el modelo, ej: *J10*`)
            return
        }
        if (text.includes('j10')) { await send(`✅ *J10 RECARGABLE - 40 USD*\nSolar + Bluetooth + Luz + Radio FM\nBatería 20.000 mAh, hasta 12h\n\n¿Te lo aparto? Escribe *SI + tu municipio*
