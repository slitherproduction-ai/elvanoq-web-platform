import {playlistConnection} from './playlist-connection.ts';
export function partnerPlan(b:any,c:any){
 const {ApiError,text}=c;const name=text(b.plan_name,80),type=b.plan_type;
 if(!['annual','lifetime','custom'].includes(type))throw new ApiError(400,'Plano da parceria inválido.');
 const limit=b.device_limit===null||b.device_limit===''?null:b.device_limit;
 if(limit!==null&&(!Number.isInteger(limit)||limit<1||limit>1000000))throw new ApiError(400,'Informe um limite inteiro entre 1 e 1.000.000.');
 const expires=type==='annual'?b.plan_expires_at:null;
 if(type==='annual'&&(typeof expires!=='string'||!Number.isFinite(Date.parse(expires))))throw new ApiError(400,'Informe a validade do plano anual.');
 return {p_name:name,p_type:type,p_expires:expires,p_limit:limit};
}
export async function staffDeviceAction(b:any,c:any){
 const {db,ApiError,text,http,userId}=c;
 if(!/^[a-f0-9-]{36}$/i.test(b.id||'')||!['managed','roku'].includes(b.platform))throw new ApiError(400,'Dispositivo inválido.');
 const operation=({'staff-device-renew':'renew','staff-device-delete':'delete','staff-playlist-save':'playlist'} as any)[b.action];
 const bucket=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('staff-device:'+userId)))).map(v=>v.toString(16).padStart(2,'0')).join('');
 const quota=await db('rpc/portal_rate_limit','POST',{p_bucket:bucket,p_limit:90,p_seconds:900});
 if(quota!==true)throw new ApiError(429,'Muitas tentativas. Aguarde alguns minutos.');
 let data:any={};
 if(operation==='renew'){
  data.reason=text(b.reason,500);if(data.reason.length<5||!/^[a-f0-9-]{36}$/i.test(b.request_id||''))throw new ApiError(400,'Informe o motivo da renovação.');data.request_id=b.request_id;
 }else if(operation==='playlist'){
  if(!['m3u','xtream'].includes(b.kind))throw new ApiError(400,'Tipo de lista inválido.');
  const converted=playlistConnection(b.kind,b.kind==='m3u'?{url:http(b.url)}:{host:http(b.host),username:text(b.username,256),password:text(b.password,1024)});
  data={name:text(b.name,100),...converted,origin:new URL(converted.kind==='m3u'?converted.credentials.url:converted.credentials.host).origin};
 }
 const result=await db('rpc/portal_staff_device_operation','POST',{p_actor:userId,p_operation:operation,p_platform:b.platform,p_id:b.id,p_data:data});
 return {message:operation==='renew'?(result.duplicate?'Esta renovação já foi registrada.':'Licença renovada por mais um ano.'):operation==='delete'?'Dispositivo excluído definitivamente.':'Lista salva. Abra o aplicativo e sincronize as Listas Salvas.',...result};
}