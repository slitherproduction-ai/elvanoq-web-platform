import assert from 'node:assert/strict';
let handler,links=1,active=true,canPlay=true,stored,captcha=true;
const key='123456',keyHash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))).toString('hex');
globalThis.Deno={env:{get:k=>({SUPABASE_URL:'https://test.local',SUPABASE_SERVICE_ROLE_KEY:'secret',TURNSTILE_ENABLED:'true',TURNSTILE_SECRET_KEY:'secret'})[k]},serve:f=>handler=f};
globalThis.fetch=async(u,o={})=>{
 if(u.includes('siteverify'))return Response.json({success:captcha,hostname:'elvanoqplay.app',action:'playlist'});
 if(u.includes('portal_rate_limit'))return Response.json(true);
 if(u.includes('portal_webos_devices?'))return Response.json(Array.from({length:links},()=>({managed_device_id:'test-id',device_key_hash:keyHash})));
 if(u.includes('portal_managed_devices?'))return Response.json([{id:'test-id',mac:'02:00:00:00:00:99',key_hash:keyHash,active,server_code:'synthetic'}]);
 if(u.includes('portal_playlist_register_host')){stored=JSON.parse(o.body);return Response.json({host_match:'matched',server_code:'synthetic',license:{can_play:true}});}
 if(u.includes('portal_effective_license'))return Response.json({can_play:canPlay});
 if(u.includes('portal_code_access'))return Response.json({can_connect:canPlay});
 if(u.includes('portal_playlists?'))return Response.json([{name:'Synthetic',kind:'m3u',credentials:{url:'http://example.invalid/list'}}]);
 throw Error('Unexpected '+u);
};
await import('./portal-api.ts');
async function call(extra={}){let r=await handler(new Request('https://test.local',{method:'POST',body:JSON.stringify({action:'webos-playlist',tv_code:'LG-ABCDEF123456',device_key:key,captcha_token:'synthetic',name:'Test',kind:'m3u',url:'http://example.invalid/list',...extra})}));return {status:r.status,data:await r.json()};}
assert.equal((await call({tv_code:'02:00:00:00:00:01'})).status,400);
assert.equal((await call({device_key:'654321'})).status,403);
links=0;assert.equal((await call()).status,403);links=2;assert.equal((await call()).status,403);links=1;
active=false;assert.equal((await call()).status,403);active=true;
captcha=false;assert.equal((await call()).status,403);captcha=true;
let r=await call();assert.equal(r.status,200);assert.equal(stored.p_mac,'02:00:00:00:00:99');assert.equal(stored.p_supplied_key,true);assert.equal(stored.p_actor,null);assert.equal(stored.p_origin,'http://example.invalid');assert(!JSON.stringify(r.data).includes('02:00'));
r=await call({kind:'xtream',host:'http://example.invalid:8080',username:'synthetic',password:'synthetic'});assert.equal(r.status,200);assert.equal(stored.p_kind,'xtream');assert.equal(stored.p_origin,'http://example.invalid:8080');
r=await call({action:'webos-playlist-sync',device_id:'a'.repeat(64)});assert.equal(r.status,200);assert.equal(r.data.playlist.kind,'m3u');
canPlay=false;r=await call({action:'webos-playlist-sync',device_id:'a'.repeat(64)});assert.equal(r.data.playlist,null);assert.equal(r.data.license.can_play,false);
active=false;r=await call({action:'webos-playlist-sync',device_id:'a'.repeat(64)});assert.equal(r.data.playlist,null);
console.log('PASS: code/key and CAPTCHA enforced, unregistered/ambiguous/inactive TV rejected; M3U/Xtream saved via existing host licensing, HTTP preserved; authenticated sync withholds blocked credentials; no registration, trial reset or LG-to-MAC conversion');
