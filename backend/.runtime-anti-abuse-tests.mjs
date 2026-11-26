import assert from 'node:assert/strict';
let handler,enabled=true,quota=true,verification={success:true,hostname:'elvanoq-play-portal.slitherproduction.chatgpt.site',action:'playlist'},reads=0;
globalThis.Deno={env:{get:k=>({SUPABASE_URL:'https://test.local',SUPABASE_SERVICE_ROLE_KEY:'server-secret',TURNSTILE_ENABLED:enabled?'true':'false',TURNSTILE_SECRET_KEY:'captcha-secret',TURNSTILE_SITE_KEY:'public-site-key'})[k]},serve:f=>handler=f};
globalThis.fetch=async(u,o={})=>{
 if(u.includes('rpc/portal_rate_limit'))return new Response(JSON.stringify(quota));
 if(u==='https://challenges.cloudflare.com/turnstile/v0/siteverify')return new Response(JSON.stringify(verification));
 if(u.includes('portal_managed_devices?')){reads++;return new Response('[]');}
 if(u.includes('rpc/portal_playlist_register'))return new Response(JSON.stringify({created:true}));
 throw new Error('unexpected call');
};
const beforeClaimFetch=globalThis.fetch;globalThis.fetch=(u,o)=>String(u).includes('portal_native_binding_claim')?Promise.resolve(Response.json(false)):beforeClaimFetch(u,o);await import('./edge/portal-control/index.ts');
async function call(b){const r=await handler(new Request('https://test.local',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}));return {status:r.status,data:await r.json()};}
let r=await call({action:'security-config'});assert.equal(r.data.site_key,'public-site-key');assert(!JSON.stringify(r).includes('captcha-secret'));
quota=false;r=await call({action:'device-status',mac:'02:00:00:00:00:01',device_key:'123456'});assert.equal(r.status,429);assert.equal(reads,0);quota=true;
const body={action:'playlist',mac:'02:00:00:00:00:01',kind:'m3u',url:'https://example.invalid/list',name:'Test'};
assert.equal((await call(body)).status,403);
verification={success:false};assert.equal((await call({...body,captcha_token:'expired-or-duplicate'})).status,403);
verification={success:true,hostname:'attacker.invalid',action:'playlist'};assert.equal((await call({...body,captcha_token:'test'})).status,403);
verification={success:true,hostname:'elvanoq-play-portal.slitherproduction.chatgpt.site',action:'login'};assert.equal((await call({...body,captcha_token:'test'})).status,403);
verification={success:true,hostname:'elvanoq-play-portal.slitherproduction.chatgpt.site',action:'playlist'};assert.equal((await call({...body,captcha_token:'test'})).status,200);
console.log('PASS: quotas deny before device lookup; CAPTCHA rejects absent, expired/replayed, wrong hostname/action; secret stays server-side');

verification={success:true,hostname:'elvanoqplay.app',action:'playlist'};assert.equal((await call({...body,captcha_token:'test'})).status,200);console.log('PASS: new custom hostname accepted without removing old hostname');

verification={success:true,hostname:'elvanoqplay.app.attacker.invalid',action:'playlist'};assert.equal((await call({...body,captcha_token:'test'})).status,403);
for (const origin of ['https://elvanoqplay.app','https://elvanoq-play-portal.slitherproduction.chatgpt.site']) { const response=await handler(new Request('https://test.local',{method:'OPTIONS',headers:{Origin:origin}}));assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin); }
console.log('PASS: exact custom hostname and both CORS origins verified');
