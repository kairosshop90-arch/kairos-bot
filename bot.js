const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs');
const app = express();
let ultimoQR = ""; let estado = 'Iniciando...';
app.get('/', (req, res) => res.send('KAIROS BOT ACTIVO 👑'));
app.get('/qr', async (req, res) => { if (!ultimoQR) return res.send(`<h1>${estado}</h1>`); const img = await QRCode.toDataURL(ultimoQR); res.send(`<h1>ESCANEA ESTE QR CON WHATSAPP</h1><img src="${img}">`); });
app.listen(process.env.PORT || 3000);
let TASA_SITIO = 915; let TASA_MN = 925; let MODO = "auto";
let sockGlobal = null; let ESPERANDO_ACTUALIZACION_ALMACEN = false; let YA_MANDO_5PM_HOY = "";
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
let YA_MANDO_RESPALDO_HOY = "";
let YA_MANDO_OFERTA_HOY = "";
const FB_PAGE_ID = "PON_TU_PAGE_ID_AQUI";
const FB_PAGE_TOKEN = "PON_TU_PAGE_ACCESS_TOKEN_AQUI";
const FB_CANAL_FOTOS = "PON_AQUI_ID_GRUPO_CANAL_FOTOS";
const GRUPO_CLIENTES_LINK = "PON_AQUI_LINK_GRUPO_CLIENTES";
const GRUPO_CLIENTES_ID = "PON_AQUI_ID_GRUPO_CLIENTES";
let DUDAS_BASE = cargar('dudas_base', []);
let GRUPOS_ESCUCHA = cargar('grupos_escucha', []);
let OFERTAS_GUARDADAS = cargar('ofertas_guardadas', []);
let ULTIMOS_PEDIDOS = {};
let ENTREGAS_PENDIENTES = cargar('entregas_pendientes', {});
let YA_MANDO_CIERRE_SEMANAL = "";
const ADMIN_NUMERO = "5356947882@s.whatsapp.net";
const SEGUNDO_JEFE_NUMERO = "5351126531@s.whatsapp.net";
const GRUPO_LOCAL = "PON_AQUI_ID_GRUPO_LOCAL";
const GRUPO_MENSAJERIA = "PON_AQUI_ID_GRUPO_MENSAJERIA";
const GRUPO_ALMACEN = "PON_AQUI_ID_GRUPO_ALMACEN";
function grupoParaVale(v){ if(v.tipo_entrega==='recogida') return GRUPO_LOCAL; return GRUPO_MENSAJERIA; }
function fechaCuba(){ return new Date(new Date().toLocaleString('en-US',{timeZone:'America/Havana'})); }
function hoyCuba(){ return fechaCuba().toLocaleDateString('en-CA',{timeZone:'America/Havana'}); }
function horaCubaNum(){ return fechaCuba().getHours(); }
function normalizarNum(s){ return (s||'').replace(/[^0-9]/g,''); }
function esDeNoche(){ let h=horaCubaNum(); return h>=17 || h<8; }
function esHorario(){ let h=horaCubaNum(); return h>=8 && h<17; }
function getTasaVenta(){ if(MODO==="manual") return TASA_MN; return TASA_MN; }
// ===== NUEVO - NUMERO CLIENTE + ENLACE GRUPO CLIENTES =====
function sacarNumeroCliente(texto){
  let m = (texto||'').match(/(53)?(\d{8})/);
  if(!m) return null;
  return '53' + m[2];
}
function limpiarNombreCliente(texto){
  return (texto||'').replace(/(53)?\d{8}/g,'').replace(/\s+/g,' ').trim();
}
async function enviarEnlaceGrupoClientes(sock, vale){
  if(!vale.telefonoCliente) return 'sin numero';
  if(!GRUPO_CLIENTES_LINK || GRUPO_CLIENTES_LINK.includes('PON_AQUI')) return 'sin link grupo clientes';
  let jid = vale.telefonoCliente + '@s.whatsapp.net';
  let msg = `👑 *BIENVENIDO A KAIROS SHOP* 👑\n\nHola ${vale.cliente}, tu pedido ${vale.codigo} ya esta creado ✅\n\nProducto: ${vale.productos.map(p=>p.nombre+' x'+p.cant).join(', ')}\nTotal: ${vale.totalUSD} USD\nEntrega: ${vale.tipo_entrega}\n\nUnete a nuestro grupo de clientes para ofertas, garantia y soporte, aqui te avisamos de tu pedido:\n${GRUPO_CLIENTES_LINK}\n\nGracias por comprar con nosotros 🙏\nTienes 30 dias de garantia.`;
  try{ await sock.sendMessage(jid, {text: msg}); return 'enviado'; }catch(e){ return 'error: '+e.message; }
}
let DIRECCION_ALMACEN = cargar('almacenes_direcciones',{'A1':'Calle 1ra #23306 / 4ta y 6ta. Altura del Mirador del Diezmero','A2':'Calle 2da / E y D, Reparto Luyano Moderno, La Corea, #18532, San Miguel del Padrón','A3':'PONER DIRECCION DE A3 AQUI'});
let PRODUCTO_ALMACEN = cargar('producto_almacen',{'J10':'A2','F39':'A1','F6':'A3','F22':'A2','BEE F6':'A3','PEDESTAL':'A1','NEVERA':'A2','FRIO':'A1','EXHIBIDORA':'A2','TV':'A1','COLCHON':'A3'});
let ALMACEN_DEF = {};
["J10","F39","F22","F6","BEE F6","PEDESTAL","NEVERA","FRIO","EXHIBIDORA","TV","COLCHON","REINA","ARROCERA","INFRARROJO","VENTILADOR","MICROWAVE","FREIDORA","MOTOR AGUA","PULIDORA","OLLA PRESION","BATIDORA","CAFETERA","FILTRO AGUA","COCINA ELECTRICA","TOSTADORA","BOCINA","SARTEN","CALDEROS","FREGADERO","TALADRO","CUCHILLOS","CASCO MOTO","FOGON","LAVADORA","SPLIT","REFRIGERADOR","FREGADORA MOTO","DISPENSADOR","COCINA HORNO","PANEL SOLAR","ESTANTE","CALENTADOR","CAJA FUERTE"].forEach(k=>{ ALMACEN_DEF[k]={A1:0,A2:0,A3:0}; });
ALMACEN_DEF["J10"]={A1:5,A2:5,A3:0}; ALMACEN_DEF["F39"]={A1:5,A2:5,A3:0}; ALMACEN_DEF["F6"]={A1:5,A2:5,A3:0}; ALMACEN_DEF["BEE F6"]={A1:5,A2:5,A3:0}; ALMACEN_DEF["F22"]={A1:5,A2:5,A3:0}; ALMACEN_DEF["PEDESTAL"]={A1:5,A2:5,A3:0}; ALMACEN_DEF["NEVERA"]={A1:3,A2:2,A3:0}; ALMACEN_DEF["FRIO"]={A1:3,A2:2,A3:0}; ALMACEN_DEF["EXHIBIDORA"]={A1:2,A2:1,A3:0}; ALMACEN_DEF["TV"]={A1:3,A2:2,A3:0}; ALMACEN_DEF["COLCHON"]={A1:3,A2:2,A3:0};
let ALMACEN = cargar('almacen', ALMACEN_DEF);
for(let k in ALMACEN_DEF) if(!ALMACEN[k]) ALMACEN[k]=ALMACEN_DEF[k];
function stockTotal(c){ if(!ALMACEN[c]) return 0; if(typeof ALMACEN[c]==='number') return ALMACEN[c]; return (ALMACEN[c].A1||0)+(ALMACEN[c].A2||0)+(ALMACEN[c].A3||0); }
function descontarStock(clave,cant){ if(typeof ALMACEN[clave]==='number'){ ALMACEN[clave]=Math.max(0,ALMACEN[clave]-cant); return; } let queda=cant; for(let alm of ['A1','A2','A3']){ if(queda<=0) break; let disp=ALMACEN[clave][alm]||0; let quitar=Math.min(disp,queda); ALMACEN[clave][alm]=disp-quitar; queda-=quitar; } }
function devolverStock(clave,cant,almacen){ if(typeof ALMACEN[clave]==='number'){ ALMACEN[clave]+=cant; return; } if(!ALMACEN[clave][almacen]) ALMACEN[clave][almacen]=0; ALMACEN[clave][almacen]+=cant; }
function textoAlmacenesDeProductos(productos){ let por={}; for(let p of productos){ let alm=PRODUCTO_ALMACEN[p.clave]||'A1'; if(!por[alm]) por[alm]=[]; por[alm].push(p); } return Object.keys(por).map(alm=>`📦 Almacén ${alm} - ${DIRECCION_ALMACEN[alm]}\n${por[alm].map(p=>`- ${p.nombre} x${p.cant}`).join('\n')}`).join('\n\n'); }
let CATALOGO = {
  "J10":{nombre:"J10 Recargable",precio:40,desc:"Solar + Bluetooth + Luz + Radio FM"},
  "F39":{nombre:"F39 Solar",precio:42,desc:"Solar + Bluetooth + Luz"},
  "F22":{nombre:"F22 SACO",precio:70,desc:"SACO Grande - Potente"},
  "F6":{nombre:"F6 SACO",precio:35,desc:"SACO - Bluetooth + Luz"},
  "BEE F6":{nombre:"Bee F6",precio:32,desc:"Bee F6 - 32 USD / Mayor: 30 USD"},
  "PEDESTAL":{nombre:'Pedestal 18"',precio:23,desc:'Ventilador Pedestal 18" - 3 velocidades'},
  "NEVERA":{nombre:"Nevera",precio:0,desc:"Preguntar modelo - 11 pies / 16 pies"},
  "FRIO":{nombre:"Frío",precio:0,desc:"Frío 15 pies en adelante"},
  "EXHIBIDORA":{nombre:"Exhibidora",precio:0,desc:"Exhibidora con cristales - MUCHO CUIDADO"},
  "TV":{nombre:"TV",precio:0,desc:"TV - Preguntar pulgadas"},
  "COLCHON":{nombre:"Colchón",precio:0,desc:"Colchón - Preguntar medida"},
  "REINA":{nombre:"Reina",precio:0,desc:"Reina"},
  "ARROCERA":{nombre:"Arrocera",precio:0,desc:"Arrocera"},
  "INFRARROJO":{nombre:"Infrarrojo",precio:0,desc:"Cocina Infrarrojo"},
  "VENTILADOR":{nombre:"Ventilador",precio:0,desc:"Ventilador"},
  "MICROWAVE":{nombre:"Microwave",precio:0,desc:"Microwave / Microondas"},
  "FREIDORA":{nombre:"Freidora de Aire",precio:0,desc:"Freidora de Aire"},
  "MOTOR AGUA":{nombre:"Motor de Agua",precio:0,desc:"Motor de Agua"},
  "PULIDORA":{nombre:"Pulidora",precio:0,desc:"Pulidora"},
  "OLLA PRESION":{nombre:"Olla Presión",precio:0,desc:"Olla de Presión"},
  "BATIDORA":{nombre:"Batidora",precio:0,desc:"Batidora"},
  "CAFETERA":{nombre:"Cafetera",precio:0,desc:"Cafetera"},
  "FILTRO AGUA":{nombre:"Filtro Agua",precio:0,desc:"Filtro de Agua"},
  "COCINA ELECTRICA":{nombre:"Cocina Eléctrica",precio:0,desc:"Cocina Eléctrica"},
  "TOSTADORA":{nombre:"Tostadora",precio:0,desc:"Tostadora"},
  "BOCINA":{nombre:"Bocina",precio:0,desc:"Bocina"},
  "SARTEN":{nombre:"Sartén Inducción",precio:0,desc:"Sartén Inducción"},
  "CALDEROS":{nombre:"Juego Calderos",precio:0,desc:"Juego de Calderos"},
  "FREGADERO":{nombre:"Fregadero",precio:0,desc:"Fregadero"},
  "TALADRO":{nombre:"Taladro",precio:0,desc:"Taladro"},
  "CUCHILLOS":{nombre:"Juego Cuchillos",precio:0,desc:"Juego de Cuchillos"},
  "CASCO MOTO":{nombre:"Casco Moto",precio:0,desc:"Casco de Moto"},
  "FOGON":{nombre:"Fogón Petróleo",precio:0,desc:"Fogón de Petróleo"},
  "LAVADORA":{nombre:"Lavadora",precio:0,desc:"Lavadora"},
  "SPLIT":{nombre:"Split",precio:0,desc:"Split - Preguntar BTU"},
  "REFRIGERADOR":{nombre:"Refrigerador",precio:0,desc:"Refrigerador"},
  "FREGADORA MOTO":{nombre:"Fregadora Moto",precio:0,desc:"Fregadora de Moto"},
  "DISPENSADOR":{nombre:"Dispensador",precio:0,desc:"Dispensador de Agua"},
  "COCINA HORNO":{nombre:"Cocina con Horno",precio:0,desc:"Cocina con Horno"},
  "PANEL SOLAR":{nombre:"Panel Solar",precio:0,desc:"Panel Solar"},
  "ESTANTE":{nombre:"Estante",precio:0,desc:"Estante"},
  "CALENTADOR":{nombre:"Calentador Ducha",precio:0,desc:"Calentador de Ducha"},
  "CAJA FUERTE":{nombre:"Caja Fuerte",precio:0,desc:"Caja Fuerte"}
};
const EQUIPOS_GRANDES = ["NEVERA","FRIO","EXHIBIDORA","TV","COLCHON","LAVADORA","SPLIT","REFRIGERADOR","COCINA HORNO","PANEL SOLAR","DISPENSADOR","FREGADORA MOTO"];
const COMISIONES_OFICIALES = {
  1200: ["REINA","ARROCERA","INFRARROJO","VENTILADOR","MICROWAVE","FREIDORA","MOTOR AGUA","PULIDORA","OLLA PRESION","BATIDORA","CAFETERA","FILTRO AGUA","PEDESTAL"],
  1000: ["COCINA ELECTRICA","TOSTADORA","BOCINA","SARTEN","CALDEROS","J10","F39","F22","F6","BEE F6"],
  700: ["FREGADERO"],
  500: ["TALADRO","CUCHILLOS","CASCO MOTO","FOGON"],
  2500: ["LAVADORA","NEVERA","SPLIT","REFRIGERADOR","FREGADORA MOTO","DISPENSADOR","FRIO","EXHIBIDORA"],
  2000: ["COLCHON","COCINA HORNO","TV","PANEL SOLAR"],
  1500: ["ESTANTE","CALENTADOR","CAJA FUERTE"]
};
function comisionPorClave(clave){ let c=clave.toUpperCase().trim(); for(let monto in COMISIONES_OFICIALES){ if(COMISIONES_OFICIALES[monto].includes(c)) return parseInt(monto); } return 1000; }
function calcularComision(nc, productos){ let total=0; for(let p of productos) total+=comisionPorClave(p.clave)*p.cant; return total; }
function sumarComision(nc, productos){ if(!comisiones[nc]) comisiones[nc]={ventas:0,total:0,pagado:0}; let monto=calcularComision(nc,productos); let tot=productos.reduce((s,p)=>s+p.cant,0); comisiones[nc].ventas+=tot; comisiones[nc].total+=monto; guardar('comisiones',comisiones); return monto; }
async function verificarTasaUSD(){ if(MODO==="manual") return; try{ const res=await fetch("https://api.eltoque.com/v1/trmi"); const data=await res.json(); const usd=data.find(m=>m.currency==="USD"); if(usd){ TASA_SITIO=usd.price||usd.valor; TASA_MN=TASA_SITIO+10; } }catch(e){} }
setInterval(verificarTasaUSD,7200000); verificarTasaUSD();
function resumenDelDia(){ let hoy=hoyCuba(); let valesHoy=Object.values(VALES).filter(v=>v.fecha===hoy); let totalUSD=valesHoy.reduce((s,v)=>s+(v.totalUSD||0),0); let totalComi=valesHoy.reduce((s,v)=>s+(v.comision||0),0); let porGestor={}; valesHoy.forEach(v=>{ porGestor[v.comercial]=(porGestor[v.comercial]||0)+1; }); let top=Object.entries(porGestor).sort((a,b)=>b[1]-a[1])[0]||['nadie',0]; let prod={}; valesHoy.forEach(v=>{ v.productos?.forEach(p=>{ prod[p.nombre]=(prod[p.nombre]||0)+p.cant; }); }); let listaProd=Object.entries(prod).map(([k,v])=>`• ${k} x${v}`).join('\n')||'Sin ventas'; return `📊 *RESUMEN DEL DIA - ${hoy} - KAIROS* 👑\n\nVales: ${valesHoy.length}\nVendido: ${totalUSD} USD\nComisiones: ${totalComi} CUP\nTop: ${top[0]} - ${top[1]} ventas\n\n*Productos:*\n${listaProd}\n\nCola: ${COLA_NOCHE.length}`; }
function queSeVendeMas(){ let c={}; Object.values(VALES).forEach(v=>{ if(v.estado==='cancelado') return; v.productos?.forEach(p=>{ c[p.clave]=(c[p.clave]||0)+p.cant; }); }); let o=Object.entries(c).sort((a,b)=>b[1]-a[1]); if(!o.length) return 'Aun no hay ventas'; return `🧠 *QUE SE VENDE MAS*\nTop: ${o[0][0]} - ${o[0][1]} vendidos\nSegundo: ${(o[1]||['ninguno',0])[0]} - ${(o[1]||['ninguno',0])[1]}\n\nLouis, pide mas ${o[0][0]} 👑`; }
function estadisticasPor(filtro, valor){ let lista=Object.values(VALES).filter(v=>v.estado!=='cancelado'); if(filtro==='barrio') lista=lista.filter(v=>v.direccion?.toLowerCase().includes(valor.toLowerCase())); if(filtro==='producto') lista=lista.filter(v=>v.productos?.some(p=>p.clave===valor.toUpperCase()||p.nombre.toLowerCase().includes(valor.toLowerCase()))); if(filtro==='gestor') lista=lista.filter(v=>v.comercial.toLowerCase().includes(valor.toLowerCase())); if(filtro==='fecha') lista
