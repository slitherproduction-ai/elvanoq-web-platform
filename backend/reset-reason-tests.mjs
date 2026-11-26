import assert from 'node:assert/strict';
let handler,role='admin',needsPassword=false,stored=null,claims=[];
globalThis.Deno={env:{get:k=>k==='SUPABASE_URL'?'https://test.invalid':k==='TURNSTILE_ENABLED'?'false':'synthetic'},serve:f=>handler=f};
globalThis.fetch=async(u,o={})=>{
 if(u.endsWith('/auth/v1/user'))return Response.json({id:'synthetic-actor'});
 if(u.includes('portal_staff?'))return Response.json([{role,active:true,must_change_password:needsPassword}]);
 if(u.includes('portal_rate_limit'))return Response.json(true);
 if(u.includes('portal_native_binding_claim')){claims.push(JSON.parse(o.body));return Response.json(false);}
 if(u.includes('portal_device_rebind_platform')){stored=JSON.parse(o.body);return Response.json({rebound:true});}
 if(u.includes('portal_roku_operation')){stored=JSON.parse(o.body);if(role!=='admin'&&stored.p_operation==='admin')return Response.json({message:'ROKU_FORBIDDEN'},{status:400});return Response.json({registered:true,license:{status:'active',can_play:true}});}
 throw Error('Unexpected request');
};
await import('./edge/portal-control/index.ts');
const id='11111111-1111-4111-8111-111111111111';
async function call(b,auth=true){const r=await handler(new Request('https://test.invalid',{method:'POST',headers:auth?{Authorization:'Bearer synthetic'}:{},body:JSON.stringify(b)}));return {status:r.status,data:await r.json()};}
let r=await call({action:'device-rebind',id,reason:'Troca de instalação'});assert.equal(r.status,200);assert.equal(stored.p_key_hash,'0'.repeat(64));assert.equal(stored.p_restore,false);assert.equal(stored.p_actor,'synthetic-actor');assert.equal(stored.p_reason,'Troca de instalação');assert(!JSON.stringify(r.data).includes(stored.p_key_hash));assert(!('device_key' in r.data));
assert.equal((await call({action:'device-rebind',id,reason:'abc'})).status,400);assert.equal((await call({action:'device-rebind',id,reason:'x'.repeat(501)})).status,400);
assert.equal((await call({action:'device-rebind',id,reason:'Motivo válido'},false)).status,401);
role='reseller';assert.equal((await call({action:'device-rebind',id,reason:'Motivo válido'})).status,403);role='admin';needsPassword=true;assert.equal((await call({action:'device-rebind',id,reason:'Motivo válido'})).status,403);needsPassword=false;
r=await call({action:'roku-device-rebind',id,reason:'Troca de instalação'});assert.equal(r.status,200);assert.equal(stored.p_key_hash,'0'.repeat(64));assert.equal(stored.p_data.restore,false);assert.equal(stored.p_data.operation,'rebind');assert.equal(stored.p_actor,'synthetic-actor');
role='reseller';assert.equal((await call({action:'roku-device-rebind',id,reason:'Motivo válido'})).status,403);role='admin';
await call({action:'roku-license-status',rokuClientId:'native-test',deviceCode:'ROKU-ABCDEFGH-12345678',device_key:'123456'},false);assert.equal(claims.at(-1).p_platform,'roku');assert.equal(claims.at(-1).p_identity.length,64);assert(!JSON.stringify(claims.at(-1)).includes('native-test'));
console.log('PASS: reason-only Android/LG reset payload; Roku reset; admin-only; initial-password gate; reason limits; no key exposed; no implicit reactivation; native identity hashing.');
