const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs');
const app = express();
let ultimoQR = ""; let estado = 'Iniciando...'; let CODIGO_EMPAREJAR = "";
app.get('/', (req, res) => res.send('KAIROS BOT ACTIVO 👑'));
app.get('/qr', async (req, res) => {
  let html = `<h1>KAIROS BOT 👑</h1><p>${estado}</p>`;
  if (CODIGO_EMPAREJAR) html += `<h1 style="font-size:50px">CODIGO: ${CODIGO_EMPAREJAR}</h1><p>WhatsApp > Ajustes > Dispositivos vinculados > Vincular con numero de telefono > Pon este codigo</p><hr>`;
  if (ultimoQR) {
    const img = await QRCode.toDataURL(ultimoQR);
    html += `<h2>O ESCANEA ESTE QR:</h2><img src="${img}">`;
  }
  if (!CODIGO_EMPAREJAR && !ultimoQR) html += `<p>Esperando QR o codigo...</p>`;
  res.send(html);
});
app.listen(process.env.PORT || 3000);
let TASA_SITIO = 915; let TASA_MN = 925; let MODO = "auto";
let sockGlobal = null;
if (!fs.existsSync('data')) fs.mkdirSync('data');
function cargar(n,d){ try{ return JSON.parse(fs.readFileSync(`data/${n}.json`,'utf8')); }catch{ return d; } }
function guardar(n,d){ fs.writeFileSync(`data/${n}.json`, JSON.stringify(d,null,2)); }
let CONTADOR_VALE = cargar('contador',1);
let comisiones = cargar('comisiones',{});
let VALES = cargar('vales',{});
let CLIENTES = cargar('clientes',{});
let LISTA_ESPERA = cargar('lista_espera',[]);
let ADMIN_LIDS = cargar('admin_lids',[]);
let SEGUNDO_LIDS = cargar('segundo_lids',[]);
let GESTORES = cargar('gestores',{});
let COLA_NOCHE = cargar('cola_noche',[]);
let DUDAS_BASE = cargar('dudas_base', []);
let GRUPOS_ESCUCHA = cargar('grupos_escucha', []);
let OFERTAS_GUARDADAS = cargar('ofertas_guardadas', []);
let ULTIMOS_PEDIDOS = {};
let ENTREGAS_PENDIENTES = cargar('entregas_pendientes', {});
const ADMIN_NUMERO = "5356947882@s.whatsapp.net";
const SEGUNDO_JEFE_NUMERO = "5351126531@s.whatsapp.net";
const GRUPO_LOCAL = "PON_AQUI_ID_GRUPO_LOCAL";
const GRUPO_MENSAJERIA = "PON_AQUI_ID_GRUPO_MENSAJERIA";
const GRUPO_ALMACEN = "PON_AQUI_ID_GRUPO_ALMACEN";
const GRUPO_DISPONIBLES = "PON_AQUI_ID_GRUPO_PRODUCTOS_DISPONIBLES";
const GRUPO_CLIENTES_LINK = "PON_AQUI_LINK_GRUPO_CLIENTES";
const GRUPO_CLIENTES_ID = "PON_AQUI_ID_GRUPO_CLIENTES";
const FB_PAGE_ID = "PON_TU_PAGE_ID_AQUI";
const FB_PAGE_TOKEN = "PON_TU_PAGE_ACCESS_TOKEN_AQUI";
function grupoParaVale(v){ if(v.tipo_entrega==='recogida') return GRUPO_LOCAL; return GRUPO_MENSAJERIA; }
function fechaCuba(){ return new Date(new Date().toLocaleString('en-US',{timeZone:'America/Havana'})); }
function hoyCuba(){ return fechaCuba().toLocaleDateString('en-CA',{timeZone:'America/Havana'}); }
function horaCubaNum(){ return fechaCuba().getHours(); }
function normalizarNum(s){ return (s||'').replace(/[^0-9]/g,''); }
function esDeNoche(){ let h=horaCubaNum(); return h>=17 || h<8; }
function esHorario(){ let h=horaCubaNum(); return h>=8 && h<17; }
function sacarNumeroCliente(texto){ let m = (texto||'').match(/(53)?(\d{8})/); if(!m) return null; return '53' + m[2]; }
function limpiarNombreCliente(texto){ return (texto||'').replace(/(53)?\d{8}/g,'').replace(/\s+/g,' ').trim(); }

// ===== ALMACEN =====
let DIRECCION_ALMACEN = cargar('almacenes_direcciones',{'A1':'Calle 1ra #23306 / 4ta y 6ta. Altura del Mirador del Diezmero','A2':'Calle 2da / E y D, Reparto Luyano Moderno, La Corea, #18532, San Miguel del Padrón','A3':'PONER DIRECCION DE A3 AQUI'});
let PRODUCTO_ALMACEN = cargar('producto_almacen',{'J10':'A2','F39':'A1','F6':'A3'});
let ALMACEN = cargar('almacen', {});
function stockTotal(c){ if(!ALMACEN[c]) return 0; if(typeof ALMACEN[c]==='number') return ALMACEN[c]; return (ALMACEN[c].A1||0)+(ALMACEN[c].A2||0)+(ALMACEN[c].A3||0); }
function descontarStock(clave,cant){ if(typeof ALMACEN[clave]==='number'){ ALMACEN[clave]=Math.max(0,ALMACEN[clave]-cant); return; } let queda=cant; for(let alm of ['A1','A2','A3']){ if(queda<=0) break; let disp=ALMACEN[clave][alm]||0; let quitar=Math.min(disp,queda); ALMACEN[clave][alm]=disp-quitar; queda-=quitar; } }
function devolverStock(clave,cant,almacen){ if(typeof ALMACEN[clave]==='number'){ ALMACEN[clave]+=cant; return; } if(!ALMACEN[clave][almacen]) ALMACEN[clave][almacen]=0; ALMACEN[clave][almacen]+=cant; }

// ===== CATALOGO CON MARCAS =====
let CATALOGO = cargar('catalogo', {
  "J10":{nombre:"J10 Recargable",precio:40,desc:"Solar + Bluetooth + Luz + Radio FM"},
  "F39":{nombre:"F39 Solar",precio:42,desc:"Solar + Bluetooth + Luz"},
  "F22":{nombre:"F22 SACO",precio:70,desc:"SACO Grande"},
  "F6":{nombre:"F6 SACO",precio:35,desc:"SACO - Bluetooth + Luz"},
  "BEE F6":{nombre:"Bee F6",precio:32,desc:"Bee F6"},
  "PEDESTAL":{nombre:'Pedestal 18"',precio:23,desc:'Ventilador Pedestal'},
  "NEVERA":{nombre:"Nevera",precio:0,desc:"Nevera"},
  "TV":{nombre:"TV",precio:0,desc:"TV"},
  "COLCHON":{nombre:"Colchón",precio:0,desc:"Colchón"},
  "REINA":{nombre:"Reina",precio:0,desc:"Reina"},
  "ARROCERA":{nombre:"Arrocera",precio:0,desc:"Arrocera"},
  "INFRARROJO":{nombre:"Infrarrojo",precio:0,desc:"Cocina Infrarrojo"},
  "VENTILADOR":{nombre:"Ventilador",precio:0,desc:"Ventilador"},
  "FREIDORA":{nombre:"Freidora de Aire",precio:0,desc:"Freidora"},
  "BATIDORA":{nombre:"Batidora",precio:0,desc:"Batidora"},
  "CAFETERA":{nombre:"Cafetera",precio:0,desc:"Cafetera"},
  "COCINA ELECTRICA":{nombre:"Cocina Eléctrica",precio:0,desc:"Cocina Eléctrica"},
  "BOCINA":{nombre:"Bocina",precio:0,desc:"Bocina"},
  "SARTEN":{nombre:"Sartén Inducción",precio:0,desc:"Sartén"},
  "CUCHILLOS":{nombre:"Juego Cuchillos",precio:0,desc:"Juego Cuchillos"},
  "FOGON":{nombre:"Fogón Petróleo",precio:0,desc:"Fogón"},
  "LAVADORA":{nombre:"Lavadora",precio:0,desc:"Lavadora"},
  "OLLA PRESION":{nombre:"Olla Presión",precio:0,desc:"Olla Presión"},
  "ARROCERA ESTELECTRIC":{nombre:"Arrocera Estelectric",precio:0,desc:"Arrocera Estelectric"},
  "ARROCERA MARWA":{nombre:"Arrocera Marwa",precio:0,desc:"Arrocera Marwa"},
  "BATIDORA DESMATT":{nombre:"Batidora Desmatt",precio:0,desc:"Batidora Desmatt"},
  "BATIDORA ROCA ROJA":{nombre:"Batidora Roca Roja",precio:0,desc:"Batidora Roca Roja"},
  "BICICLETA 12":{nombre:"Bicicleta 12",precio:0,desc:"Bicicleta 12"},
  "BICICLETA 20":{nombre:"Bicicleta 20",precio:0,desc:"Bicicleta 20"},
  "BOCINA CHIQUITA":{nombre:"Bocina Chiquita 10 USD",precio:10,desc:"Bocina Chiquita"},
  "BOCINA GRANDE":{nombre:"Bocina Grande",precio:0,desc:"Bocina Grande"},
  "REINA MILEXUS":{nombre:"Reina Milexus",precio:0,desc:"Reina Milexus"},
  "REINA SACO":{nombre:"Reina Saco",precio:0,desc:"Reina Saco"},
  "REINA WELL":{nombre:"Reina Well",precio:0,desc:"Reina Well"},
  "VENTILADOR PARED FRESHCOOL":{nombre:"Ventilador Pared Freshcool",precio:0,desc:"Ventilador Pared"},
  "VENTILADOR CLOUD":{nombre:"Ventilador Recargable Pedestal Cloud",precio:0,desc:"Ventilador Cloud"},
  "VENTILADOR J10":{nombre:"Ventilador Recargable J10",precio:40,desc:"Ventilador J10"},
  "VENTILADOR F6":{nombre:"Ventilador Recargable F6",precio:35,desc:"Ventilador F6"},
  "VENTILADOR AIRLENTIS":{nombre:"Ventilador Airlentis 200000mah",precio:0,desc:"Ventilador Airlentis"},
  "VENTILADOR SOLAR FAN":{nombre:"Ventilador Solar Fan 20000mah",precio:0,desc:"Ventilador Solar Fan"},
  "COCINA PREMIER 1H":{nombre:"Cocina Electrica 1h Premier",precio:0,desc:"Cocina Premier"},
  "COCINA MARWA":{nombre:"Cocina Infrarrojo Marwa",precio:0,desc:"Cocina Marwa"},
  "COCINA INDUCCION SENCILLA":{nombre:"Cocina Induccion Sencilla",precio:0,desc:"Cocina Induccion Sencilla"},
  "COCINA INDUCCION DOBLE":{nombre:"Cocina Induccion Doble",precio:0,desc:"Cocina Induccion Doble"},
  "COCINA GAS EKO":{nombre:"Cocina Gas 1h Eko",precio:0,desc:"Cocina Gas Eko"}
});
function guardarCatalogo(){ guardar('catalogo', CATALOGO); }

const COMISIONES_OFICIALES = {
  1200: ["REINA","ARROCERA","INFRARROJO","VENTILADOR","FREIDORA","OLLA PRESION","BATIDORA","CAFETERA"],
  1000: ["COCINA ELECTRICA","BOCINA","SARTEN","J10","F39","F22","F6","BEE F6"],
  700: ["FREGADERO"],
  500: ["CUCHILLOS","FOGON"],
  2500: ["LAVADORA","NEVERA"],
  2000: ["COLCHON","TV"],
  1500: ["ESTANTE","CALENTADOR","CAJA FUERTE"]
};
function comisionPorClave(clave){ let c=(clave||'').toUpperCase().trim(); for(let monto in COMISIONES_OFICIALES){ if(COMISIONES_OFICIALES[monto].includes(c)) return parseInt(monto); }
  // Si es variante con marca, buscar por base
  for(let monto in COMISIONES_OFICIALES){ for(let base of COMISIONES_OFICIALES[monto]){ if(c.startsWith(base)) return parseInt(monto); } }
  return 1000;
}
function sumarComision(nc, productos){ if(!comisiones[nc]) comisiones[nc]={ventas:0,total:0,pagado:0}; let monto=0; for(let p of productos) monto+=comisionPorClave(p.clave)*p.cant; let tot=productos.reduce((s,p)=>s+p.cant,0); comisiones[nc].ventas+=tot; comisiones[nc].total+=monto; guardar('comisiones',comisiones); return monto; }

// ===== BUSCAR PRODUCTO CON MARCAS - APRENDE SOLO =====
function buscarProducto(texto){
  let t = (texto||'').toUpperCase();
  t = t.replace(/LLEG[ÓO]|LLEGO|ENTRADA|ENTRÓ|ENTRO|NUEVO PRODUCTO|PEDIDO/g,'').trim();
  t = t.replace(/\s+\d+\s*$/,'').replace(/X\d+/g,'').trim();
  if(CATALOGO[t]) return t;
  let marcas = ["ESTELECTRIC","MARWA","DESMATT","ROCA ROJA","MILEXUS","SACO","WELL","FRESHCOOL","CLOUD","AIRLENTIS","SOLAR FAN","PREMIER","EKO","COFIX","DEICHA","MAF","GYNIPOT","JMD","KVITOVA","ROYAL","EON"];
  let base = "";
  if(t.includes("ARROCERA")) base = "ARROCERA";
  else if(t.includes("BATIDORA")) base = "BATIDORA";
  else if(t.includes("BICICLETA")) base = "BICICLETA";
  else if(t.includes("BOCINA")) base = "BOCINA";
  else if(t.includes("REINA")) base = "REINA";
  else if(t.includes("VENTILADOR")) base = "VENTILADOR";
  else if(t.includes("COCINA")) base = "COCINA";
  else if(t.includes("OLLA")) base = "OLLA";
  else if(t.includes("CAFETERA")) base = "CAFETERA";
  else if(t.includes("LAVADORA")) base = "LAVADORA";
  else if(t.includes("NEVERA")) base = "NEVERA";
  else if(t.includes("TV")) base = "TV";
  else if(t.includes("COLCHON")||t.includes("COLCHÓN")) base = "COLCHON";
  else if(t.includes("FREIDORA")) base = "FREIDORA";
  else if(t.includes("FOGON")||t.includes("FOGÓN")) base = "FOGON";
  else if(t.includes("CUCHILLO")) base = "CUCHILLOS";
  else if(t.includes("SARTEN")||t.includes("SARTÉN")) base = "SARTEN";
  if(base){
    if(base==="BICICLETA" && (t.includes("12")||t.includes("20"))){
      let nueva = "BICICLETA " + (t.includes("12")?"12":"20");
      if(!CATALOGO[nueva]){ CATALOGO[nueva]={nombre:nueva,precio:0,desc:"Bicicleta"}; guardarCatalogo(); }
      return nueva;
    }
    for(let m of marcas){
      if(t.includes(m)){
        let nueva = base + " " + m;
        if(!CATALOGO[nueva]){ CATALOGO[nueva]={nombre:nueva,precio:0,desc:"Producto con marca"}; guardarCatalogo(); }
        return nueva;
      }
    }
    if(t.length>2 && t!==base) {
      if(!CATALOGO[t]){ CATALOGO[t]={nombre:t,precio:0,desc:"Producto nuevo"}; guardarCatalogo(); }
      return t;
    }
    return base;
  }
  if(t.includes("J10")) return "J10";
  if(t.includes("F39")) return "F39";
  if(t.includes("F22")) return "F22";
  if(t.includes("F6")) return "F6";
  if(t.includes("PEDESTAL")) return "PEDESTAL";
  if(t.includes("BOMBA")) return "BOMBA DE AGUA";
  if(t.includes("ALARMA")) return "ALARMA SOLAR";
  if(t.includes("LAMPARA")||t.includes("LÁMPARA")) return "LAMPARA";
  if(t.includes("INVERSOR")) return "INVERSOR";
  if(t.includes("MOTO")) return "MOTO ELECTRICA";
  if(t.includes("PLANTA")) return "PLANTA DE SOLDAR";
  if(t.includes("ESTACION")) return "ESTACION DE ENERGIA";
  if(t.includes("CAJITA")) return "CAJITA DECODIFICADORA";
  if(t && t.length>2){ if(!CATALOGO[t]){ CATALOGO[t]={nombre:t,precio:0,desc:"Producto nuevo"}; guardarCatalogo(); } return t; }
  return null;
}

// ===== FUNCION PARA PUBLICAR DISPONIBLES SIN CANTIDAD =====
async function publicarDisponibles(sock){
  let textoGrupo = `📦 *PRODUCTOS DISPONIBLES - KAIROS* 👑\nActualizado hoy ${hoyCuba()}\n\n`;
  let hay = false;
  for(let k in ALMACEN){
    let total = stockTotal(k);
    if(total>0){ textoGrupo += `✅ ${CATALOGO[k]?.nombre || k}\n`; hay=true; }
  }
  if(!hay) textoGrupo += `Por ahora sin stock, vuelve pronto 👑\n`;
  textoGrupo += `\nEscribe al privado para pedir 👑`;
  if(GRUPO_DISPONIBLES && !GRUPO_DISPONIBLES.includes('PON_AQUI')){
    try{ await sock.sendMessage(GRUPO_DISPONIBLES,{text:textoGrupo}); return 'publicado'; }catch(e){ return 'error: '+e.message; }
  }
  return 'sin grupo';
}
function textoDisponiblesPrivado(){
  let txt = `📦 *PRODUCTOS DISPONIBLES - CON CANTIDAD (SOLO TU)* 👑\n\n`;
  for(let k in ALMACEN){
    let total = stockTotal(k);
    if(total>0) txt += `✅ ${CATALOGO[k]?.nombre || k} - ${total} (A1:${ALMACEN[k].A1||0} A2:${ALMACEN[k].A2||0} A3:${ALMACEN[k].A3||0})\n`;
  }
  return txt || 'Sin stock';
}

async function verificarTasaUSD(){ if(MODO==="manual") return; try{ const res=await fetch("https://api.eltoque.com/v1/trmi"); const data=await res.json(); const usd=data.find(m=>m.currency==="USD"); if(usd){ TASA_SITIO=usd.price||usd.valor; TASA_MN=TASA_SITIO+10; } }catch(e){} }
setInterval(verificarTasaUSD,7200000); verificarTasaUSD();
function esSpam(texto){ let t=(texto||'').toLowerCase(); return ["http://","https://","t.me/","revolico","www."].some(p=>t.includes(p)); }

async function start(){
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({ version, logger: pino({ level: 'silent' }), auth: state, browser: ["Kairos Bot","Chrome","1.0"] });
  sockGlobal = sock;
  if(!sock.authState.creds.registered){
    setTimeout(async()=>{ try{ let codigo = await sock.requestPairingCode("5356947882"); CODIGO_EMPAREJAR = codigo; estado = 'CODIGO: ' + codigo; console.log(`\n\n👑 TU CODIGO ES: ${codigo}\n\n`); }catch(e){ console.log('Error codigo:', e.message); } }, 3000);
  }
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (u)=>{ const { connection, lastDisconnect, qr } = u; estado='Conexion: '+connection; if(qr){ ultimoQR=qr; estado='QR LISTO'; } if(connection==='open'){ estado='BOT LISTO ✅'; ultimoQR=''; CODIGO_EMPAREJAR=""; } if(connection==='close'){ const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut; if(shouldReconnect) start(); } });
  sock.ev.on('messages.upsert', async ({ messages })=>{
    const m=messages[0]; if(!m.message || m.key.fromMe) return;
    const rawText=(m.message.conversation || m.message.extendedTextMessage?.text || '');
    const text=rawText.toLowerCase().trim(); const from=m.key.remoteJid;
    const send=async(t)=>{ await sock.sendMessage(from,{text:t}); };
    const pushName=m.pushName||'Gestor';
    const fromNum = normalizarNum(from);
    const esNumAdmin = fromNum==='5356947882' || fromNum.includes('56947882');
    const esNumSegundo = fromNum==='5351126531' || fromNum.includes('51126531');
    let esAdmin=(esNumAdmin || ADMIN_LIDS.includes(from) || from===ADMIN_NUMERO);
    let esSegundo=(esNumSegundo || SEGUNDO_LIDS.includes(from) || from===SEGUNDO_JEFE_NUMERO);

    // ===== GRUPOS =====
    if(from.endsWith('@g.us')){
      if(text==='mi id'){ await send(`Tu ID es: ${from}`); return; }
      if(esSpam(rawText) && !esAdmin && !esSegundo){ try{ await sock.sendMessage(from,{delete: m.key}); }catch(e){} return; }
      // Grupo almacen - llegada simple
      if(from===GRUPO_ALMACEN){
        if(text.startsWith('llegó ')||text.startsWith('llego ')||text.startsWith('entrada ')||text.startsWith('entró ')||text.startsWith('entro ')){
          let partes=rawText.split(' '); partes.shift(); let cant=parseInt(partes[partes.length-1]); let prodTexto=partes.slice(0,-1).join(' ');
          let clave=buscarProducto(prodTexto)||prodTexto.toUpperCase();
          if(!clave||isNaN(cant)){ await send(`No entendí. Usa así: llegó J10 10`); return; }
          if(!ALMACEN[clave]) ALMACEN[clave]={A1:0,A2:0,A3:0};
          let alm=PRODUCTO_ALMACEN[clave]||'A1'; if(!ALMACEN[clave][alm]) ALMACEN[clave][alm]=0; ALMACEN[clave][alm]+=cant;
          guardar('almacen',ALMACEN);
          await send(`✅ *ACTUALIZADO* 👑\n${CATALOGO[clave]?.nombre||clave} +${cant} en ${alm}\nTotal: ${stockTotal(clave)}`);
          return;
        }
        if(text==='ver almacen'){ let txt=`📦 *ALMACÉN AHORA (SOLO TU)*\n\n`; for(let k in ALMACEN) txt+=`${CATALOGO[k]?.nombre||k}: Total ${stockTotal(k)} (A1: ${ALMACEN[k].A1||0} | A2: ${ALMACEN[k].A2||0} | A3: ${ALMACEN[k].A3||0})\n`; await send(txt); return; }
      }
      return;
    }

    // ===== PRIVADO - ACTUALIZAR ALMACEN CON LISTA COMPLETA =====
    if(rawText.toLowerCase().startsWith('actualizar almacen') && (esAdmin||esSegundo)){
      let lineas = rawText.split('\n').slice(1).filter(l=>l.trim().length>2);
      // Si viene en una sola linea con comas, tambien lo entiende
      if(lineas.length===0){
        let resto = rawText.replace(/actualizar almacen/i,'').trim();
        if(resto) lineas = resto.split(',').map(s=>s.trim());
      }
      if(!lineas.length){ await send(`Manda así por privado:\nactualizar almacen\nArrocera Estelectric 522\nBatidora Desmatt 472\n\nO en una linea: actualizar almacen Arrocera Estelectric 522, Batidora 472`); return; }
      let actualizados = [];
      for(let linea of lineas){
        let partes = linea.trim().split(' ');
        let cant = parseInt(partes[partes.length-1]);
        if(isNaN(cant)) continue;
        let nombreProd = partes.slice(0,-1).join(' ');
        let clave = buscarProducto(nombreProd) || nombreProd.toUpperCase();
        if(!ALMACEN[clave]) ALMACEN[clave]={A1:0,A2:0,A3:0};
        if(!CATALOGO[clave]){ CATALOGO[clave]={nombre:nombreProd,precio:0,desc:"Producto con marca"}; guardarCatalogo(); }
        ALMACEN[clave].A1 = cant; // Reemplaza en A1, no suma
        actualizados.push(`✅ ${CATALOGO[clave].nombre} - ${cant}`);
      }
      guardar('almacen',ALMACEN);
      await send(`✅ *ACTUALIZADO EN PRIVADO* 👑\nSe puso en A1:\n\n${actualizados.join('\n')}\n\nYa lo estoy publicando en el grupo de disponibles sin cantidad...`);
      let r = await publicarDisponibles(sock);
      if(r==='sin grupo') await send(`⚠️ Falta poner el ID de GRUPO_DISPONIBLES arriba en el código. En ese grupo escribe "mi id" y lo pegas.`);
      else await send(`✅ Ya publicado en el grupo de disponibles, sin cantidad 👑`);
      return;
    }

    if(text==='ver disponibles' && (esAdmin||esSegundo)){ await send(textoDisponiblesPrivado()); return; }
    if(text==='publicar disponibles' && (esAdmin||esSegundo)){ let r=await publicarDisponibles(sock); await send(r==='publicado'?`✅ Publicado sin cantidad 👑`:`⚠️ ${r}`); return; }
    if(text==='mi id'){ await send(`Tu ID: ${from}\nEres admin: ${esAdmin?'SI 👑':'NO'}`); return; }
    if(text==='soy louis'){ if(!ADMIN_LIDS.includes(from)){ ADMIN_LIDS.push(from); guardar('admin_lids',ADMIN_LIDS); } await send(`✅ Listo Louis 👑 Ya te guardé como jefe`); return; }
    if(text==='soy segundo'){ if(!SEGUNDO_LIDS.includes(from)){ SEGUNDO_LIDS.push(from); guardar('segundo_lids',SEGUNDO_LIDS); } await send(`✅ Listo Segundo Jefe 👑`); return; }
    if(text==='menu'||text==='ayuda'){ await send(`👑 *KAIROS - MENU*\n\n• actualizar almacen (por privado, con lista)\n• ver disponibles (solo tu, con cantidad)\n• publicar disponibles (publica sin cantidad)\n• catalogo\n• ver almacen\n• ver vales\n• ver comisiones\n• tasa actual\n• pedido J10 x2 - Maria 56947882 - San Miguel - mensajeria`); return; }
    if(text==='catalogo'||text==='catálogo'){ let txt=`👑 *CATALOGO KAIROS*\nTasa: ${TASA_MN} CUP\n\n`; for(let k in CATALOGO) txt+=`• ${CATALOGO[k].nombre} - ${CATALOGO[k].precio} USD - Stock: ${stockTotal(k)}\n`; await send(txt); return; }
    if(text==='ver almacen' && (esAdmin||esSegundo)){ await send(textoDisponiblesPrivado()); return; }
    if(text==='ver comisiones' && (esAdmin||esSegundo)){ let txt=`💰 *COMISIONES*\n\n`; for(let k in comisiones){ txt+=`• ${k}: Ventas ${comisiones[k].ventas} - Total ${comisiones[k].total} CUP - Pagado ${comisiones[k].pagado||0}\n`; } await send(txt||'Sin comisiones aún'); return; }
    if(text==='ver vales' && (esAdmin||esSegundo)){ let hoy=hoyCuba(); let valesHoy=Object.values(VALES).filter(v=>v.fecha===hoy); if(!valesHoy.length){ await send(`Hoy no hay vales.`); return; } let txt=`📋 *VALES HOY ${hoy}*\n\n`; valesHoy.forEach(v=>txt+=`• ${v.codigo} - ${v.comercial} - ${v.cliente} - ${v.productos.map(p=>p.nombre+' x'+p.cant).join(', ')} - ${v.totalUSD} USD - ${v.estado}\n`); await send(txt); return; }
    if(text==='tasa actual' || text==='tasa'){ await send(`💵 TASA ACTUAL KAIROS\nSitio: ${TASA_SITIO}\nVenta: ${TASA_MN}\nModo: ${MODO}`); return; }
    if(text.startsWith('tasa ') && esAdmin){ let v=rawText.split(' ')[1]?.toLowerCase(); if(v==='auto'){ MODO='auto'; await verificarTasaUSD(); await send(`✅ Vuelta a tasa auto: ${TASA_MN}`); return; } let valor=parseInt(v); if(!isNaN(valor)){ MODO='manual'; TASA_MN=valor; TASA_SITIO=valor-10; await send(`✅ Tasa manual puesta en ${valor} CUP.`); } return; }
    if(text.startsWith('ok confirmado kairos-')){
      if(!esAdmin && !esSegundo){ await send(`Solo Louis o el segundo jefe pueden confirmar.`); return; }
      let codigo='KAIROS-'+rawText.split('-').pop().trim().toUpperCase().replace('KAIROS-','');
      let vale=VALES[codigo]; if(!vale){ await send(`No encontré ${codigo}`); return; }
      if(vale.estado==='confirmado'){ await send(`${codigo} ya estaba confirmado.`); return; }
      vale.estado='confirmado';
      for(let p of vale.productos) descontarStock(p.clave,p.cant);
      let comi=sumarComision(vale.comercial, vale.productos); vale.comision=comi;
      guardar('vales',VALES); guardar('almacen',ALMACEN);
      await send(`✅ *${codigo} CONFIRMADO* 👑\nCliente: ${vale.cliente}\nComisión para ${vale.comercial}: ${comi} CUP\nStock actualizado.`);
      return;
    }
    if(text.startsWith('pedido ')){
      let resto=rawText.replace(/pedido /i,'').trim(); let partes=resto.split(' - ').map(s=>s.trim());
      if(partes.length<3){ await send(`Usa así:\npedido J10 x2 - Maria Perez - 56947882 - San Miguel - mensajeria`); return; }
      let prodTexto=partes[0]; let clave=buscarProducto(prodTexto);
      if(!clave){ await send(`No encontré ese producto. Escribe: catalogo`); return; }
      let cantMatch=prodTexto.match(/x(\d+)/i)||prodTexto.match(/(\d+)\s*$/); let cant=cantMatch?parseInt(cantMatch[1]):1;
      if(stockTotal(clave)<cant){ await send(`❌ No hay stock de ${CATALOGO[clave]?.nombre||clave}. Quedan ${stockTotal(clave)}`); return; }
      let telefonoCliente = sacarNumeroCliente(resto);
      if(!telefonoCliente){ await send(`⚠️ Falta el numero del cliente.`); return; }
      let cliente = limpiarNombreCliente(partes[1]) || partes[1];
      let direccion = partes[2] || '';
      let tipoRaw = (partes[3] || 'mensajeria').toLowerCase();
      let tipo = tipoRaw.includes('recog') ? 'recogida' : 'mensajeria';
      let llaveAnti=`${cliente.toLowerCase()}-${clave}`; let ahoraMs=Date.now();
      if(ULTIMOS_PEDIDOS[llaveAnti] && (ahoraMs-ULTIMOS_PEDIDOS[llaveAnti])<5*60*1000){ await send(`⚠️ Ya creaste este pedido hace menos de 5 minutos.`); return; }
      ULTIMOS_PEDIDOS[llaveAnti]=ahoraMs;
      let precio=CATALOGO[clave]?.precio||0; let totalUSD=precio*cant;
      let codigo=`KAIROS-${String(CONTADOR_VALE).padStart(3,'0')}`; CONTADOR_VALE++; guardar('contador',CONTADOR_VALE);
      CLIENTES[telefonoCliente] = { nombre: cliente, telefono: telefonoCliente, direccion, ultimoPedido: codigo, fecha: hoyCuba() };
      guardar('clientes', CLIENTES);
      let vale={codigo,comercial:pushName,cliente,telefonoCliente,direccion,productos:[{clave,nombre:CATALOGO[clave].nombre,cant}],totalUSD,tipo_entrega:tipo,estado:'pendiente',fecha:hoyCuba(),comision:comisionPorClave(clave)*cant};
      VALES[codigo]=vale; guardar('vales',VALES);
      await send(`📝 *VALE CREADO ${codigo}* 👑\nCliente: ${cliente}\nProducto: ${CATALOGO[clave].nombre} x${cant}\nTotal: ${totalUSD} USD\nComisión: ${vale.comision} CUP\n\nLouis lo confirma con:\nOK confirmado ${codigo}`);
      return;
    }
    if(!esHorario()){
      await send(`Dale mi hermano 👑 Estamos cerrados, te atendemos a las 8 AM.\nDejame tu pedido asi:\npedido J10 x2 - Maria 56947882 - San Miguel - mensajeria`);
      return;
    }
    await send(`Hola ${pushName} 👑 Soy KAIROS.\nEscribe *menu* para ver todo.`);
  });
}
start();
