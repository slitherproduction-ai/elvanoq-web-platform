import assert from 'node:assert/strict';
let handler,role='admin',pending=false,deviceActive=true,found=true,owner=null,collision=false,calls=[];
const id='00000000-0000-4000-8000-000000000001',key='123456';
const digest=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))).toString('hex');
globalThis.Deno={env:{get:k=>({SUPABASE_URL:'https://test.local',SUPABASE_SERVICE_ROLE_KEY:'test-service'})[k]},serve:f=>handler=f};
globalThis.fetch=async(u,o={})=>{
 const body=o.body?JSON.parse(o.body):null;calls.push({u,body,method:o.method});let d=[];
 if(u.endsWith('/auth/v1/user'))d={id:'actor',email:'test@example.invalid'};
 else if(u.includes('portal_staff?user_id=eq.actor'))d=[{role,active:true,must_change_password:pending}];
 else if(u.includes('portal_rate_limit'))d=true;
 else if(u.includes('portal_webos_devices?'))d=found?[{managed_device_id:id,device_key_hash:digest}]:[];
 else if(u.includes('portal_managed_devices?'))d=o.method==='PATCH'?(collision?[]:[{id}]):[{id,key_hash:digest,active:deviceActive,reseller_id:owner}];
 else throw Error('Unexpected request '+u);
 return Response.json(d);
};
await import('./edge/portal-control/index.ts');
async function call(payload,auth=true){const r=await handler(new Request('https://test.local',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{authorization:'Bearer test'}:{})},body:JSON.stringify(payload)}));return {status:r.status,data:await r.json()};}
const payload={action:'webos-device-bind',tv_code:'LG-ABCDEF123456',device_key:key,name:'TV de teste',reseller_id:null};
assert.equal((await call(payload,false)).status,401);
pending=true;assert.equal((await call(payload)).status,403);pending=false;
for(const tv_code of ['LG-ABCDEF123456','SM-ABCDEF123456','IOS-ABCDEF123456']){
 calls=[];const r=await call({...payload,tv_code});assert.equal(r.status,200);
 const lookup=calls.find(c=>c.u.includes('portal_webos_devices?'));assert(lookup.u.includes('platform=eq.'+(tv_code.startsWith('IOS-')?'ios-msx':tv_code.startsWith('SM-')?'samsung-msx':'webos')));
 const patch=calls.find(c=>c.method==='PATCH');assert.deepEqual(patch.body,{display_name:'TV de teste',reseller_id:null});assert(patch.u.includes('key_hash=eq.'+digest));
 assert(!JSON.stringify(r.data).includes(digest));
}
for(const tv_code of ['SM-BAD','IOS-ABCDE','IOS-ABCDEF12345Z'])assert.equal((await call({...payload,tv_code})).status,400);
assert.equal((await call({...payload,device_key:'654321'})).status,403);
found=false;assert.equal((await call(payload)).status,403);found=true;
deviceActive=false;assert.equal((await call(payload)).status,403);deviceActive=true;
role='reseller';assert.equal((await call(payload)).status,403);
owner='actor';assert.equal((await call(payload)).status,200);
collision=true;assert.equal((await call(payload)).status,409);
console.log('PASS: auth, first access, LG/Samsung visual code and key, platform isolation, missing/blocked devices, reseller ownership, concurrent key check, no license/key/trial mutations.');
