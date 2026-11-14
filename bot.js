const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs');
const app = express();
let ultimoQR = ""; let estado = 'Iniciando...'; let CODIGO = "";
app.get('/', (req, res) => res.send('KAIROS BOT ACTIVO 👑'));
app.get('/qr', async (req, res) => {
  if (CODIGO) return res.send(`<h1 style="font-size:60px">CODIGO: ${CODIGO}</h1><p>WhatsApp > Ajustes > Dispositivos vinculados > Vincular con numero > Pon este codigo</p><p>${estado}</p>`);
  if (!ultimoQR) return res.send(`<h1>${estado}</h1>`);
  const img = await QRCode.toDataURL(ultimoQR);
  res.send(`<h1>ESCANEA ESTE QR</h1><img src="${img}">`);
});
app.listen(process.env.PORT || 3000);

// ===== DATOS =====
if (!fs.existsSync('data')) fs.mkdirSync('data');
function cargar(n,d){ try{ return JSON.parse(fs.readFileSync(`data/${n}.json`,'utf8')); }catch{ return d; } }
function guardar(n,d){ fs.writeFileSync(`data/${n}.json`, JSON.stringify(d,null,2)); }
let CONTADOR = cargar('contador',1);
let VALES = cargar('vales',{});
let comisiones = cargar('comisiones',{});
let CLIENTES = cargar('clientes',{});
let COLA = cargar('cola_noche',[]);
let ADMIN_LIDS = cargar('admin_lids',[]);
let SEGUNDO_LIDS = cargar('segundo_lids',[]);
let GESTORES = cargar('gestores',{});
let DUDAS = cargar('dudas_base',[]);
let GRUPOS_ESCUCHA = cargar('grupos_escucha',[]);
let OFERTAS = cargar('ofertas_guardadas',[]);
let ENTREGAS = cargar('entregas_pendientes',{});
let ULTIMOS = {};
let sockGlobal = null;
let YA_5PM = ""; let YA_RESPALDO = ""; let YA_CIERRE = ""; let ESPERANDO_ALMACEN = false;

const ADMIN_NUMERO = "5356947882@s.whatsapp.net";
const SEGUNDO_NUMERO = "5351126531@s.whatsapp.net";
const GRUPO_LOCAL = "PON_AQUI_ID_GRUPO_LOCAL";
const GRUPO_MENSAJERIA = "PON_AQUI_ID_GRUPO_MENSAJERIA";
const GRUPO_ALMACEN = "PON_AQUI_ID_GRUPO_ALMACEN";
const GRUPO_CLIENTES_LINK = "PON_AQUI_LINK_GRUPO_CLIENTES";
const FB_PAGE_ID = "PON_TU_PAGE_ID_AQUI";
const FB_PAGE_TOKEN = "PON_TU_PAGE_ACCESS_TOKEN_AQUI";
const FB_CANAL_FOTOS = "PON_AQUI_ID_GRUPO_CANAL_FOTOS";

// ===== TIEMPO CUBA / TASA =====
let TASA_SITIO = 915; let TASA_MN = 925; let MODO = "auto";
function fechaCuba(){ return new Date(new Date().toLocaleString('en-US',{timeZone:'America/Havana'})); }
function hoyCuba(){ return fechaCuba().toLocaleDateString('en-CA',{timeZone:'America/Havana'}); }
function horaCuba(){ return fechaCuba().getHours(); }
function esDeNoche(){ let h=horaCuba(); return h>=17 || h<8; }
function esHorario(){ let h=horaCuba(); return h>=8 && h<17; }
function normalizar(s){ return (s||'').replace(/[^0-9]/g,''); }
async function verificarTasa(){ if(MODO==="manual") return; try{ const r=await fetch("https://api.eltoque.com/v1/trmi"); const d=await r.json(); const u=d.find(m=>m.currency==="USD"); if(u){ TASA_SITIO=u.price||u.valor; TASA_MN=TASA_SITIO+10; } }catch(e){} }
setInterval(verificarTasa,7200000); verificarTasa();

// ===== ALMACEN / CATALOGO =====
let DIR_ALM = cargar('almacenes_direcciones',{'A1':'Calle 1ra #23306 / 4ta y 6ta. Altura del Mirador del Diezmero','A2':'Calle 2da / E y D, Reparto Luyano Moderno, La Corea, #18532, San Miguel del Padrón','A3':'PONER DIRECCION DE A3 AQUI'});
let PROD_ALM = cargar('producto_almacen',{'J10':'A2','F39':'A1','F6':'A3','F22':'A2','BEE F6':'A3','PEDESTAL':'A1','NEVERA':'A2','FRIO':'A1','EXHIBIDORA':'A2','TV':'A1','COLCHON':'A3'});
let ALM_DEF = {};
["J10","F39","F22","F6","BEE F6","PEDESTAL","NEVERA","FRIO","EXHIBIDORA","TV","COLCHON","REINA","ARROCERA","INFRARROJO","VENTILADOR","MICROWAVE","FREIDORA","MOTOR AGUA","PULIDORA","OLLA PRESION","BATIDORA","CAFETERA","FILTRO AGUA","COCINA ELECTRICA","TOSTADORA","BOCINA","SARTEN","CALDEROS","FREGADERO","TALADRO","CUCHILLOS","CASCO MOTO","FOGON","LAVADORA","SPLIT","REFRIGERADOR","FREGADORA MOTO","DISPENSADOR","COCINA HORNO","PANEL SOLAR","ESTANTE","CALENTADOR","CAJA FUERTE"].forEach(k=>{ ALM_DEF[k]={A1:0,A2:0,A3:0}; });
ALM_DEF["J10"]={A1:5,A2:5,A3:0}; ALM_DEF["F39"]={A1:5,A2:5,A3:0}; ALM_DEF["F6"]={A1:5,A2:5,A3:0}; ALM_DEF["BEE F6"]={A1:5,A2:5,A3:0}; ALM_DEF["F22"]={A1:5,A2:5,A3:0}; ALM_DEF["PEDESTAL"]={A1:5,A2:5,A3:0}; ALM_DEF["NEVERA"]={A1:3,A2:2,A3:0}; ALM_DEF["FRIO"]={A1:3,A2:2,A3:0}; ALM_DEF["EXHIBIDORA"]={A1:2,A2:1,A3:0}; ALM_DEF["TV"]={A1:3,A2:2,A3:0}; ALM_DEF["COLCHON"]={A1:3,A2:2,A3:0};
let ALMACEN = cargar('almacen', ALM_DEF);
for(let k in ALM_DEF) if(!ALMACEN[k]) ALMACEN[k]=ALM_DEF[k];
function stockTotal(c){ if(!ALMACEN[c]) return 0; if(typeof ALMACEN[c]==='number') return ALMACEN[c]; return (ALMACEN[c].A1||0)+(ALMACEN[c].A2||0)+(ALMACEN[c].A3||0); }
function descontar(clave,cant){ if(typeof ALMACEN[clave]==='number'){ ALMACEN[clave]=Math.max(0,ALMACEN[clave]-cant); return; } let q=cant; for(let a of ['A1','A2','A3']){ if(q<=0) break; let d=ALMACEN[clave][a]||0; let qu=Math.min(d,q); ALMACEN[clave][a]=d-qu; q-=qu; } }
function devolver(clave,cant,alm){ if(typeof ALMACEN[clave]==='number'){ ALMACEN[clave]+=cant; return; } if(!ALMACEN[clave][alm]) ALMACEN[clave][alm]=0; ALMACEN[clave][alm]+=cant; }
function textoAlm(productos){ let por={}; for(let p of productos){ let a=PROD_ALM[p.clave]||'A1'; if(!por[a]) por[a]=[]; por[a].push(p); } return Object.keys(por).map(a=>`📦 Almacen ${a} - ${DIR_ALM[a]}\n${por[a].map(p=>`- ${p.nombre} x${p.cant}`).join('\n')}`).join('\n\n'); }
function grupoParaVale(v){ return v.tipo_entrega==='recogida' ? GRUPO_LOCAL : GRUPO_MENSAJERIA; }

let CATALOGO = {
  "J10":{nombre:"J10 Recargable",precio:40,desc:"Solar + Bluetooth + Luz + Radio FM"},
  "F39":{nombre:"F39 Solar",precio:42,desc:"Solar + Bluetooth + Luz"},
  "F22":{nombre:"F22 SACO",precio:70,desc:"SACO Grande"},
  "F6":{nombre:"F6 SACO",precio:35,desc:"SACO - Bluetooth + Luz"},
  "BEE F6":{nombre:"Bee F6",precio:32,desc:"Bee F6"},
  "PEDESTAL":{nombre:'Pedestal 18"',precio:23,desc:'Ventilador Pedestal 18"'},
  "NEVERA":{nombre:"Nevera",precio:0,desc:"Preguntar modelo"}, "FRIO":{nombre:"Frío",precio:0,desc:"Frío 15 pies+"},
  "EXHIBIDORA":{nombre:"Exhibidora",precio:0,desc:"Exhibidora - MUCHO CUIDADO"},
  "TV":{nombre:"TV",precio:0,desc:"Preguntar pulgadas"}, "COLCHON":{nombre:"Colchón",precio:0,desc:"Preguntar medida"},
  "REINA":{nombre:"Reina",precio:0,desc:"Reina"}, "ARROCERA":{nombre:"Arrocera",precio:0,desc:"Arrocera"},
  "INFRARROJO":{nombre:"Infrarrojo",precio:0,desc:"Cocina Infrarrojo"}, "VENTILADOR":{nombre:"Ventilador",precio:0,desc:"Ventilador"},
  "MICROWAVE":{nombre:"Microwave",precio:0,desc:"Microwave"}, "FREIDORA":{nombre:"Freidora de Aire",precio:0,desc:"Freidora"},
  "MOTOR AGUA":{nombre:"Motor de Agua",precio:0,desc:"Motor"}, "PULIDORA":{nombre:"Pulidora",precio:0,desc:"Pulidora"},
  "OLLA PRESION":{nombre:"Olla Presión",precio:0,desc:"Olla"}, "BATIDORA":{nombre:"Batidora",precio:0,desc:"Batidora"},
  "CAFETERA":{nombre:"Cafetera",precio:0,desc:"Cafetera"}, "FILTRO AGUA":{nombre:"Filtro Agua",precio:0,desc:"Filtro"},
  "COCINA ELECTRICA":{nombre:"Cocina Eléctrica",precio:0,desc:"Cocina"}, "TOSTADORA":{nombre:"Tostadora",precio:0,desc:"Tostadora"},
  "BOCINA":{nombre:"Bocina",precio:0,desc:"Bocina"}, "SARTEN":{nombre:"Sartén Inducción",precio:0,desc:"Sartén"},
  "CALDEROS":{nombre:"Juego Calderos",precio:0,desc:"Calderos"}, "FREGADERO":{nombre:"Fregadero",precio:0,desc:"Fregadero"},
  "TALADRO":{nombre:"Taladro",precio:0,desc:"Taladro"}, "CUCHILLOS":{nombre:"Juego Cuchillos",precio:0,desc:"Cuchillos"},
  "CASCO MOTO":{nombre:"Casco Moto",precio:0,desc:"Casco"}, "FOGON":{nombre:"Fogón Petróleo",precio:0,desc:"Fogón"},
  "LAVADORA":{nombre:"Lavadora",precio:0,desc:"Lavadora"}, "SPLIT":{nombre:"Split",precio:0,desc:"Split"},
  "REFRIGERADOR":{nombre:"Refrigerador",precio:0,desc:"Refrigerador"}, "FREGADORA MOTO":{nombre:"Fregadora Moto",precio:0,desc:"Fregadora"},
  "DISPENSADOR":{nombre:"Dispensador",precio:0,desc:"Dispensador"}, "COCINA HORNO":{nombre:"Cocina con Horno",precio:0,desc:"Cocina Horno"},
  "PANEL SOLAR":{nombre:"Panel Solar",precio:0,desc:"Panel"}, "ESTANTE":{nombre:"Estante",precio:0,desc:"Estante"},
  "CALENTADOR":{nombre:"Calentador Ducha",precio:0,desc:"Calentador"}, "CAJA FUERTE":{nombre:"Caja Fuerte",precio:0,desc:"Caja Fuerte"}
};
const GRANDES = ["NEVERA","FRIO","EXHIBIDORA","TV","COLCHON","LAVADORA","SPLIT","REFRIGERADOR","COCINA HORNO","PANEL SOLAR","DISPENSADOR","FREGADORA MOTO"];
const COM_OFICIAL = {
  1200: ["REINA","ARROCERA","INFRARROJO","VENTILADOR","MICROWAVE","FREIDORA","MOTOR AGUA","PULIDORA","OLLA PRESION","BATIDORA","CAFETERA","FILTRO AGUA","PEDESTAL"],
  1000: ["COCINA ELECTRICA","TOSTADORA","BOCINA","SARTEN","CALDEROS","J10","F39","F22","F6","BEE F6"],
  700: ["FREGADERO"], 500: ["TALADRO","CUCHILLOS","CASCO MOTO","FOGON"],
  2500: ["LAVADORA","NEVERA","SPLIT","REFRIGERADOR","FREGADORA MOTO","DISPENSADOR","FRIO","EXHIBIDORA"],
  2000: ["COLCHON","COCINA HORNO","TV","PANEL SOLAR"], 1500: ["ESTANTE","CALENTADOR","CAJA FUERTE"]
};
function comisionPorClave(clave){ let c=clave.toUpperCase().trim(); for(let m in COM_OFICIAL){ if(COM_OFICIAL[m].includes(c)) return parseInt(m); } return 1000; }
function calcularComision(prods){ let t=0; for(let p of prods) t+=comisionPorClave(p.clave)*p.cant; return t; }
function sumarComision(nc, prods){ if(!comisiones[nc]) comisiones[nc]={ventas:0,total:0,pagado:0}; let monto=calcularComision(prods); comisiones[nc].ventas+=prods.reduce((s,p)=>s+p.cant,0); comisiones[nc].total+=monto; guardar('comisiones',comisiones); return monto; }

// ===== MENSAJERIA =====
const MENSAJERIA = [ { zona:"san miguel",precio:1000}, {zona:"san miguel",k:["entrincado","intrincado"],precio:1500}, {zona:"guanabacoa",k:["via blanca","debeche","mañana","centro guanabacoa"],precio:2000}, {zona:"guanabacoa",k:["roble","jata","mikito","naranjo"],precio:2500}, {zona:"guanabacoa",k:["puente de santa fe","santa fe"],precio:3000}, {zona:"guanabacoa",k:["barreras","minas"],precio:4000}, {zona:"campo florido",precio:5000}, {zona:"regla",precio:2000}, {zona:"casa blanca",precio:2500}, {zona:"bahia",precio:2500}, {zona:"cojimar",precio:2500}, {zona:"villa panamericana",precio:2500}, {zona:"alamar",precio:2500}, {zona:"alamar",k:["zona 17","zona 18","micro x","calle ancha"],precio:3000}, {zona:"camilo",precio:2500}, {zona:"cotorro",k:["centro"],precio:2500}, {zona:"cotorro",k:["paradero"],precio:3000}, {zona:"cotorro",k:["santa maria","al berro","loma de tierra"],precio:3500}, {zona:"cuatro camino",precio:4000}, {zona:"diez de octubre",precio:2000}, {zona:"vibora",precio:2000}, {zona:"lawton",precio:2000}, {zona:"arroyo naranjo",precio:2500}, {zona:"calabazar",precio:3000}, {zona:"reparto electrico",precio:2500}, {zona:"managua",precio:4000}, {zona:"guasimas",precio:3500}, {zona:"centro habana",precio:2000}, {zona:"habana vieja",precio:2000}, {zona:"cerro",precio:2000}, {zona:"cerro",k:["casino","ayestaran","boyero","camaguey"],precio:2500}, {zona:"vedado",precio:2000}, {zona:"plaza",precio:2000}, {zona:"playa",precio:3000}, {zona:"playa",k:["despues del paradero"],precio:3500}, {zona:"jaimanita",precio:4000}, {zona:"santa fe playa",precio:4500}, {zona:"marianao",precio:3500}, {zona:"lisa",precio:3500}, {zona:"lisa",k:["despues de 222"],precio:4000}, {zona:"punta brava",precio:5000}, {zona:"valle grande",precio:5000}, {zona:"arroyo arena",precio:4500}, {zona:"san agustin",precio:4000}, {zona:"guanabo",precio:6000}, {zona:"cien y aldabo",precio:3000}, {zona:"boyero",k:["alta habana"],precio:3000}, {zona:"boyero",precio:4000}, {zona:"santiago de las vegas",precio:4500}, {zona:"wajay",precio:5000}, {zona:"el chico",precio:5000} ];
function calcularMensajeria(dir, prods, txtFull){ let d=dir.toLowerCase(); let enc=null; for(let m of MENSAJERIA){ if(m.k && m.k.some(k=>d.includes(k))){ enc=m; break; } } if(!enc) for(let m of MENSAJERIA){ if(d.includes(m.zona)){ enc=m; break; } } if(!enc) return null; let base=enc.precio; let esG=prods.some(p=>GRANDES.includes(p.clave)); let tot=prods.reduce((s,p)=>s+p.cant,0); let fin=base; let det=`Base ${base} CUP`; if(esG||tot>=3){ fin=base*2; det+=` x2 = ${fin}`; } let t=txtFull.toLowerCase(); if(t.includes("nevera 11")||t.includes("nevera 16")||t.includes("11 pies")||t.includes("16 pies")){ fin+=500; det+=` +500 Nevera`; } if(prods.some(p=>p.clave==="EXHIBIDORA")){ fin+=1000; det+=` +1000 Exhibidora`; } if((t.includes("frio 15")||t.includes("15 pies")||t.includes("16 pies")||t.includes("17 pies")||t.includes("18 pies")||t.includes("20 pies")) && prods.some(p=>p.clave==="FRIO")){ fin+=800; det+=` +800 Frio 15+`; } return {precio:fin,detalle:det}; }

// ===== UTILS =====
function buscarProducto(texto){ let t=texto.toUpperCase(); if(t.includes("BEE")) return "BEE F6"; if(t.includes("J10")) return "J10"; if(t.includes("F39")) return "F39"; if(t.includes("F22")) return "F22"; if(t.includes("F6")) return "F6"; if(t.includes("PEDESTAL")) return "PEDESTAL"; if(t.includes("NEVERA")) return "NEVERA"; if(t.includes("EXHIBIDORA")) return "EXHIBIDORA"; if(t.includes("FRIO")||t.includes("FRÍO")) return "FRIO"; if(t.includes("TV")||t.includes("TELEVISOR")) return "TV"; if(t.includes("COLCHON")||t.includes("COLCHÓN")) return "COLCHON"; if(t.includes("REINA")) return "REINA"; if(t.includes("ARROCERA")) return "ARROCERA"; if(t.includes("INFRARROJO")) return "INFRARROJO"; if(t.includes("VENTILADOR")) return "VENTILADOR"; if(t.includes("MICROWAVE")||t.includes("MICROONDAS")) return "MICROWAVE"; if(t.includes("FREIDORA")) return "FREIDORA"; if(t.includes("MOTOR")) return "MOTOR AGUA"; if(t.includes("PULIDORA")) return "PULIDORA"; if(t.includes("OLLA")) return "OLLA PRESION"; if(t.includes("BATIDORA")) return "BATIDORA"; if(t.includes("CAFETERA")) return "CAFETERA"; if(t.includes("FILTRO")) return "FILTRO AGUA"; if(t.includes("COCINA") && t.includes("HORNO")) return "COCINA HORNO"; if(t.includes("COCINA")) return "COCINA ELECTRICA"; if(t.includes("TOSTADORA")) return "TOSTADORA"; if(t.includes("BOCINA")) return "BOCINA"; if(t.includes("SARTEN")||t.includes("SARTÉN")) return "SARTEN"; if(t.includes("CALDERO")) return "CALDEROS"; if(t.includes("FREGADERO")) return "FREGADERO"; if(t.includes("TALADRO")) return "TALADRO"; if(t.includes("CUCHILLO")) return "CUCHILLOS"; if(t.includes("CASCO")) return "CASCO MOTO"; if(t.includes("FOGON")||t.includes("FOGÓN")) return "FOGON"; if(t.includes("LAVADORA")) return "LAVADORA"; if(t.includes("SPLIT")) return "SPLIT"; if(t.includes("REFRIGERADOR")) return "REFRIGERADOR"; if(t.includes("FREGADORA")) return "FREGADORA MOTO"; if(t.includes("DISPENSADOR")) return "DISPENSADOR"; if(t.includes("PANEL")) return "PANEL SOLAR"; if(t.includes("ESTANTE")) return "ESTANTE"; if(t.includes("CALENTADOR")) return "CALENTADOR"; if(t.includes("CAJA FUERTE")||t.includes("CAJA")) return "CAJA FUERTE"; return null; }
function sacarNumero(texto){ let m=(texto||'').match(/(53)?(\d{8})/); if(!m) return null; return '53'+m[2]; }
function limpiarNombre(texto){ return (texto||'').replace(/(53)?\d{8}/g,'').replace(/\s+/g,' ').trim(); }
async function enviarEnlace(sock, vale){ if(!vale.telefonoCliente) return 'sin numero'; if(!GRUPO_CLIENTES_LINK || GRUPO_CLIENTES_LINK.includes('PON_AQUI')) return 'sin link grupo clientes'; let jid=vale.telefonoCliente+'@s.whatsapp.net'; let msg=`👑 *BIENVENIDO A KAIROS SHOP* 👑\n\nHola ${vale.cliente}, tu pedido ${vale.codigo} ya esta creado ✅\nProducto: ${vale.productos.map(p=>p.nombre+' x'+p.cant).join(', ')}\nTotal: ${vale.totalUSD} USD\nEntrega: ${vale.tipo_entrega}\n\nUnete a nuestro grupo de clientes:\n${GRUPO_CLIENTES_LINK}\n\nGracias 🙏 Tienes 30 dias de garantia.`; try{ await sock.sendMessage(jid,{text:msg}); return 'enviado'; }catch(e){ return 'error: '+e.message; } }
function resumenDelDia(){ let hoy=hoyCuba(); let vHoy=Object.values(VALES).filter(v=>v.fecha===hoy); let total=vHoy.reduce((s,v)=>s+(v.totalUSD||0),0); let comi=vHoy.reduce((s,v)=>s+(v.comision||0),0); let por={}; vHoy.forEach(v=>{ por[v.comercial]=(por[v.comercial]||0)+1; }); let top=Object.entries(por).sort((a,b)=>b[1]-a[1])[0]||['nadie',0]; let prod={}; vHoy.forEach(v=>{ v.productos?.forEach(p=>{ prod[p.nombre]=(prod[p.nombre]||0)+p.cant; }); }); let lp=Object.entries(prod).map(([k,v])=>`• ${k} x${v}`).join('\n')||'Sin ventas'; return `📊 *RESUMEN DEL DIA - ${hoy} - KAIROS* 👑\n\nVales: ${vHoy.length}\nVendido: ${total} USD\nComisiones: ${comi} CUP\nTop: ${top[0]} - ${top[1]} ventas\n\n*Productos:*\n${lp}\n\nCola: ${COLA.length}`; }
function queSeVendeMas(){ let c={}; Object.values(VALES).forEach(v=>{ if(v.estado==='cancelado') return; v.productos?.forEach(p=>{ c[p.clave]=(c[p.clave]||0)+p.cant; }); }); let o=Object.entries(c).sort((a,b)=>b[1]-a[1]); if(!o.length) return 'Aun no hay ventas'; return `🧠 *QUE SE VENDE MAS*\nTop: ${o[0][0]} - ${o[0][1]} vendidos\nSegundo: ${(o[1]||['ninguno',0])[0]} - ${(o[1]||['ninguno',0])[1]}\n\nLouis, pide mas ${o[0][0]} 👑`; }
function estadisticasPor(filtro, valor){ let lista=Object.values(VALES).filter(v=>v.estado!=='cancelado'); if(filtro==='barrio') lista=lista.filter(v=>v.direccion?.toLowerCase().includes(valor.toLowerCase())); if(filtro==='producto') lista=lista.filter(v=>v.productos?.some(p=>p.clave===valor.toUpperCase()||p.nombre.toLowerCase().includes(valor.toLowerCase()))); if(filtro==='gestor') lista=lista.filter(v=>v.comercial.toLowerCase().includes(valor.toLowerCase())); if(filtro==='fecha') lista=lista.filter(v=>v.fecha===valor); let total=lista.reduce((s,v)=>s+(v.totalUSD||0),0); return `📈 *ESTADISTICAS - ${filtro}: ${valor}*\nPedidos: ${lista.length}\nVendido: ${total} USD\n\n${lista.slice(-10).map(v=>`• ${v.codigo} - ${v.cliente} - ${v.totalUSD} USD`).join('\n')||'Sin datos'}`; }
function cierreSemanal(){ let sem=Object.values(VALES).filter(v=>v.estado!=='cancelado'); let total=sem.reduce((s,v)=>s+(v.totalUSD||0),0); let comi=sem.reduce((s,v)=>s+(v.comision||0),0); let por={}; sem.forEach(v=>{ por[v.comercial]=(por[v.comercial]||0)+1; }); let top=Object.entries(por).sort((a,b)=>b[1]-a[1]).slice(0,3); let txt=top.map(([n,c],i)=>`${i+1}. ${n} - ${c} ventas`).join('\n')||'Sin ventas'; return `📊 *CIERRE SEMANAL - KAIROS* 👑\n\nTotal: ${sem.length} vales\nVendido: ${total} USD\nComisiones: ${comi} CUP\n\n*Top 3:*\n${txt}`; }
const PROHIBIDAS = ["http://","https://","t.me/","otro negocio","www.","revolico","mi tienda","sigueme"];
function esSpam(t){ let x=t.toLowerCase(); return PROHIBIDAS.some(p=>x.includes(p)); }
function guardarDuda(grupo, quien, preg, resp=''){ if(!preg||preg.length<8) return; if(esSpam(preg)) return; if(DUDAS.find(d=>d.pregunta.toLowerCase()===preg.toLowerCase())) return; DUDAS.push({grupo,quien,pregunta:preg,respuesta:resp,fecha:hoyCuba(),veces:1}); if(DUDAS.length>500) DUDAS=DUDAS.slice(-500); guardar('dudas_base',DUDAS); }
function buscarDuda(preg){ let t=preg.toLowerCase(); let pal=t.split(' ').filter(w=>w.length>3); let mejor=null,scoreMax=0; for(let d of DUDAS){ let s=0; for(let p of pal) if(d.pregunta.toLowerCase().includes(p)) s++; if(d.respuesta) s+=1; if(s>scoreMax){ scoreMax=s; mejor=d; } } if(mejor&&scoreMax>=2) return mejor; return null; }
async function publicarFB(texto, foto=''){ if(FB_PAGE_ID.includes('PON_')) return '❌ Falta poner FB_PAGE_ID y FB_PAGE_TOKEN arriba.'; try{ let url=`https://graph.facebook.com/v19.0/${FB_PAGE_ID}/feed`; let body={message:texto,access_token:FB_PAGE_TOKEN}; if(foto){ url=`https://graph.facebook.com/v19.0/${FB_PAGE_ID}/photos`; body={url:foto,caption:texto,access_token:FB_PAGE_TOKEN}; } const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); const d=await r.json(); if(d.id) return `✅ Publicado en Facebook 👑\nID: ${d.id}`; return `❌ FB: ${JSON.stringify(d)}`; }catch(e){ return `❌ Error FB: ${e.message}`; } }

// ===== TIMERS =====
setInterval(async()=>{
  let ahora=fechaCuba(); let h=ahora.getHours(); let min=ahora.getMinutes(); let hoy=hoyCuba();
  if(h===20 && min===0 && !ESPERANDO_ALMACEN && sockGlobal){ ESPERANDO_ALMACEN=true; try{ await sockGlobal.sendMessage(GRUPO_ALMACEN,{text:`📦 *ACTUALIZACION ALMACEN 8 PM - KAIROS* 👑\nManden así:\nllegó J10 10\n\nVer: ver almacen`}); }catch(e){} setTimeout(()=>{ ESPERANDO_ALMACEN=false; },3600000); }
  if(h===19 && min===59) ESPERANDO_ALMACEN=false;
  if(h===23 && min===0 && YA_RESPALDO!==hoy && sockGlobal){ YA_RESPALDO=hoy; let vHoy=Object.values(VALES).filter(v=>v.fecha===hoy); try{ await sockGlobal.sendMessage(ADMIN_NUMERO,{text:`📦 *RESPALDO 11 PM - ${hoy}* 👑\nVales hoy: ${vHoy.length}\nCola: ${COLA.length}\nTodo guardado ✅`}); }catch(e){} guardar('vales',VALES); guardar('comisiones',comisiones); guardar('almacen',ALMACEN); guardar('clientes',CLIENTES); }
  if(h===8 && min===0 && sockGlobal && COLA.length>0){ try{ await sockGlobal.sendMessage(ADMIN_NUMERO,{text:`🌙 *COLA NOCHE* 👑\nQuedaron ${COLA.length} pedidos. Escribe *ver cola*`}); }catch(e){} }
  if(sockGlobal){ for(let cod in ENTREGAS){ let ini=ENTREGAS[cod]; let dif=(Date.now()-ini)/(1000*60*60); if(dif>=2){ try{ await sockGlobal.sendMessage(ADMIN_NUMERO,{text:`⏰ *ALERTA ENTREGA TARDA* 👑\n${cod} lleva ${Math.floor(dif)} horas sin entregar.`}); }catch(e){} delete ENTREGAS[cod]; guardar('entregas_pendientes',ENTREGAS); } } }
  let dia=ahora.getDay(); if(dia===0 && h===18 && min===0 && YA_CIERRE!==hoy && sockGlobal){ YA_CIERRE=hoy; try{ await sockGlobal.sendMessage(ADMIN_NUMERO,{text:cierreSemanal()}); }catch(e){} }
},60000);
setInterval(async()=>{ let ahora=fechaCuba(); let h=ahora.getHours(); let min=ahora.getMinutes(); let hoy=hoyCuba(); if(h===17 && min===0 && YA_5PM!==hoy && sockGlobal){ YA_5PM=hoy; let vHoy=Object.values(VALES).filter(v=>v.fecha===hoy); if(!vHoy.length){ await sockGlobal.sendMessage(ADMIN_NUMERO,{text:`📊 5 PM - Hoy no hubo ventas, Louis 👑`}); return; } let men=vHoy.filter(v=>v.tipo_entrega==='mensajeria'); let rec=vHoy.filter(v=>v.tipo_entrega==='recogida'); let msg=`📊 *CIERRE 5 PM - ${hoy} - KAIROS* 👑\nTotal: ${vHoy.length}\n\n🚚 *MENSAJERÍA (${men.length})*\n`; men.forEach(v=>{ msg+=`• ${v.codigo} - ${v.comercial} - ${v.cliente} - ${v.productos.map(p=>p.nombre+' x'+p.cant).join(', ')} - ${v.totalUSD} USD - ${v.estado}\n`; }); msg+=`\n🏪 *RECOGIDA (${rec.length})*\n`; rec.forEach(v=>{ msg+=`• ${v.codigo} - ${v.comercial} - ${v.cliente} - ${v.productos.map(p=>p.nombre+' x'+p.cant).join(', ')} - ${v.totalUSD} USD - ${v.estado}\n`; }); msg+=`\n✅ entregado KAIROS-001\n❌ no entregado KAIROS-001 motivo\n⚡ entregado todo`; await sockGlobal.sendMessage(ADMIN_NUMERO,{text:msg}); if(SEGUNDO_LIDS.length>0){ try{ await sockGlobal.sendMessage(SEGUNDO_LIDS[0],{text:msg}); }catch(e){} } } if(h===16 && min===59) YA_5PM=""; },60000);

// ===== BOT =====
async function start(){
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({ version, logger: pino({ level: 'silent' }), auth: state, browser: ["Kairos Bot","Chrome","1.0"] });
  sockGlobal = sock;
  if(!sock.authState.creds.registered){
    setTimeout(async()=>{ try{ let c = await sock.requestPairingCode("5356947882"); CODIGO = c; estado = 'CODIGO: ' + c; console.log(`\n\n👑 TU CODIGO ES: ${c}\n\n`); }catch(e){ console.log('Error codigo:', e.message); } }, 3000);
  }
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (u)=>{ const { connection, lastDisconnect, qr } = u; estado='Conexion: '+connection; if(qr){ ultimoQR=qr; estado='QR LISTO'; } if(connection==='open'){ estado='BOT LISTO ✅'; ultimoQR=''; CODIGO=""; } if(connection==='close'){ const re = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut; if(re) start(); } });
  sock.ev.on('messages.upsert', async ({ messages })=>{
    const m=messages[0]; if(!m.message || m.key.fromMe) return;
    const rawText=(m.message.conversation || m.message.extendedTextMessage?.text || '');
    const text=rawText.toLowerCase().trim(); const from=m.key.remoteJid;
    const send=async(t)=>{ await sock.sendMessage(from,{text:t}); };
    const pushName=m.pushName||'Gestor';
    const fromNum = normalizar(from);
    const sin53 = fromNum.startsWith('53') ? fromNum.slice(2) : fromNum;
    const esNumAdmin = fromNum==='5356947882' || sin53==='56947882' || fromNum.includes('56947882');
    const esNumSegundo = fromNum==='5351126531' || sin53==='51126531' || fromNum.includes('51126531');
    let esAdmin=(esNumAdmin || ADMIN_LIDS.includes(from) || from===ADMIN_NUMERO);
    let esSegundo=(esNumSegundo || SEGUNDO_LIDS.includes(from) || from===SEGUNDO_NUMERO);

    // Fotos canal
    if(from===FB_CANAL_FOTOS && (m.message.imageMessage || m.message.videoMessage)){
      let cap=(m.message.imageMessage?.caption || m.message.videoMessage?.caption || '').toLowerCase();
      let clave=buscarProducto(cap) || cap.split(' ')[1]?.toUpperCase();
      if(clave){ let fotos=cargar('fotos',{}); fotos[clave]={guardada:hoyCuba(),caption:cap,de:pushName}; guardar('fotos',fotos); await send(`📸 Foto de ${clave} guardada 👑`); return; }
    }
    // Foto entrega en grupos
    if((m.message.imageMessage || m.message.videoMessage) && from.endsWith('@g.us')){
      let cap=(m.message.imageMessage?.caption || m.message.videoMessage?.caption || '').toLowerCase();
      if(cap.includes('foto entrega')){
        let cod='KAIROS-' + cap.split('-').pop().trim().toUpperCase().replace('KAIROS-','');
        let v=VALES[cod]; if(v){ v.foto_entrega=true; v.foto_fecha=hoyCuba(); guardar('vales',VALES); await send(`✅ *FOTO ENTREGA GUARDADA - ${cod}* 👑\nCliente: ${v.cliente}`); return; }
      }
    }
    // Grupos
    if(from.endsWith('@g.us')){
      if(text==='mi id'){ await send(`Tu ID es: ${from}\nEste es el ID de este grupo. Mandaselo a Louis.`); return; }
      if(GRUPOS_ESCUCHA.includes(from) && !esAdmin && !esSegundo){
        let esPreg = text.includes('?') || text.includes('como') || text.includes('cuanto') || text.includes('cuánto') || text.includes('donde') || text.includes('garantia') || text.includes('precio') || text.includes('mensajeria') || text.includes('stock');
        if(esPreg){ guardarDuda(from, pushName, rawText, ''); try{ await sock.sendMessage(ADMIN_NUMERO,{text:`👂 *DUDA NUEVA* 👑\nGrupo: ${from}\nDe: ${pushName}\nPregunta: ${rawText}`}); }catch(e){} }
        if(text.startsWith('respuesta:')){ let resto=rawText.replace(/respuesta:/i,'').trim(); let partes=resto.split('='); if(partes.length===2){ let preg=partes[0].trim(); let resp=partes[1].trim(); let d=DUDAS.find(x=>x.pregunta.toLowerCase().includes(preg.toLowerCase().slice(0,10))); if(d){ d.respuesta=resp; guardar('dudas_base',DUDAS); } else guardarDuda(from, pushName, preg, resp); await send(`✅ Respuesta guardada 👑`); } }
        return;
      }
      if(esSpam(rawText) && !esAdmin && !esSegundo){ try{ await sock.sendMessage(from,{delete: m.key}); }catch(e){} await send(`⚠️ No se permite links de otros negocios.`); return; }
      if(from===GRUPO_ALMACEN){
        if(text.startsWith('llegó ')||text.startsWith('llego ')||text.startsWith('entrada ')||text.startsWith('entró ')||text.startsWith('entro ')){
          let partes=rawText.split(' '); partes.shift(); let prodTxt=partes.slice(0,-1).join(' '); let cant=parseInt(partes[partes.length-1]); let clave=buscarProducto(prodTxt)||prodTxt.toUpperCase();
          if(!clave||isNaN(cant)){ await send(`No entendí. Usa: llegó J10 10`); return; }
          if(!ALMACEN[clave]){ ALMACEN[clave]={A1:cant,A2:0,A3:0}; if(!CATALOGO[clave]) CATALOGO[clave]={nombre:clave,precio:0,desc:"Nuevo"}; if(!PROD_ALM[clave]) PROD_ALM[clave]='A1'; guardar('almacen',ALMACEN); guardar('producto_almacen',PROD_ALM); await send(`✅ *PRODUCTO NUEVO* 👑\n${clave} = ${cant} en A1`); return; }
          let alm=PROD_ALM[clave]||'A1'; if(typeof ALMACEN[clave]==='number') ALMACEN[clave]+=cant; else { if(!ALMACEN[clave][alm]) ALMACEN[clave][alm]=0; ALMACEN[clave][alm]+=cant; } guardar('almacen',ALMACEN); await send(`✅ *ACTUALIZADO* 👑\n${clave} +${cant} en ${alm}\nTotal: ${stockTotal(clave)} (A1:${ALMACEN[clave].A1||0} | A2:${ALMACEN[clave].A2||0} | A3:${ALMACEN[clave].A3||0})`); return;
        }
        if(text.startsWith('nuevo producto ')){ let partes=rawText.replace(/nuevo producto /i,'').trim().split(' '); let clave=partes[0]?.toUpperCase(); let cant=parseInt(partes[1]); let precio=parseInt(partes[2])||0; if(!clave||isNaN(cant)){ await send(`Usa: nuevo producto J20 50 45`); return; } ALMACEN[clave]={A1:cant,A2:0,A3:0}; CATALOGO[clave]={nombre:clave,precio:precio,desc:"Nuevo"}; PROD_ALM[clave]='A1'; guardar('almacen',ALMACEN); guardar('producto_almacen',PROD_ALM); await send(`✅ *PRODUCTO NUEVO* 👑\n${clave} Stock:${cant} Precio:${precio} USD`); return; }
        if(text.startsWith('precio ')){ let partes=rawText.split(' '); let clave=partes[1]?.toUpperCase(); let precio=parseInt(partes[2]); if(CATALOGO[clave]){ CATALOGO[clave].precio=precio; await send(`✅ Precio ${clave} = ${precio} USD`); } return; }
        if(text==='ver almacen'){ let txt=`📦 *ALMACÉN AHORA*\n\n`; for(let k in ALMACEN) txt+=`${k}: Total ${stockTotal(k)} (A1:${ALMACEN[k].A1||0} | A2:${ALMACEN[k].A2||0} | A3:${ALMACEN[k].A3||0})\n`; await send(txt); return; }
      }
      return;
    }

    if((text==='ver grupos'||text==='mis grupos'||text==='id grupos') && (esAdmin||esSegundo)){ try{ let grupos=await sock.groupFetchAllParticipating(); let lista=Object.values(grupos).map(g=>`📦 ${g.subject}\nID: ${g.id}`).join('\n\n'); await send(`🏪 GRUPOS DONDE ESTOY 👑\n\n${lista||'Ninguno'}`); }catch(e){ await send(`Error: ${e.message}`); } return; }
    if((esAdmin||esSegundo) && text.startsWith('unir grupo ')){ let link=rawText.split(' ')[2]||rawText.split(' ')[1]||''; let codInv=link.split('/').pop().trim(); try{ let idG=await sock.groupAcceptInvite(codInv); await send(`✅ Me uní 👑\nID: ${idG}`); }catch(e){ await send(`No pude unirme: ${e.message}`); } return; }
    if(text==='mi id'){ await send(`Tu ID: ${from}\nNumero: ${fromNum}\nAdmin: ${esAdmin?'SI 👑':'NO'}\nSegundo: ${esSegundo?'SI':'NO'}`); return; }
    if(text==='soy louis'){ if(!ADMIN_LIDS.includes(from)){ ADMIN_LIDS.push(from); guardar('admin_lids',ADMIN_LIDS); } await send(`✅ Listo Louis 👑 Ya te guarde como jefe`); return; }
    if(text==='soy segundo'){ if(!SEGUNDO_LIDS.includes(from)){ SEGUNDO_LIDS.push(from); guardar('segundo_lids',SEGUNDO_LIDS); } await send(`✅ Listo Segundo Jefe 👑`); return; }
    if(text==='tasa actual'||text==='tasa'){ await send(`💵 TASA KAIROS\nSitio: ${TASA_SITIO}\nVenta: ${TASA_MN}\nModo: ${MODO}\nEscribe: tasa 950`); return; }
    if(text.startsWith('tasa ') && esAdmin){ let v=rawText.split(' ')[1]?.toLowerCase(); if(v==='auto'){ MODO='auto'; await verificarTasa(); await send(`✅ Vuelta a auto: ${TASA_MN}`); return; } let val=parseInt(v); if(!isNaN(val)){ MODO='manual'; TASA_MN=val; TASA_SITIO=val-10; await send(`✅ Tasa manual ${val} CUP. Para volver: tasa auto`); } return; }
    if((text==='ver cola'||text==='cola noche'||text==='ver lista espera') && (esAdmin||esSegundo)){ if(!COLA.length){ await send(`Cola vacia ✅`); return; } let txt=`🌙 *COLA NOCHE - ${COLA.length}*\n\n`; COLA.forEach((p,i)=>{ txt+=`${i+1}. ${p.cliente} - ${p.telefonoCliente||''} - ${p.producto} x${p.cant} - ${p.direccion} - ${p.tipo}\n`; }); txt+=`\nEscribe *confirmar cola*`; await send(txt); return; }
    if(text==='confirmar cola' && (esAdmin||esSegundo)){ if(!COLA.length){ await send(`No hay nada en cola.`); return; } let creados=[]; for(let p of COLA){ let clave=p.clave||buscarProducto(p.producto||''); if(!clave) continue; let cant=p.cant||1; let codigo=`KAIROS-${String(CONTADOR).padStart(3,'0')}`; CONTADOR++; let precio=CATALOGO[clave]?.precio||0; let vale={codigo,comercial:p.comercial||pushName,cliente:p.cliente,telefonoCliente:p.telefonoCliente||'',direccion:p.direccion||'',productos:[{clave,nombre:CATALOGO[clave].nombre,cant}],totalUSD:precio*cant,tipo_entrega:p.tipo||'mensajeria',estado:'pendiente',fecha:hoyCuba(),comision:comisionPorClave(clave)*cant,linkEnviado:false}; VALES[codigo]=vale; creados.push(codigo); if(vale.telefonoCliente){ let r=await enviarEnlace(sock,vale); if(r==='enviado') vale.linkEnviado=true; } } guardar('contador',CONTADOR); guardar('vales',VALES); COLA=[]; guardar('cola_noche',COLA); await send(`✅ ${creados.length} de cola pasados a vales:\n${creados.join(', ')}`); return; }
    if(text==='oferta relampago' && esAdmin){ let conStock=Object.keys(CATALOGO).filter(k=>stockTotal(k)>3 && CATALOGO[k].precio>0); if(!conStock.length){ await send(`No hay stock para oferta.`); return; } let prod=conStock[Math.floor(Math.random()*conStock.length)]; let normal=CATALOGO[prod].precio; let oferta=Math.round(normal*0.9); await send(`⚡ *OFERTA RELAMPAGO - SOLO HOY* ⚡\n\n${CATALOGO[prod].nombre} a $${oferta} en vez de $${normal}\nQuedan ${stockTotal(prod)}\nEscribe *${prod}* para apartarlo 👑`); return; }
    if(text==='publicar' && esAdmin){ let txtFB=`🔥 KAIROS SHOP - LA HABANA 🔥\n\nJ10 Recargable - $40 USD\nF6 SACO - $35 USD\nF39 Solar - $42 USD\n\n✅ Domicilio a toda La Habana\n✅ Garantia 30 dias\n✅ USD / CUP / Transferencia\n\nEscribenos al WhatsApp 👑\n\n${queSeVendeMas()}`; let r=await publicarFB(txtFB); await send(r+`\n\n*Texto:*\n${txtFB}`); return; }
    if(text.startsWith('publicar ') && esAdmin){ let tLibre=rawText.replace(/publicar /i,'').trim(); let r=await publicarFB(tLibre); await send(r); return; }
    if(text.startsWith('buscar oferta')||text.startsWith('oferta ')){ let filtro=rawText.replace(/buscar ofertas?|oferta /i,'').trim(); if(!filtro){ await send(`🔍 *BUSCAR OFERTAS* 👑\n• buscar oferta J10\n• buscar oferta barato\n• buscar oferta menos de 35\n• buscar oferta con stock`); return; } let t=filtro.toLowerCase(); let lista=Object.keys(CATALOGO).map(k=>({clave:k,...CATALOGO[k],stock:stockTotal(k)})); let claveProd=null; try{ claveProd=buscarProducto(filtro); }catch(e){} if(claveProd) lista=lista.filter(p=>p.clave===claveProd); if(t.includes('barato')||t.includes('menos de')){ let max=parseInt(t.match(/\d+/)?.[0])||40; lista=lista.filter(p=>p.precio>0&&p.precio<=max); } if(t.includes('caro')||t.includes('mas de')){ let min=parseInt(t.match(/\d+/)?.[0])||40; lista=lista.filter(p=>p.precio>=min); } if(t.includes('con stock')||t.includes('disponible')||t.includes('hay')) lista=lista.filter(p=>p.stock>0); if(!lista.length){ await send(`No encontre con: ${filtro}`); return; } let txt=`🔍 *OFERTAS - ${filtro}*\n\n`; lista.slice(0,10).forEach(p=>{ let cup=p.precio>0?Math.round(p.precio*TASA_MN):0; txt+=`• ${p.nombre} - $${p.precio} USD / ${cup} CUP - Stock: ${p.stock} - Comision: ${comisionPorClave(p.clave)} CUP\n`; }); let extras=OFERTAS.filter(o=>!claveProd||o.texto.toLowerCase().includes(claveProd.toLowerCase())); if(extras.length) txt+=`\n*Ofertas otros grupos:*\n${extras.slice(0,3).map(o=>`• ${o.texto}`).join('\n')}`; await send(txt); return; }
    if(text.startsWith('guardar oferta ') && (esAdmin||esSegundo)){ let oTxt=rawText.replace(/guardar oferta /i,'').trim(); OFERTAS.push({texto:oTxt,fecha:hoyCuba(),quien:pushName}); guardar('ofertas_guardadas',OFERTAS); await send(`✅ Oferta guardada: ${oTxt}`); return; }
    if(text.startsWith('escuchar grupo ') && esAdmin){ let idG=rawText.replace(/escuchar grupo /i,'').trim(); if(!GRUPOS_ESCUCHA.includes(idG)){ GRUPOS_ESCUCHA.push(idG); guardar('grupos_escucha',GRUPOS_ESCUCHA); } await send(`✅ Ya escucho ese grupo 👑`); return; }
    if(text==='ver grupos escucha' && esAdmin){ await send(`👂 *GRUPOS QUE ESCUCHO:*\n${GRUPOS_ESCUCHA.length?GRUPOS_ESCUCHA.join('\n'):'Ninguno'}\n\nDudas: ${DUDAS.length}`); return; }
    if(text==='ver dudas' && (esAdmin||esSegundo)){ if(!DUDAS.length){ await send(`No hay dudas.`); return; } let txt=`🧠 *DUDAS - ${DUDAS.length}*\n\n`; DUDAS.slice(-10).forEach((d,i)=>{ txt+=`${i+1}. ${d.pregunta}\n R: ${d.respuesta||'sin respuesta'}\n\n`; }); await send(txt); return; }
    if((text==='resumen del dia'||text==='resumen del día'||text==='resumen') && (esAdmin||esSegundo)){ await send(resumenDelDia()); return; }
    if(text==='estadisticas'||text==='estadísticas'){ await send(`📈 *ESTADISTICAS*\n• estadisticas barrio San Miguel\n• estadisticas producto J10\n• estadisticas gestor Maria\n• estadisticas fecha 2026-11-14`); return; }
    if(text.startsWith('estadisticas ') && (esAdmin||esSegundo)){ let partes=rawText.split(' ').slice(1); let f=partes[0]?.toLowerCase(); let val=partes.slice(1).join(' '); if(['barrio','producto','gestor','fecha'].includes(f) && val){ await send(estadisticasPor(f,val)); return; } await send(`Usa: estadisticas barrio San Miguel`); return; }
    if((text==='que se vende mas'||text==='que se vende más'||text==='top ventas') && (esAdmin||esSegundo)){ await send(queSeVendeMas()); return; }
    if(text.startsWith('foto entrega ') && (esAdmin||esSegundo)){ let cod='KAIROS-'+rawText.split('-').pop().trim().toUpperCase().replace('KAIROS-',''); let v=VALES[cod]; if(!v){ await send(`No encontre ${cod}`); return; } await send(`📸 *REPORTE FOTO - ${cod}* 👑\nCliente: ${v.cliente}\nProducto: ${v.productos.map(p=>p.nombre+' x'+p.cant).join(', ')}\nDireccion: ${v.direccion}\nEstado: ${v.estado}\n\nManda foto con: foto entrega ${cod}`); return; }
    if(text==='cierre semanal' && (esAdmin||esSegundo)){ await send(cierreSemanal()); return; }
    if(text.startsWith('mandar enlace ') && (esAdmin||esSegundo)){ let cod='KAIROS-'+rawText.split('-').pop().trim().toUpperCase().replace('KAIROS-',''); let v=VALES[cod]; if(!v||!v.telefonoCliente){ await send(`Ese vale no tiene numero.`); return; } let r=await enviarEnlace(sock,v); await send(r==='enviado' ? `✅ Enlace reenviado a ${v.cliente}` : `❌ No pude: ${r}`); return; }
    if(text==='ver clientes' && (esAdmin||esSegundo)){ let lista=Object.values(CLIENTES); if(!lista.length){ await send(`No hay clientes.`); return; } await send(`👥 *CLIENTES - ${lista.length}*\n\n${lista.slice(-20).map(c=>`• ${c.nombre} - ${c.telefono} - Ultimo: ${c.ultimoPedido||''}`).join('\n')}`); return; }
    if((text==='ver comisiones'||text==='ver vales'||text==='ver almacen') && !esAdmin && !esSegundo){ await send(`⛔ Solo Louis y Segundo Jefe.`); return; }
    if(text==='menu'||text==='ayuda'||text==='help'){ await send(`👑 *KAIROS - MENU*\n\n• catalogo\n• comisiones\n• ver almacen\n• ver vales\n• ver comisiones\n• ver clientes\n• tasa actual / tasa 950 / tasa auto\n• ver cola / confirmar cola\n• oferta relampago\n• publicar / publicar [texto]\n• buscar oferta J10\n• ver dudas\n• resumen del dia\n• estadisticas producto J10\n• que se vende mas\n• foto entrega KAIROS-001\n• cierre semanal\n• mandar enlace KAIROS-001\n• pedido J10 x2 - Maria 56947882 - San Miguel - mensajeria`); return; }
    if(text==='catalogo'||text==='catálogo'){ let txt=`👑 *CATALOGO KAIROS*\nTasa: ${TASA_MN} CUP\n\n`; for(let k in CATALOGO) txt+=`• ${k} - ${CATALOGO[k].nombre} - ${CATALOGO[k].precio} USD - Stock: ${stockTotal(k)} - Comision: ${comisionPorClave(k)} CUP\n`; await send(txt); return; }
    if(text==='comisiones'){ await send(`💎 *COMISIONES OFICIALES*\n\n1200: Reinas, Arroceras, Infrarrojos, Ventiladores, Microwave, Freidora, Motor Agua, Pulidoras, Olla Presion, Batidoras, Cafeteras, Filtro Agua, Pedestal\n1000: Cocinas Electricas, Tostadoras, Bocinas, Sarten, Calderos, J10, F39, F22, F6, Bee F6\n700: Fregadero\n500: Taladros, Cuchillos, Cascos Moto, Fogon\n2500: Lavadoras, Neveras, Split, Refrigeradores, Fregadora Moto, Dispensador, Frio, Exhibidora\n2000: Colchones, Cocinas Horno, TV, Paneles\n1500: Estantes, Calentador, Caja Fuerte`); return; }
    if(text==='ver almacen' && (esAdmin||esSegundo)){ let txt=`📦 *ALMACÉN*\n\n`; for(let k in ALMACEN) txt+=`${k}: ${stockTotal(k)} (A1:${ALMACEN[k].A1||0} A2:${ALMACEN[k].A2||0} A3:${ALMACEN[k].A3||0})\n`; await send(txt); return; }
    if(text==='ver comisiones' && (esAdmin||esSegundo)){ let txt=`💰 *COMISIONES*\n\n`; for(let k in comisiones){ txt+=`• ${k}: Ventas ${comisiones[k].ventas} - Total ${comisiones[k].total} CUP - Pagado ${comisiones[k].pagado||0}\n`; } await send(txt||'Sin comisiones'); return; }
    if(text.startsWith('pagar comision ')){ if(!esAdmin) return; let nom=rawText.replace(/pagar comision /i,'').trim(); if(comisiones[nom]){ comisiones[nom].pagado=comisiones[nom].total; guardar('comisiones',comisiones); await send(`✅ Comision de ${nom} pagada: ${comisiones[nom].total} CUP`); } else await send(`No encontre a ${nom}`); return; }
    if(text==='ver vales' && (esAdmin||esSegundo)){ let hoy=hoyCuba(); let vHoy=Object.values(VALES).filter(v=>v.fecha===hoy); if(!vHoy.length){ await send(`Hoy no hay vales.`); return; } let txt=`📋 *VALES HOY ${hoy}*\n\n`; vHoy.forEach(v=>txt+=`• ${v.codigo} - ${v.comercial} - ${v.cliente} - ${v.telefonoCliente||''} - ${v.productos.map(p=>p.nombre+' x'+p.cant).join(', ')} - ${v.totalUSD} USD - ${v.estado}\n`); await send(txt); return; }
    if(text.startsWith('ok confirmado kairos-')){
      if(!esAdmin && !esSegundo){ await send(`Solo Louis o Segundo pueden confirmar.`); return; }
      let cod='KAIROS-'+rawText.split('-').pop().trim().toUpperCase().replace('KAIROS-','');
      let vale=VALES[cod]; if(!vale){ await send(`No encontre ${cod}`); return; }
      if(vale.estado==='confirmado'){ await send(`${cod} ya estaba confirmado.`); return; }
      vale.estado='confirmado'; for(let p of vale.productos) descontar(p.clave,p.cant); let comi=sumarComision(vale.comercial, vale.productos); vale.comision=comi; guardar('vales',VALES); guardar('almacen',ALMACEN);
      ENTREGAS[cod]=Date.now(); guardar('entregas_pendientes',ENTREGAS);
      await send(`✅ *${cod} CONFIRMADO* 👑\nCliente: ${vale.cliente} - ${vale.telefonoCliente||''}\nConfirmado por: ${esAdmin?'Louis':'Segundo'}\nComision para ${vale.comercial}: ${comi} CUP\n\n📸 Manden foto con: foto entrega ${cod}`);
      try{ let g=grupoParaVale(vale); if(g && !g.includes('PON_AQUI')) await sock.sendMessage(g,{text:`📦 *NUEVO VALE CONFIRMADO ${cod}*\nCliente: ${vale.cliente}\nProductos: ${vale.productos.map(p=>p.nombre+' x'+p.cant).join(', ')}\nTotal: ${vale.totalUSD} USD\n${textoAlm(vale.productos)}`}); }catch(e){}
      return;
    }
    if(text.startsWith('cancelar kairos-')){ if(!esAdmin && !esSegundo) return; let cod='KAIROS-'+rawText.split('-').pop().trim().toUpperCase().replace('KAIROS-',''); let v=VALES[cod]; if(!v){ await send(`No encontre ${cod}`); return; } if(v.estado==='confirmado'){ for(let p of v.productos) devolver(p.clave,p.cant,PROD_ALM[p.clave]||'A1'); } v.estado='cancelado'; guardar('vales',VALES); guardar('almacen',ALMACEN); await send(`❌ ${cod} cancelado y stock devuelto.`); return; }
    if(text.startsWith('entregado kairos-')){ if(!esAdmin && !esSegundo) return; let cod='KAIROS-'+rawText.split('-').pop().trim().toUpperCase().replace('KAIROS-',''); let v=VALES[cod]; if(v){ v.estado='entregado'; guardar('vales',VALES); if(ENTREGAS[cod]){ delete ENTREGAS[cod]; guardar('entregas_pendientes',ENTREGAS); } await send(`✅ ${cod} entregado.\n\nMensaje cliente:\n🙏 *GRACIAS POR COMPRAR EN KAIROS* 👑\n${v.cliente}, gracias por tu compra. Tienes 30 dias de garantia.`); } return; }
    if(text==='entregado todo' && (esAdmin||esSegundo)){ let hoy=hoyCuba(); let c=0; for(let k in VALES) if(VALES[k].fecha===hoy && VALES[k].estado==='confirmado'){ VALES[k].estado='entregado'; c++; } guardar('vales',VALES); await send(`✅ ${c} vales entregados hoy.`); return; }
    if(text.startsWith('no entregado kairos-')){ if(!esAdmin && !esSegundo) return; let partes=rawText.split(' '); let cod='KAIROS-'+partes[2].split('-').pop().trim().toUpperCase(); let mot=partes.slice(3).join(' '); let v=VALES[cod]; if(v){ v.estado='no entregado'; v.motivo=mot; guardar('vales',VALES); await send(`❌ ${cod} NO entregado.\nMotivo: ${mot}`); } return; }
    if(text.startsWith('pedido ')){
      let resto=rawText.replace(/pedido /i,'').trim(); let partes=resto.split(' - ').map(s=>s.trim());
      if(partes.length<3){ await send(`Usa asi:\npedido J10 x2 - Maria Perez - 56947882 - San Miguel, calle 1 - mensajeria`); return; }
      let prodTxt=partes[0]; let clave=buscarProducto(prodTxt); if(!clave){ await send(`No encontre producto. Escribe: catalogo`); return; }
      let cantMatch=prodTxt.match(/x(\d+)/i)||prodTxt.match(/(\d+)\s*$/); let cant=cantMatch?parseInt(cantMatch[1]):1;
      if(stockTotal(clave)<cant){ await send(`❌ No hay stock de ${clave}. Quedan ${stockTotal(clave)}`); return; }
      let tel=sacarNumero(resto); if(!tel){ await send(`⚠️ *FALTA NUMERO CLIENTE* 👑\nUsa: pedido ${prodTxt} - Maria - 56947882 - San Miguel - mensajeria`); return; }
      let cliente=limpiarNombre(partes[1])||partes[1];
      let partesLimpias=partes.slice(1).map(p=>p.replace(/(53)?\d{8}/g,'').trim()).filter(p=>p.length>0);
      let direccion=partesLimpias[1]||partes[2]||''; let tipoRaw=(partesLimpias[2]||partes[3]||'mensajeria').toLowerCase(); let tipo=tipoRaw.includes('recog')?'recogida':'mensajeria';
      let llave=`${cliente.toLowerCase()}-${clave}`; let ahoraMs=Date.now(); if(ULTIMOS[llave] && (ahoraMs-ULTIMOS[llave])<5*60*1000){ await send(`⚠️ Ya creaste este pedido hace menos de 5 min para ${cliente} - ${clave}.`); return; } ULTIMOS[llave]=ahoraMs;
      let precio=CATALOGO[clave]?.precio||0; let total=precio*cant;
      if(esDeNoche() && !esAdmin && !esSegundo){ COLA.push({cliente,telefonoCliente:tel,producto:CATALOGO[clave].nombre,clave,cant,direccion,tipo,comercial:pushName}); guardar('cola_noche',COLA); await send(`🌙 *GUARDADO EN COLA NOCHE* 👑\nCliente: ${cliente} - ${tel}\nProducto: ${CATALOGO[clave].nombre} x${cant}\nLouis lo confirma a las 8 AM.`); return; }
      let codigo=`KAIROS-${String(CONTADOR).padStart(3,'0')}`; CONTADOR++; guardar('contador',CONTADOR);
      let mens=null; if(tipo==='mensajeria') mens=calcularMensajeria(direccion,[{clave,cant}],resto);
      CLIENTES[tel]={nombre:cliente,telefono:tel,direccion,ultimoPedido:codigo,fecha:hoyCuba()}; guardar('clientes',CLIENTES);
      let vale={codigo,comercial:pushName,cliente,telefonoCliente:tel,direccion,productos:[{clave,nombre:CATALOGO[clave].nombre,cant}],totalUSD:total,mensajeria:mens?.precio||0,detalleMensajeria:mens?.detalle||'',tipo_entrega:tipo,estado:'pendiente',fecha:hoyCuba(),comision:comisionPorClave(clave)*cant,linkEnviado:false};
      VALES[codigo]=vale; guardar('vales',VALES);
      let rLink=await enviarEnlace(sock,vale); if(rLink==='enviado') vale.linkEnviado=true; guardar('vales',VALES);
      await send(`📝 *VALE CREADO ${codigo}* 👑\nCliente: ${cliente}\nTelefono: ${tel}\nProducto: ${CATALOGO[clave].nombre} x${cant}\nDireccion: ${direccion}\nTotal: ${total} USD\nComision: ${vale.comision} CUP\nEntrega: ${tipo} ${mens?`- Mensajeria: ${mens.precio} CUP (${mens.detalle})`:''}\n\n${rLink==='enviado' ? `✅ Ya le mande enlace grupo clientes a ${tel}` : `⚠️ No pude mandar enlace: ${rLink}`}\n\nLouis confirma con:\nOK confirmado ${codigo}`);
      try{ await sock.sendMessage(ADMIN_NUMERO,{text:`🔔 *NUEVO PEDIDO ${codigo}*\nGestor: ${pushName}\nCliente: ${cliente} - ${tel}\n${CATALOGO[clave].nombre} x${cant} - ${total} USD - Comision: ${vale.comision} CUP\nEntrega: ${tipo} - ${direccion}\nEnlace: ${rLink}\n\nConfirma: OK confirmado ${codigo}`}); }catch(e){}
      return;
    }
    if(esSpam(rawText)){ await send(`No se permite enlaces de otros negocios.`); return; }
    if(text.includes('garantia')||text.includes('garantía')){ await send(`Dale, tiene 30 días de garantía en tienda. Si falla, te lo cambiamos 👑`); return; }
    if(text.includes('donde estan')||text.includes('donde están')||text.includes('ubicacion')){ await send(`Estamos en La Habana, domicilio a toda La Habana. Dime tu reparto y te calculo mensajería.`); return; }
    if(text.includes('aceptas')||text.includes('pago')||text.includes('moneda')){ await send(`Sí, aceptamos USD, Euros y CUP al cambio del día y transferencia.`); return; }
    if(text.includes('horario')||text.includes('hora')){ await send(`Estamos de 8 AM a 5 PM. Despues de las 5 te dejamos en cola y te atendemos a las 8 AM.`); return; }
    let duda=buscarDuda(rawText);
    if(duda && duda.respuesta){ await send(`Dale 👑 Eso ya lo preguntaron:\n\n*Pregunta:* ${duda.pregunta}\n*Respuesta:* ${duda.respuesta}`); return; }
    if(duda && !duda.respuesta){ duda.veces=(duda.veces||1)+1; guardar('dudas_base',DUDAS); await send(`Esa duda ya la preguntaron ${duda.veces} veces y aun no tiene respuesta. Se la paso a Louis 👑`); try{ await sock.sendMessage(ADMIN_NUMERO,{text:`❓ *DUDA SIN RESPUESTA - ${duda.veces} veces*\n${duda.pregunta}\nResponde: respuesta: ${duda.pregunta} = [tu respuesta]`}); }catch(e){} return; }
    if(!esHorario()){ await send(`Dale 👑 Estamos cerrados, te atendemos a las 8 AM.\nDejame tu pedido asi:\npedido J10 x2 - Maria 56947882 - San Miguel - mensajeria`); return; }
    await send(`Hola ${pushName} 👑 Soy KAIROS.\nEscribe *menu* para ver todo.\nPara pedir:\npedido J10 x2 - Maria 56947882 - San Miguel - mensajeria`);
  });
}
start();
