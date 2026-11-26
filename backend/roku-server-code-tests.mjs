import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
let handler,queries=[],quota=true,status='active',registered=true,badVisual=false,serverExists=true,fault=null;
let server={code:'demo-code',host:'http://provider.invalid:8080',updated_at:'2026-10-26T12:00:00Z',active:true,revoked:false,validity:'annual',expires_at:'2099-01-01T00:00:00Z'};
const input={action:'roku-server-code-resolve',rokuClientId:'NativeCaseSensitiveClient.123',deviceCode:'ROKU-12345678-ABCDEFGH',code:'demo-code'};
const digest=async s=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('hex');
globalThis.Deno={env:{get:k=>({SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service'})[k]},serve:f=>handler=f};
globalThis.fetch=async(url,options={})=>{
 const path=new URL(url).pathname.split('/rest/v1/')[1];queries.push({url:String(url),body:options.body,signal:options.signal});
 if(fault===path)throw Error('sensitive diagnostic must never leak');
 if(fault==='http503')return Response.json({message:'private diagnostic'},{status:503});
 if(path==='rpc/portal_roku_server_code_link'){if(fault==='capacity')return Response.json({message:'SERVER_CODE_CAPACITY_REACHED'},{status:400});return Response.json(true);}
 if(path==='rpc/portal_rate_limit')return Response.json(quota);
 if(path==='portal_roku_devices'){
  assert.equal(new URL(url).searchParams.get('select'),'id,device_code');
  return Response.json(registered?[{id:'test-only-id',device_code:badVisual?'ROKU-OTHER123-ABCDEFGH':input.deviceCode}]:[]);
 }
 if(path==='rpc/portal_roku_license')return Response.json({status,can_play:status==='active',credentials:'must not leak'});
 if(path==='portal_server_codes')return Response.json(serverExists?[{...server,extra_secret:'must not leak'}]:[]);
 throw Error('Unexpected request '+path);
};
await import('./edge/portal-control/index.ts');
async function call(overrides={}){queries=[];const response=await handler(new Request('https://test.invalid',{method:'POST',headers:{apikey:'synthetic-public','Content-Type':'application/json'},body:JSON.stringify({...input,...overrides})}));const data=await response.json();assert(!JSON.stringify(data).includes(input.rokuClientId));assert(!JSON.stringify(data).includes('must not leak'));assert(!JSON.stringify(data).includes('private diagnostic'));return {status:response.status,data,headers:response.headers};}
let checks=0;async function expectStatus(expected,overrides={}){const r=await call(overrides);assert.equal(r.status,expected,JSON.stringify(r));checks++;return r;}
let r=await expectStatus(200);assert.deepEqual(r.data,{ok:true,action:input.action,state:'active',payload:{server:{code:'demo-code',host:server.host,updated_at:'2026-10-26T12:00:00.000Z'}}});assert.equal(r.headers.get('cache-control'),'no-store');
assert(queries.every(q=>q.signal instanceof AbortSignal));
const rate=JSON.parse(queries[0].body);assert.equal(rate.p_limit,60);assert.equal(rate.p_seconds,900);assert.equal(rate.p_bucket,await digest('roku-server-code-resolve:'+await digest(input.rokuClientId)));assert(queries.every(q=>!q.url.includes(input.rokuClientId)&&!String(q.body).includes(input.rokuClientId)));assert(!queries.some(q=>q.url.includes('portal_managed_devices')||q.url.includes('portal_roku_operation')));
server.host='https://provider.invalid';await expectStatus(200);
r=await expectStatus(200,{deviceCode:' roku-12345678-abcdefgh ',code:' DEMO-CODE '});assert.equal(r.data.payload.server.code,'demo-code');await expectStatus(200,{deviceCode:undefined});
for(const value of ['awaiting_activation','pending','expired','blocked']){status=value;await expectStatus(403);assert(!queries.some(q=>q.url.includes('portal_server_codes')));}status='active';
registered=false;await expectStatus(403);registered=true;badVisual=true;await expectStatus(403);badVisual=false;
for(const code of ['ab','a'.repeat(33),'bad code','abc/def','_abc','bad?code',''])await expectStatus(400,{code});
for(const code of ['abc','a'.repeat(32),'test_1-a']){server.code=code;await expectStatus(200,{code});}server.code=input.code;
serverExists=false;await expectStatus(404);serverExists=true;
server.active=false;await expectStatus(404);server.active=true;server.revoked=true;await expectStatus(404);server.revoked=false;
server.expires_at='2000-01-01T00:00:00Z';await expectStatus(404);server.validity='lifetime';await expectStatus(200);server.validity='annual';server.expires_at='2099-01-01T00:00:00Z';
for(const host of ['ftp://provider.invalid','https://user:pass@provider.invalid','https://bad_host.invalid','https://-bad.invalid','https://provider.invalid/?password=secret','https://provider.invalid/path','not-a-url','http://provider.invalid\\evil','https://provider.invalid/#secret']){server.host=host;await expectStatus(503);}server.host='http://provider.invalid';
for(const data of [{mac:'02:93:2C:98:C5:E5'},{MAC:'02:93:2C:98:C5:E5'},{device_key:'123456'},{rokuClientId:'02:93:2C:98:C5:E5'},{rokuClientId:'02932C98C5E5'},{rokuClientId:''},{deviceCode:'bad'}])await expectStatus(400,data);
quota=false;r=await expectStatus(429);assert.equal(r.headers.get('retry-after'),'900');quota=true;
for(const failure of ['rpc/portal_rate_limit','rpc/portal_roku_license','http503']){fault=failure;await expectStatus(503);}fault=null;
server.updated_at='invalid';await expectStatus(503);server.updated_at='2026-10-26T12:00:00Z';
fault='capacity';await expectStatus(409);fault=null;
console.log(`PASS: ${checks} resolver scenarios; minimal safe response; hashed quotas; identity/license/playlist preserved; atomic code association and capacity conflict.`);
