const http=require('http');const QRCode=require('qrcode');const fs=require('fs');let ULTIMO_QR='';
async function backup_to_github(){try{const token=process.env.GITHUB_TOKEN;const repo=process.env.GITHUB_REPO;if(!token||!repo)return;const datos={catalogo:CATALOGO,admins:[...ADMIN_OK],agotados:[...AGOTADOS],gestores:GESTORES,vales:VALES,contador:CONTADOR,comisiones:COMISIONES,info_productos:INFO_PRODUCTOS,fecha:new Date().toISOString()};const content=Buffer.from(JSON.stringify(datos,null,2)).toString('base64');const url=`https://api.github.com/repos/${repo}/contents/kairos-backup.json`;const headers={'Authorization':`token ${token}`,'Accept':'application/vnd.github.v3+json','User-Agent':'kairos-bot'};let sha=null;const getRes=await fetch(url,{headers});if(getRes.ok){const j=await getRes.json();sha=j.sha;}const body={message:`Backup auto ${new Date().toLocaleString('es-CU')}`,content};if(sha)body.sha=sha;await fetch(url,{method:'PUT',headers,body:JSON.stringify(body)});}catch(e){console.log('Error backup:',e.message);}}
http.createServer(async(req,res)=>{if(req.url==='/qr'){if(!ULTIMO_QR){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<h1>Aun no hay QR, espera 20 seg y recarga</h1><a href="/qr">Recargar</a>');return;}const img=await QRCode.toDataURL(ULTIMO_QR);res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<h1>KAIROS - Escanea el QR</h1><img src="'+img+'" style="width:350px">');return;}if(req.url==='/tasa'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({TASA_BASE,TASA_A1,TASA_A2,TASA_USD,TASA_EUR}));return;}res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});res.end('KAIROS OK - Ve a /qr para vincular');}).listen(process.env.PORT||10000,()=>console.log('Puerto abierto'));
const {default:makeWASocket,useMultiFileAuthState,DisconnectReason}=require('@whiskeysockets/baileys');const pino=require('pino');
const CANAL_KAIROS = 'https://whatsapp.com/channel/0029Vb6XwiiLo4hiv8RTIi0w';
const LOUIS_JID='5356947882@s.whatsapp.net';
const GRUPO_INFO = '120363414152883390@g.us';
const LOUIS_LID='132624865579031@lid';
const GRUPO_LOCAL='120363417801594416@g.us';
const GRUPO_MENSAJERIA='120363419483851412@g.us';
const DIRECCIONES={1:'Calle 1ra / 2da y 4ta No.23308. Altura del Mirador',2:'Calle 2da #18532 / E y D. Luyano Moderno, San Miguel del Padron',3:'En espera de direccion'};

let NUEVO_PRODUCTO = {};
let CANAL_LINK = "https://whatsapp.com/channel/0029Vb6XwiiLo4hiv8RTIi0w";
let CATALOGO={};let AGOTADOS=new Set();let ADMIN_OK=new Set();let GESTORES={};let COMISIONES={};let INFO_PRODUCTOS={};

try{if(fs.existsSync('catalogo.json'))CATALOGO=JSON.parse(fs.readFileSync('catalogo.json'));}catch(e){}
try{if(fs.existsSync('admins.json'))JSON.parse(fs.readFileSync('admins.json')).forEach(id=>ADMIN_OK.add(id));}catch(e){}
ADMIN_OK.add(LOUIS_JID);ADMIN_OK.add(LOUIS_LID);
try{if(fs.existsSync('agotados.json'))JSON.parse(fs.readFileSync('agotados.json')).forEach(x=>AGOTADOS.add(x));}catch(e){}
try{if(fs.existsSync('gestores.json'))GESTORES=JSON.parse(fs.readFileSync('gestores.json'));}catch(e){}
try{if(fs.existsSync('comisiones.json'))COMISIONES=JSON.parse(fs.readFileSync('comisiones.json'));}catch(e){}
try{if(fs.existsSync('info-productos.json'))INFO_PRODUCTOS=JSON.parse(fs.readFileSync('info-productos.json'));}catch(e){}
function guardarTodo(){try{fs.writeFileSync('catalogo.json',JSON.stringify(CATALOGO));}catch(e){}try{fs.writeFileSync('admins.json',JSON.stringify([...ADMIN_OK]));}catch(e){}try{fs.writeFileSync('agotados.json',JSON.stringify([...AGOTADOS]));}catch(e){}try{fs.writeFileSync('gestores.json',JSON.stringify(GESTORES));}catch(e){}try{fs.writeFileSync('comisiones.json',JSON.stringify(COMISIONES));}catch(e){}try{fs.writeFileSync('info-productos.json',JSON.stringify(INFO_PRODUCTOS));}catch(e){}backup_to_github();}

let PEDIDOS={};let VALES={};let CONTADOR=0;let ACTUALIZANDO={};let PIDIENDO_NOMBRE=new Set();let ELIGIENDO_ALMACEN=new Set();
let PENDIENTES_INFO={};
let FUTURAS_COMPRAS={};

try{ if(fs.existsSync('futuras.json')) FUTURAS_COMPRAS = JSON.parse(fs.readFileSync('futuras.json')); }catch(e){}
function guardarFuturas(){ try{ fs.writeFileSync('futuras.json', JSON.stringify(FUTURAS_COMPRAS)); }catch(e){} try{ backup_to_github(); }catch(e){} }

// ==== TASA - SOLO UNA VEZ DECLARADA ====
let TASA_BASE=0;let TASA_A1=0;let TASA_A2=0;let TASA_USD=0;let TASA_EUR=0;

async function actualizarTasa() {
  console.log('🔄 Buscando tasa ACTUAL...', new Date().toLocaleTimeString());
  let nuevaTasa = null;
  let fuente = '';
  try {
    const r = await fetch('https://api.eltoque.com/v1/trading_rates/current', { headers: { 'Accept': 'application/json' } });
    const j = await r.json();
    const usd = j?.trading_rates?.find(x => x.code === 'USD')?.rate;
    const eur = j?.trading_rates?.find(x => x.code === 'EUR')?.rate;
    if (usd) { nuevaTasa = parseFloat(usd); TASA_EUR = eur ? parseFloat(eur) : nuevaTasa; fuente = 'El Toque'; }
  } catch(e) { console.log('El Toque falló:', e.message); }
  if (!nuevaTasa) {
    try {
      const r = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent('https://cubadivisas.com'));
      const html = await r.text();
      let limpio = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      let m = limpio.match(/CUP\s*\/\s*USD\s*([0-9]{3,4})[,.]([0-9]{2})/) || limpio.match(/USD\s*=\s*([0-9]{3,4})[,.]([0-9]{2})/);
      if (m) { nuevaTasa = parseFloat(m[1] + '.' + (m[2] || '00')); fuente = 'CubaDivisa'; }
    } catch(e) { console.log('CubaDivisa falló:', e.message); }
  }
  if (nuevaTasa) {
    TASA_BASE = nuevaTasa;
    TASA_USD = nuevaTasa;
    TASA_A1 = TASA
