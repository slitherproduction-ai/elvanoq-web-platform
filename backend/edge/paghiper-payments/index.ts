// Server-only PagHiper credentials. No payer documents are persisted here.
const base=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const apiKey=Deno.env.get('PAGHIPER_API_KEY'),token=Deno.env.get('PAGHIPER_TOKEN');
const enabled=Deno.env.get('PAGHIPER_ENABLED')==='true'&&!!apiKey&&!!token;
const allowed=new Set(['https://elvanoq-play-portal.slitherproduction.chatgpt.site','https://elvanoqplay.app']);
class Failure extends Error{constructor(public status:number,message:string){super(message)}}
async function db(path:string,method='GET',body?:unknown){const r=await fetch(base+'/rest/v1/'+path,{method,headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});if(!r.ok){const e=await r.json().catch(()=>({}));const known:Record<string,[number,string]>={ROKU_IDENTITY:[403,'Código ou chave Roku inválidos, ou TV indisponível. Abra primeiro o aplicativo na Roku.'],ROKU_PAYMENT_SESSION_CONFLICT:[409,'Já existe uma cobrança para esta TV em outro navegador. Consulte o responsável.'],CODE_ACCESS_ACTIVE:[409,'Este dispositivo já tem acesso pelo código válido. Não é necessário pagar uma licença individual.'],PAYMENT_SESSION_CONFLICT:[409,'Já existe uma cobrança para este MAC em outro navegador. Consulte o responsável.'],DEVICE_NOT_ACTIVE:[403,'Dispositivo desativado ou não cadastrado.'],LIFETIME_DEVICE:[409,'Este dispositivo já possui licença vitalícia.'],RATE_LIMIT:[429,'Aguarde um minuto antes de gerar outra cobrança.'],PAYMENT_MISMATCH:[409,'Os dados do pagamento não correspondem ao pedido.']};if(known[e.message])throw new Failure(...known[e.message]);throw new Failure(502,'Não foi possível consultar o pagamento.');}return r.json();}
async function provider(path:string,body:Record<string,unknown>){const r=await fetch('https://pix.paghiper.com/invoice/'+path+'/',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({apiKey,token,...body}),signal:AbortSignal.timeout(20000)});const data=await r.json().catch(()=>null);const value=data?.status_request||data?.pix_create_request;if(!r.ok||value?.result!=='success')throw new Failure(502,'A PagHiper não confirmou a operação. Tente consultar novamente ou contate o responsável.');return value;}
const digest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('');
function field(v:unknown,max=255){if(typeof v!=='string'||!v.trim()||v.length>max)throw new Failure(400,'Confira os campos informados.');return v.trim();}
function paymentIdentity(b:any){const raw=field(b.mac,30).replace(/[^0-9a-f]/gi,'').toUpperCase();if(!/^[0-9A-F]{12}$/.test(raw))throw new Failure(400,'Informe os 12 caracteres do MAC do aplicativo.');const access=field(b.payment_access,64);if(!/^[0-9a-f]{64}$/i.test(access))throw new Failure(400,'Sessão de pagamento inválida. Recarregue a página.');return {mac:raw.match(/.{2}/g)!.join(':'),access};}
function publicOrder(o:any){return {id:o.id,...(o.device_code?{platform:'roku',deviceCode:o.device_code}:{mac:o.mac}),status:o.status,amount_cents:o.amount_cents,emv:o.emv||null,qrcode_base64:o.qrcode_base64||null,due_date:o.due_date||null,expires_at:o.expires_at||null,applied_at:o.applied_at||null,license_until:o.license_until||null};}
function cents(v:unknown){return /^\d+$/.test(String(v))&&Number.isSafeInteger(Number(v))?Number(v):-1;}
async function applyCurrent(o:any,current:any,verifiedPaid?:number){
 if(cents(current.value_cents)!==o.amount_cents)throw new Failure(409,'Valor divergente.');
 const status=current.status;if(!['pending','processing','paid','completed','canceled','refunded'].includes(status))throw new Failure(502,'Status de pagamento desconhecido.');
 const paid=['paid','completed'].includes(status)?(verifiedPaid??cents(current.value_cents_paid??current.value_cents)):0;
 if(['paid','completed'].includes(status)&&paid!==o.amount_cents)throw new Failure(409,'Pagamento ainda não confirmado integralmente.');
 return db(o.device_code?'rpc/portal_roku_pix_apply':'rpc/portal_pix_apply','POST',{p_id:o.id,p_transaction:o.transaction_id,p_status:status,p_amount:o.amount_cents,p_paid:paid});
}
async function settle(o:any,n:any){
 if(n.transaction_id!==o.transaction_id||n.order_id!==o.id||cents(n.value_cents)!==o.amount_cents)throw new Failure(409,'Os dados da confirmação não correspondem ao pedido.');
 const current=await provider('status',{transaction_id:o.transaction_id});
 if(['paid','completed'].includes(current.status)&&(!['paid','completed'].includes(n.status)||cents(n.value_cents_paid)!==o.amount_cents))throw new Failure(409,'Pagamento ainda não confirmado integralmente.');
 return applyCurrent(o,current,['paid','completed'].includes(current.status)?cents(n.value_cents_paid):0);
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'',webhook=new URL(req.url).pathname.endsWith('/webhook');
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(allowed.has(origin)?{'Access-Control-Allow-Origin':origin}:{}),'Access-Control-Allow-Headers':'content-type,apikey','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const reply=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{...headers,...(status===429?{'Retry-After':'900'}:{})}});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 try{
  if(req.method!=='POST')throw new Failure(405,'Método não permitido.');
  if(origin&&!allowed.has(origin))throw new Failure(403,'Origem não autorizada.');
  const raw=await req.text();if(raw.length>12000)throw new Failure(413,'Dados muito extensos.');
  let b:any;try{b=webhook?Object.fromEntries(new URLSearchParams(raw)):JSON.parse(raw);}catch{throw new Failure(400,'Solicitação inválida.');}
  if(!b||typeof b!=='object'||Array.isArray(b))throw new Failure(400,'Solicitação inválida.');
  if(!webhook&&b.action==='config')return reply({enabled:!!enabled,amount_cents:2490});
  if(!enabled)throw new Failure(503,'O pagamento Pix está aguardando configuração. Entre em contato com o responsável.');
  if(webhook){
   if(b.apiKey!==apiKey||b.source_api!=='https://pix.paghiper.com')throw new Failure(403,'Notificação inválida.');
   const transaction=field(b.transaction_id,64),notification=field(b.notification_id,128);
   let rows=await db('portal_pix_orders?transaction_id=eq.'+encodeURIComponent(transaction)+'&select=*');
   if(!rows[0])rows=await db('portal_roku_pix_orders?transaction_id=eq.'+encodeURIComponent(transaction)+'&select=*');
   if(!rows[0])throw new Failure(503,'Pedido ainda não localizado.');
   const verified=await provider('notification',{transaction_id:transaction,notification_id:notification});
   await settle(rows[0],verified);return reply({received:true});
  }
  const roku=b.platform==='roku';
  let mac:string|undefined,access:string,deviceId:string|undefined,deviceCode:string|undefined,keyHash:string|undefined;
  if(roku){
   if('mac' in b||'MAC' in b)throw new Failure(400,'Informe somente o código e a chave da TV Roku.');
   deviceCode=field(b.deviceCode,22).toUpperCase();
   if(deviceCode.length!==22||!/^ROKU-[A-Z0-9]{8}-[A-Z0-9]{8}$/.test(deviceCode))throw new Failure(400,'Use ROKU-XXXXXXXX-XXXXXXXX.');
   const key=field(b.device_key,128);if(!/^[A-Za-z0-9-]{6,128}$/.test(key))throw new Failure(400,'Informe a chave exibida na TV Roku.');
   access=field(b.payment_access,64);if(!/^[0-9a-f]{64}$/i.test(access))throw new Failure(400,'Sessão de pagamento inválida.');
   const permitted=await db('rpc/portal_rate_limit','POST',{p_bucket:await digest('roku-checkout:'+deviceCode),p_limit:90,p_seconds:900});if(permitted!==true)throw new Failure(429,'Muitas tentativas. Aguarde alguns minutos.');
   keyHash=await digest(key);
   const devices=await db('portal_roku_devices?device_code=eq.'+encodeURIComponent(deviceCode)+'&select=id,key_hash,active');
   const device=devices[0];if(!device?.active||device.key_hash!==keyHash)throw new Failure(403,'Código ou chave Roku inválidos, ou TV indisponível. Abra primeiro o aplicativo na Roku.');
   deviceId=device.id;
   if(b.action==='validate')return reply({validated:true,platform:'roku',deviceCode,license:await db('rpc/portal_roku_license','POST',{p_id:deviceId})});
  }else({mac,access}=paymentIdentity(b));
  const orders=roku?'portal_roku_pix_orders':'portal_pix_orders';
  const quota=await db('rpc/portal_rate_limit','POST',{p_bucket:await digest('payment:'+b.action+':'+(roku?'roku:'+deviceCode:mac)),p_limit:b.action==='create'?3:90,p_seconds:b.action==='create'?600:900});
  if(quota!==true)throw new Failure(429,'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.');

  const accessHash=await digest(access);
  if(b.action==='create'){
   const name=field(b.payer_name),email=field(b.payer_email),cpf=field(b.payer_cpf_cnpj,25).replace(/\D/g,'');
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||![11,14].includes(cpf.length))throw new Failure(400,'Confira o e-mail e CPF/CNPJ do pagador.');
   if(b.consent!==true)throw new Failure(400,'Autorize o envio dos dados à PagHiper para emitir o Pix.');
   const o=roku?await db('rpc/portal_roku_pix_reserve','POST',{p_id:deviceId,p_key_hash:keyHash,p_access_hash:accessHash}):await db('rpc/portal_pix_reserve_public','POST',{p_mac:mac,p_access_hash:accessHash});
   if(!o.new_order){if(o.status==='creating'||o.status==='unknown')throw new Failure(409,'Já existe uma emissão em conferência. Contate o responsável antes de tentar outra cobrança.');return reply({order:publicOrder(o)});}
   let created;
   try{created=await provider('create',{order_id:o.id,payer_name:name,payer_email:email,payer_cpf_cnpj:cpf,notification_url:base+'/functions/v1/paghiper-payments/webhook',days_due_date:'0',minutes_due_date:'30',items:[{item_id:'elvanoq-annual',description:'Licença anual ELVANOQ Play por dispositivo',quantity:'1',price_cents:String(o.amount_cents)}]});}
   catch(e){await db(orders+'?id=eq.'+o.id,'PATCH',{status:'unknown'});throw e;}
   // Do not retry an ambiguous emission automatically: it could create a second invoice.
   if(created.order_id!==o.id||cents(created.value_cents)!==o.amount_cents||!created.transaction_id||!created.pix_code?.emv)throw new Failure(502,'Emissão em conferência. Contate o responsável.');
   const rows=await db(orders+'?id=eq.'+o.id,'PATCH',{transaction_id:created.transaction_id,status:'pending',emv:created.pix_code.emv,qrcode_base64:created.pix_code.qrcode_base64||null,due_date:created.due_datetime||created.due_date});
   return reply({order:publicOrder(rows[0])});
  }
  if(b.action==='status'){
   const id=field(b.order_id,36);if(!/^[0-9a-f-]{36}$/i.test(id))throw new Failure(400,'Pedido inválido.');
   const rows=await db(orders+'?id=eq.'+id+(roku?'&device_id=eq.'+deviceId:'&mac=eq.'+encodeURIComponent(mac!))+'&access_hash=eq.'+accessHash+'&select=*');const o=rows[0];if(!o)throw new Failure(404,'Pedido não encontrado.');
   if(o.transaction_id&&!['refunded','canceled'].includes(o.status)&&(!o.checked_at||Date.now()-Date.parse(o.checked_at)>15000)){
    const current=await provider('status',{transaction_id:o.transaction_id});
    const updated=await applyCurrent(o,current);return reply({order:publicOrder(updated)});
   }
   return reply({order:publicOrder(o)});
  }
  throw new Failure(400,'Operação inválida.');
 }catch(e){return reply({message:e instanceof Failure?e.message:'Serviço indisponível. Consulte novamente antes de gerar outra cobrança.'},e instanceof Failure?e.status:502);}
});

