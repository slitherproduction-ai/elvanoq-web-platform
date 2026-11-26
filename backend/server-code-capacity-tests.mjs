import assert from 'node:assert/strict';
let handler,role='admin',saved,failure=false;
globalThis.Deno={env:{get:k=>k==='SUPABASE_URL'?'https://test.invalid':k==='TURNSTILE_ENABLED'?'false':'synthetic'},serve:f=>handler=f};
globalThis.fetch=async(u,o={})=>{
 if(u.endsWith('/auth/v1/user'))return Response.json({id:'synthetic-actor'});
 if(u.includes('portal_staff?'))return Response.json([{role,active:true,must_change_password:false}]);
 if(u.includes('portal_rate_limit'))return Response.json(true);
 if(u.includes('portal_server_code_save_capacity')){saved=JSON.parse(o.body);return failure?Response.json({message:'SERVER_CODE_CAPACITY_REACHED'},{status:400}):Response.json({device_limit:saved.p_device_limit,device_count:20});}
 throw Error('Unexpected request: '+u);
};
await import('./edge/portal-control/index.ts');
const base={action:'server-code-save',code:'synthetic',host:'http://synthetic.invalid',active:true,validity:'annual'};
async function call(b,auth=true){const r=await handler(new Request('https://test.invalid',{method:'POST',headers:auth?{Authorization:'Bearer synthetic'}:{},body:JSON.stringify(b)}));return {status:r.status,data:await r.json()};}
assert.equal((await call({...base,device_limit:500})).status,200);assert.equal(saved.p_device_limit,500);assert.equal(saved.p_update_limit,true);
assert.equal((await call({...base,device_limit:null})).status,200);assert.equal(saved.p_device_limit,null);
assert.equal((await call(base)).status,200);assert.equal(saved.p_update_limit,false);
for(const limit of [0,-1,1.5,1000001,'500',{},true])assert.equal((await call({...base,device_limit:limit})).status,400);
assert.equal((await call({...base,device_limit:1})).status,200);assert.equal((await call({...base,device_limit:1000000})).status,200);
role='reseller';assert.equal((await call({...base,device_limit:500})).status,403);role='admin';
assert.equal((await call({...base,device_limit:500},false)).status,401);
failure=true;const r=await call({...base,device_limit:500});assert.equal(r.status,409);assert.match(r.data.message,/limite/);
console.log('PASS: capacity admin authorization, integer limits, null unlimited, backward compatibility, capacity HTTP 409.');
