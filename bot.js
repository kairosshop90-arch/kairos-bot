const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const qrcode = require('qrcode');
const app = express();
let ultimoQR = '';
let sock;

const CATALOGO = { J10:{precio:10,nombre:'J10'}, J20:{precio:20,nombre:'J20'}, A1:{precio:15,nombre:'A1'} };
let TASA = { valor: 400 };
let PEDIDOS = [];
let CHAT = {}; // aqui guardamos en que paso va cada persona

async function send(to, text){ await sock.sendMessage(to, {text}); }

async function main(){
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  sock = makeWASocket({ auth: state, printQRInTerminal: true });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (u)=>{
    if(u.qr){ ultimoQR = await qrcode.toDataURL(u.qr); }
    if(u.connection === 'open') ultimoQR = '';
  });

  sock.ev.on('messages.upsert', async ({messages})=>{
    const m = messages[0];
    if(!m.message || m.key.fromMe) return;
    const from = m.key.remoteJid;
    const texto = m.message.conversation || m.message.extendedTextMessage?.text || '';
    const lower = texto.trim().toLowerCase();
    const enviar = (t)=> send(from, t);

    // CANCELAR
    if(lower === 'cancelar'){ delete CHAT[from]; await enviar('Pedido cancelado. Escribe menu para empezar de nuevo.'); return; }

    // MENU
    if(lower === 'menu' || lower === 'hola' || lower === 'ayuda'){
      await enviar(`🤖 KAIROS - MENÚ\n\n📦 Productos: J10, J20, A1\n\n1️⃣ Escribe *pedir* para hacer un pedido\n2️⃣ Escribe *tasa* para ver la tasa\n3️⃣ Escribe *cancelar* para cancelar`);
      return;
    }
    if(lower === 'tasa'){ await enviar(`💵 Tasa: ${TASA.valor} CUP\nTu cobro: ${TASA.valor + 10} CUP`); return; }

    // EMPEZAR PEDIDO
    if(lower === 'pedir' || lower === 'comprar' || lower === 'pedido'){
      CHAT[from] = { paso: 'producto', datos: {} };
      await enviar('Perfecto, vamos a hacer tu pedido paso a paso.\n\n¿Qué producto quieres?\n• J10\n• J20\n• A1\n\nEscribe solo el nombre, ej: J10');
      return;
    }

    // SI ESTA EN MEDIO DE UN PEDIDO, VA PREGUNTANDO
    if(CHAT[from]){
      let p = CHAT[from];
      if(p.paso === 'producto'){
        let prod = texto.trim().toUpperCase();
        if(!CATALOGO[prod]){ await enviar('Ese producto no existe. Escribe J10, J20 o A1'); return; }
        p.datos.producto = prod;
        p.paso = 'cantidad';
        await enviar(`Bueno, ${prod}. ¿Cuántos quieres?\nEscribe un número, ej: 1`);
        return;
      }
      if(p.paso === 'cantidad'){
        p.datos.cantidad = texto.trim();
        p.paso = 'nombre';
        await enviar('¿Tu nombre?');
        return;
      }
      if(p.paso === 'nombre'){
        p.datos.nombre = texto.trim();
        p.paso = 'telefono';
        await enviar('¿Tu teléfono?');
        return;
      }
      if(p.paso === 'telefono'){
        p.datos.telefono = texto.trim();
        p.paso = 'direccion';
        await enviar('¿Tu dirección? Ej: San Miguel');
        return;
      }
      if(p.paso === 'direccion'){
        p.datos.direccion = texto.trim();
        p.paso = 'envio';
        await enviar('¿Cómo lo quieres?\nEscribe: mensajeria o recoger');
        return;
      }
      if(p.paso === 'envio'){
        p.datos.envio = texto.trim();
        p.paso = 'pago';
        let totalUSD = CATALOGO[p.datos.producto].precio * parseInt(p.datos.cantidad);
        let totalCUP = totalUSD * (TASA.valor + 10);
        await enviar(`Resumen:\n${p.datos.producto} x${p.datos.cantidad} - ${p.datos.nombre} - ${p.datos.direccion} - ${p.datos.envio}\nTotal: ${totalUSD} USD / ${totalCUP} CUP\n\n¿Cómo vas a pagar?\nEscribe: pago USD o pago MN`);
        return;
      }
      if(p.paso === 'pago'){
        if(lower.includes('usd')) p.datos.pago = 'USD';
        else if(lower.includes('mn')) p.datos.pago = 'MN';
        else { await enviar('Escribe: pago USD o pago MN'); return; }
        PEDIDOS.push(p.datos);
        await enviar(`✅ PEDIDO CONFIRMADO\n${p.datos.producto} x${p.datos.cantidad} - ${p.datos.nombre}\nDir: ${p.datos.direccion} - ${p.datos.envio}\nPago: ${p.datos.pago}\n\nGracias por comprar en Kairos 🙏`);
        delete CHAT[from];
        return;
      }
    }
  });
}
main();
app.get('/', (req,res)=> res.send('Kairos bot activo'));
app.get('/qr', (req,res)=>{ if(!ultimoQR) return res.send('Ya estas conectado'); res.send(`<img src="${ultimoQR}" style="width:300px">`); });
app.listen(3000, ()=> console.log('listo'));
