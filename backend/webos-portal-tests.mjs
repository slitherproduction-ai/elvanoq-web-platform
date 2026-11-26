import assert from 'node:assert/strict';
let handler,links=1,active=true,quota=true,forwarded=0,lastBody;
const key='123456',hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key)).then(b=>Buffer.from(b).toString('hex'));
globalThis.Deno={env:{get:k=>({SUPABASE_URL:'https://test.local',SUPABASE_SERVICE_ROLE_KEY:'secret'})[k]},serve:f=>handler=f};
globalThis.fetch=async(u,o={})=>{
 if(u.includes('portal_rate_limit'))return Response.json(quota);
 if(u.includes('portal_webos_devices?'))return Response.json(Array.from({length:links},()=>({managed_device_id:'test-device',device_key_hash:hash})));
 if(u.includes('portal_managed_devices?'))return Response.json([{id:'test-device',mac:'02:00:00:00:00:99',key_hash:hash,active}]);
 if(u.includes('portal_effective_license'))return Response.json({status:'licensed',can_play:true});
 if(u.includes('/functions/v1/paghiper-payments')){forwarded++;lastBody=JSON.parse(o.body);return Response.json({order:{id:'test-order',mac:lastBody.mac,amount_cents:2490,status:'pending'}});}
 throw Error('Unexpected request '+u);
};
await import('./portal-api.ts');
async function call(body){const r=await handler(new Request('https://test.local',{method:'POST',body:JSON.stringify({action:'webos-checkout',operation:'validate',tv_code:'LG-ABCDEF123456',device_key:key,...body})}));return {status:r.status,data:await r.json()};}
assert.equal((await call({tv_code:'02:00:00:00:00:99'})).status,400);
assert.equal((await call({device_key:'000000'})).status,403);
links=0;assert.equal((await call({})).status,403);links=2;assert.equal((await call({})).status,403);links=1;
active=false;assert.equal((await call({operation:'create'})).status,403);active=true;
quota=false;assert.equal((await call({})).status,429);quota=true;
let r=await call({});assert.equal(r.status,200);assert(r.data.validated);assert.equal(forwarded,0);
r=await call({tv_code:'SM-ABCDEF123456'});assert.equal(r.status,200);assert(r.data.validated);
r=await call({operation:'create',payment_access:'a'.repeat(64),payer_name:'Synthetic',payer_email:'test@example.invalid',payer_cpf_cnpj:'synthetic',consent:true});assert.equal(r.status,200);assert.equal(lastBody.mac,'02:00:00:00:00:99');assert.equal(lastBody.action,'create');assert.equal(r.data.order.tv_code,'LG-ABCDEF123456');assert(!JSON.stringify(r.data).includes('02:00'));assert(!JSON.stringify(r.data).includes(hash));
r=await call({operation:'status',order_id:'test-order',payment_access:'a'.repeat(64)});assert.equal(lastBody.action,'status');assert.equal(lastBody.order_id,'test-order');
console.log('PASS: LG/SM visual code/key, wrong key, missing/ambiguous TV, inactive TV, quota, validation without payment, server-only identity mapping, sanitized checkout and status; no registration/trial calls');
