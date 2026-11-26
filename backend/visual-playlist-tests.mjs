import assert from 'node:assert/strict';
let handler,device=null,quota=true,captcha=true,lgFound=true,rokuFound=true,samsungFound=true,queries=[],stored,claims=0;
const hash=async s=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('hex');
const marker='0'.repeat(64),nativeKey='native-key-123',nativeHash=await hash(nativeKey);
globalThis.Deno={env:{get:k=>({SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic',TURNSTILE_ENABLED:'true',TURNSTILE_SECRET_KEY:'synthetic'})[k]},serve:f=>handler=f};
globalThis.fetch=async(u,o={})=>{
 if(u.includes('siteverify'))return Response.json({success:captcha,hostname:'elvanoqplay.app',action:'playlist'});
 if(u.includes('portal_rate_limit'))return Response.json(quota);
 if(u.includes('portal_webos_devices?')){queries.push(u);const samsung=u.includes('platform=eq.samsung-msx');return Response.json((samsung?samsungFound:lgFound)?[{managed_device_id:'lg-id',device_key_hash:nativeHash}]:[]);}
 if(u.includes('portal_roku_devices?'))return Response.json(rokuFound?[{id:'roku-id',key_hash:nativeHash,active:true}]:[]);
 if(u.includes('portal_managed_devices?')){
  if(u.includes('id=eq.lg-id'))return Response.json([{id:'lg-id',mac:'02:00:00:00:00:02',key_hash:nativeHash,active:true}]);
  if(o.method==='PATCH'){claims++;const b=JSON.parse(o.body);assert(u.includes('key_hash=eq.'+marker));assert(u.includes('active=eq.true'));if(device?.key_hash===marker&&device.active){device.key_hash=b.key_hash;return Response.json([{key_hash:b.key_hash}]);}return Response.json([]);}
  return Response.json(device?[device]:[]);
 }
 if(u.includes('portal_playlist_register_host')){stored=JSON.parse(o.body);if(!device)device={id:'android-id',active:true,key_hash:stored.p_key_hash};return Response.json({created:false,license:{can_play:true},host_match:'matched'});}
 if(u.includes('portal_roku_operation')){stored=JSON.parse(o.body);return Response.json({linked:true,license:{status:'active',can_play:true},deviceCode:'ROKU-ABCDEFGH-12345678'});}
 if(u.includes('portal_playlists?'))return Response.json([{kind:'xtream',credentials:{host:'http://provider.invalid',username:'u',password:'p'}}]);
 if(u.includes('portal_effective_license'))return Response.json({can_play:true});
 throw Error('Unexpected request');
};
const existingFetch=globalThis.fetch;globalThis.fetch=(u,o)=>u.includes('portal_native_binding_claim')?Promise.resolve(Response.json(false)):existingFetch(u,o);
await import('./edge/portal-control/index.ts');
async function call(b){const r=await handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify(b)}));const data=await r.json();return {status:r.status,data};}
const upload={action:'playlist',mac:'02:00:00:00:00:01',kind:'m3u',name:'Test',url:'http://provider.invalid/get.php?username=u&password=p',captcha_token:'synthetic'};
let r=await call(upload);assert.equal(r.status,200);assert.equal(stored.p_key_hash,marker);assert.equal(r.data.device_key,undefined);assert(!JSON.stringify(r.data).includes(marker));assert(!JSON.stringify(r.data).includes('credentials'));assert.equal(stored.p_kind,'xtream');assert.equal(r.data.converted_to_xtream,true);
r=await call({action:'device-status',mac:upload.mac,device_key:nativeKey});assert.equal(r.status,200);assert.equal(r.data.registered,true);assert.equal(device.key_hash,nativeHash);assert.equal(claims,1);
r=await call({action:'playlist-sync',mac:upload.mac,device_key:nativeKey});assert.equal(r.status,200);assert.equal(r.data.playlist.kind,'xtream');assert.equal(claims,1);
r=await call({...upload});assert.equal(r.status,200);assert.equal(stored.p_key_hash,nativeHash);assert.equal(r.data.device_key,undefined);assert.equal(device.key_hash,nativeHash);
r=await call({action:'playlist-sync',mac:upload.mac,device_key:'other-key'});assert.equal(r.status,403);assert.equal(device.key_hash,nativeHash);assert.equal(claims,1);
device.active=false;r=await call(upload);assert.equal(r.status,403);assert.equal(device.active,false);device.active=true;
for(const identity of [{action:'webos-playlist',tv_code:'LG-ABCDEF123456'},{action:'webos-playlist',tv_code:'SM-9A1B4C40AF2F'},{action:'webos-playlist',tv_code:'IOS-ABCDEF123456'},{action:'roku-playlist',deviceCode:'ROKU-ABCDEFGH-12345678'}]){r=await call({...upload,...identity});assert.equal(r.status,200);assert.equal(stored.p_key_hash,nativeHash);assert.equal(r.data.device_key,undefined);assert(!JSON.stringify(r.data).includes(nativeHash));assert(!JSON.stringify(r.data).includes('02:00'));}
assert(queries.some(q=>q.includes('abcdef123456*')&&q.includes('platform=eq.ios-msx')));
assert(queries.some(q=>q.includes('9a1b4c40af2f*')&&q.includes('platform=eq.samsung-msx')));
samsungFound=false;assert.equal((await call({...upload,action:'webos-playlist',tv_code:'SM-9A1B4C40AF2F'})).status,403);samsungFound=true;
for(const tv_code of ['SM-9A1B4C40AF2','SM-9A1B4C40AF2Z'])assert.equal((await call({...upload,action:'webos-playlist',tv_code})).status,400);
lgFound=false;assert.equal((await call({...upload,action:'webos-playlist',tv_code:'LG-ABCDEF123456'})).status,403);lgFound=true;rokuFound=false;assert.equal((await call({...upload,action:'roku-playlist',deviceCode:'ROKU-ABCDEFGH-12345678'})).status,403);rokuFound=true;
captcha=false;assert.equal((await call(upload)).status,403);captcha=true;quota=false;assert.equal((await call(upload)).status,429);quota=true;
// A first synchronization can claim without a preceding status call.
device={id:'new-id',active:true,key_hash:marker};r=await call({action:'playlist-sync',mac:upload.mac,device_key:nativeKey});assert.equal(r.status,200);assert.equal(device.key_hash,nativeHash);assert.equal(r.data.playlist.kind,'xtream');
console.log('PASS: MAC/code-only upload Android/LG/Samsung/Roku; no returned/generated key; preserve existing hashes; atomic first native claim; no key reassignment; native sync still requires key; disabled/unregistered devices rejected; CAPTCHA/quota; M3U conversion.');
