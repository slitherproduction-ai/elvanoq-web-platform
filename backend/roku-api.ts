// Roku identities never enter legacy identity storage. Raw client IDs are hashed once, server-side.
export async function handleRoku(req:Request,b:any,c:any){
 const {db,hash,ApiError,base,service,text,http}=c;
 const action=b.action;
 function code(value:any){if(typeof value!=='string'||value.length>64)throw new ApiError(400,'Informe o código exibido na Roku.');const v=value.replace(/\s/g,'').toUpperCase();if(!/^ROKU-[A-Z0-9]{8}-[A-Z0-9]{8}$/.test(v))throw new ApiError(400,'Use o código Roku no formato ROKU-XXXXXXXX-XXXXXXXX.');return v;}
 function client(value:any){if(typeof value!=='string'||!value.length||value.length>512||/[\x00-\x1f\x7f]/.test(value)||!value.trim())throw new ApiError(400,'Identificação Roku inválida.');return value;}
 function key(value:any,required=true){if(value===undefined&&!required)return null;if(typeof value!=='string'||!/^\d{6,128}$/.test(value))throw new ApiError(400,'Informe a chave numérica exibida na Roku.');return value;}
 const native=['roku-device-register','roku-license-status','roku-playlist-sync'].includes(action);
 const admin=['roku-device-bind','roku-device-update','roku-device-assign','roku-device-rebind','roku-license-renew','roku-license-set-lifetime'].includes(action);
 const visual=native||action==='roku-playlist'||action==='roku-device-bind'?code(b.deviceCode):null;
 const clientHash=native?await hash(client(b.rokuClientId)):null;
 const quota=await db('rpc/portal_rate_limit','POST',{p_bucket:await hash('roku:'+action+':'+(clientHash||visual||String(b.id||''))),p_limit:action==='roku-playlist'?30:60,p_seconds:900});
 if(quota!==true)throw new ApiError(429,'Muitas tentativas. Aguarde alguns minutos.');
 let actor=null;
 if(admin){const bearer=req.headers.get('authorization');if(!bearer?.startsWith('Bearer '))throw new ApiError(401,'Entre para continuar.');const response=await fetch(base+'/auth/v1/user',{headers:{apikey:service,Authorization:bearer}});if(!response.ok)throw new ApiError(401,'Sessão expirada. Entre novamente.');actor=(await response.json()).id;}
 const deviceKey=key(b.device_key??b.deviceKey,action==='roku-playlist-sync'||action==='roku-playlist'||action==='roku-device-bind'||action==='roku-device-rebind');
 let operation:any,data:any={};
 if(action==='roku-device-register'){
  if(b.platform!=='roku')throw new ApiError(400,'Plataforma Roku inválida.');operation='register';data={name:text(b.deviceName,100)};
 }else if(action==='roku-license-status')operation='status';
 else if(action==='roku-playlist-sync')operation='sync';
 else if(action==='roku-playlist'){
  const kind=b.kind;if(!['m3u','xtream'].includes(kind))throw new ApiError(400,'Tipo de lista inválido.');
  const credentials=kind==='m3u'?{url:http(b.url)}:{host:http(b.host),username:text(b.username,256),password:text(b.password,1024)};
  operation='playlist';data={name:text(b.name,100),kind,credentials,origin:new URL(kind==='m3u'?credentials.url:credentials.host).origin};
 }else if(action==='roku-device-bind')operation='bind';
 else if(admin){
  const id=text(b.id,36);if(!/^[a-f0-9-]{36}$/i.test(id))throw new ApiError(400,'Dispositivo Roku inválido.');
  const operations:any={'roku-device-update':'update','roku-device-assign':'assign','roku-device-rebind':'rebind','roku-license-renew':'renew','roku-license-set-lifetime':'lifetime'};
  operation='admin';data={id,operation:operations[action]};
  if(action==='roku-device-update'){if(typeof b.active==='boolean')data.active=b.active;if('name' in b)data.name=text(b.name,100);if(!('active' in data)&&!('name' in data))throw new ApiError(400,'Nenhuma alteração informada.');}
  if(action==='roku-device-assign'){if(b.reseller_id!==null&&!/^[a-f0-9-]{36}$/i.test(b.reseller_id||''))throw new ApiError(400,'Responsável inválido.');data.reseller_id=b.reseller_id;}
  if(action==='roku-device-rebind'||action==='roku-license-set-lifetime'){data.reason=text(b.reason,500);if(data.reason.length<5)throw new ApiError(400,'Informe o motivo com pelo menos cinco caracteres.');}
  if(action==='roku-device-rebind')data.restore=b.restore===true;
  if(action==='roku-license-set-lifetime'){if(typeof b.lifetime!=='boolean')throw new ApiError(400,'Informe o tipo de licença.');data.lifetime=b.lifetime;}
  if(action==='roku-license-renew'){data.payment_reference=text(b.payment_reference,120);data.amount_cents=b.amount_cents;if(data.payment_reference.length<8||!Number.isSafeInteger(data.amount_cents)||data.amount_cents<=0||data.amount_cents>2147483647)throw new ApiError(400,'Referência ou valor inválidos.');}
 }else throw new ApiError(400,'Operação Roku inválida.');
 const result=await db('rpc/portal_roku_operation','POST',{p_operation:operation,p_client_hash:clientHash,p_code:visual,p_key_hash:deviceKey?await hash(deviceKey):null,p_actor:actor,p_data:data});return {...result,...(result.license?{activation_status:result.license.status,activated:result.license.can_play===true}:{})};
}
