import assert from 'node:assert/strict';
let handler,role='admin',mustChange=false,active=true,existingUser=false,badPassword=false,calls=[];
globalThis.Deno={env:{get:k=>k==='SUPABASE_URL'?'https://test.local':'test-service'},serve:f=>handler=f};
globalThis.fetch=async(u,o={})=>{const body=o.body?JSON.parse(o.body):null;calls.push({u,method:o.method,body});let d=[];let status=200;
if(u.endsWith('/auth/v1/user')&&o.method==='PUT')d={id:'actor',email:'actor@example.invalid'};
else if(u.endsWith('/auth/v1/user'))d={id:'actor',email:'actor@example.invalid'};
else if(u.includes('/auth/v1/token')){status=badPassword?400:200;d={user:{id:'actor'},access_token:'reauth-token',refresh_token:'refresh',expires_in:3600};}
else if(u.includes('/auth/v1/admin/users')&&o.method==='POST')d={id:'new-user'};
else if(u.includes('/auth/v1/admin/users'))d={users:existingUser?[{id:'new-user',email:'partner@example.invalid'}]:[]};
else if(u.includes('/portal_staff?user_id=eq.actor'))d=[{role,active,must_change_password:mustChange,display_name:'Test'}];
else if(u.includes('/portal_staff'))d=[];
else if(u.includes('/rpc/portal_device_archive'))d={removed:body.p_remove};
else if(u.includes('/portal_managed_devices'))d=[];
else if(u.includes('/portal_license_audit')||u.includes('/portal_pix_orders'))d=[];
else throw new Error('Unexpected call '+u);
return new Response(JSON.stringify(d),{status});};
const fetchBeforeRateLimit=globalThis.fetch;globalThis.fetch=async(u,o={})=>String(u).includes('rpc/portal_rate_limit')?new Response('true'):fetchBeforeRateLimit(u,o);await import('./portal-api.ts');
async function call(body){const r=await handler(new Request('https://test.local',{method:'POST',headers:{authorization:'Bearer session','Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:r.status,data:await r.json()};}
let r=await call({action:'device-remove',id:'10000000-0000-4000-8000-000000000001',p_actor:'attacker'});assert.equal(r.status,200);assert.equal(calls.at(-1).body.p_actor,'actor');
role='reseller';assert.equal((await call({action:'staff-save',email:'partner@example.invalid',name:'Partner'})).status,403);
role='admin';r=await call({action:'staff-save',email:'partner@example.invalid',name:'Partner'});assert.equal(r.status,200);assert(r.data.initial_password.length>=20);const created=calls.find(c=>c.u.endsWith('/auth/v1/admin/users')&&c.method==='POST');assert.equal(created.body.password,r.data.initial_password);assert(calls.some(c=>c.body?.must_change_password===true));
mustChange=true;r=await call({action:'overview'});assert.equal(r.data.must_change_password,true);assert.deepEqual(r.data.devices,[]);assert.equal((await call({action:'device-remove',id:'10000000-0000-4000-8000-000000000001'})).status,403);
assert.equal((await call({action:'account-update',name:'Name',email:'actor@example.invalid'})).status,400);
mustChange=false;badPassword=true;assert.equal((await call({action:'account-update',name:'Name',email:'actor@example.invalid',current_password:'wrong',new_password:'New-password-test!'})).status,403);
badPassword=false;r=await call({action:'account-update',name:'Changed',email:'actor@example.invalid',current_password:'old-test-password',new_password:'New-password-test!',user_id:'someone-else',role:'admin'});assert.equal(r.status,200);const put=calls.find(c=>c.u.endsWith('/auth/v1/user')&&c.method==='PUT');assert(put);assert(!('role' in put.body));assert(!('user_id' in put.body));assert(calls.some(c=>c.u.includes('portal_staff?user_id=eq.actor')&&c.body?.display_name==='Changed'));
console.log('PASS: removal actor, partner creation permissions, generated password, first-login gate, own-account updates, reauthentication and no role escalation');

const previousFetch=globalThis.fetch;let devicePatch;
globalThis.fetch=async(u,o={})=>{if(String(u).includes('portal_managed_devices?')&&o.method==='GET')return new Response(JSON.stringify([{id:'10000000-0000-4000-8000-000000000001',reseller_id:'actor',archived_at:null}]));if(String(u).includes('portal_managed_devices?')&&o.method==='PATCH'){devicePatch=JSON.parse(o.body);return new Response(JSON.stringify([]));}return previousFetch(u,o);};
r=await call({action:'device-update',id:'10000000-0000-4000-8000-000000000001',name:'TV renomeada'});assert.equal(r.status,200);assert.equal(devicePatch.display_name,'TV renomeada');assert.deepEqual(Object.keys(devicePatch),['display_name']);console.log('PASS: device name edit preserves identity and license');
