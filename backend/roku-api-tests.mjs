import assert from 'node:assert/strict';
let handler,body,quotas=true,captcha=true;
globalThis.Deno={env:{get:k=>({SUPABASE_URL:'https://test.local',SUPABASE_SERVICE_ROLE_KEY:'server-secret',TURNSTILE_ENABLED:'true',TURNSTILE_SECRET_KEY:'captcha-secret'})[k]},serve:f=>handler=f};
globalThis.fetch=async(u,o={})=>{
 if(u.includes('portal_rate_limit'))return Response.json(quotas);
 if(u.includes('siteverify'))return Response.json({success:captcha,hostname:'elvanoqplay.app',action:'playlist'});
 if(u.endsWith('/auth/v1/user'))return Response.json({id:'synthetic-actor'});
 if(u.includes('portal_roku_operation')){body=JSON.parse(o.body);return Response.json({registered:true,deviceCode:body.p_code,platform:'roku',license:{status:'awaiting_activation',can_play:false}});}
 throw Error('Unexpected '+u);
};
await import('./portal-api.ts');
async function call(b,auth=false){const r=await handler(new Request('https://test.local',{method:'POST',headers:{Origin:'https://elvanoqplay.app',...(auth?{Authorization:'Bearer synthetic'}:{})},body:JSON.stringify(b)}));return {status:r.status,data:await r.json()};}
const register={action:'roku-device-register',rokuClientId:'CaseSensitiveClient123',deviceCode:' roku-abcdefgh-12345678 ',deviceName:'Synthetic Roku',platform:'roku'};
let r=await call(register);assert.equal(r.status,200);assert.equal(body.p_code,'ROKU-ABCDEFGH-12345678');assert.equal(body.p_key_hash,null);assert.equal(body.p_client_hash,Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(register.rokuClientId))).toString('hex'));assert(!JSON.stringify(r.data).includes(register.rokuClientId));
let firstHash=body.p_client_hash;await call({...register,rokuClientId:register.rokuClientId.toLowerCase()});assert.notEqual(body.p_client_hash,firstHash);
assert.equal((await call({...register,deviceCode:'bad'})).status,400);assert.equal((await call({...register,rokuClientId:''})).status,400);assert.equal((await call({...register,platform:'android'})).status,400);
r=await call({...register,device_key:'123456'});assert.equal(r.status,200);assert.equal(body.p_key_hash.length,64);assert.equal(body.p_key_hash,Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('123456'))).toString('hex'));assert(!('device_key' in body));
r=await call({action:'roku-license-status',rokuClientId:register.rokuClientId,deviceCode:register.deviceCode});assert.equal(r.status,200);assert.equal(body.p_operation,'status');
assert.equal((await call({action:'roku-playlist-sync',rokuClientId:register.rokuClientId,deviceCode:register.deviceCode})).status,400);
const list={action:'roku-playlist',deviceCode:register.deviceCode,device_key:'123456',name:'Synthetic',kind:'m3u',url:'http://provider.invalid/list',captcha_token:'synthetic'};
assert.equal((await call({...list,captcha_token:undefined})).status,403);captcha=false;assert.equal((await call(list)).status,403);captcha=true;
r=await call(list);assert.equal(r.status,200);assert.equal(body.p_data.origin,'http://provider.invalid');assert.equal(body.p_actor,null);assert.equal(body.p_operation,'playlist');assert(!('p_mac' in body));
assert.equal((await call({action:'roku-device-bind',deviceCode:register.deviceCode,device_key:'123456'})).status,401);
r=await call({action:'roku-device-bind',deviceCode:register.deviceCode,device_key:'123456'},true);assert.equal(r.status,200);assert.equal(body.p_actor,'synthetic-actor');
quotas=false;assert.equal((await call(register)).status,429);
console.log('PASS: Roku validation/normalization, opaque ID hashing without case changes, optional registration key extension, required sync/binding key, CAPTCHA, authenticated staff, rate limits and no legacy identifier payload');
