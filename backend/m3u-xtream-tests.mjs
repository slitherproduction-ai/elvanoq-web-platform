import assert from 'node:assert/strict';import {playlistConnection} from './edge/portal-control/playlist-connection.ts';
const normalize=url=>playlistConnection('m3u',{url});let checks=0;
for(const url of ['http://provider.invalid:8080/get.php?username=test&password=pass&type=m3u_plus&output=ts','https://provider.invalid/get.php?password=p%40ss%2Bword&username=UsEr%20Name&output=m3u8']){const r=normalize(url);assert.equal(r.kind,'xtream');assert.equal(r.credentials.host,new URL(url).origin);assert.equal(r.credentials.password,new URL(url).searchParams.get('password'));checks++;}
for(const url of ['http://provider.invalid/list.m3u','http://provider.invalid/get.php?username=user','http://provider.invalid/get.php?username=user&password=','http://provider.invalid/sub/get.php?username=u&password=p','http://provider.invalid/get.php?username=u&password=p&token=private','http://provider.invalid/get.php?username=a&username=b&password=p','http://provider.invalid/get.php?username=u&password=p&type=custom','http://provider.invalid/get.php?username=u&password=p&output=custom','http://provider.invalid/get.php?username=u&password=p#private','http://u:p@provider.invalid/get.php?username=u&password=p','ftp://provider.invalid/get.php?username=u&password=p','invalid']){assert.deepEqual(normalize(url),{kind:'m3u',credentials:{url}});checks++;}
const explicit={host:'http://provider.invalid',username:'u',password:'p'};assert.deepEqual(playlistConnection('xtream',explicit),{kind:'xtream',credentials:explicit});
let handler,stored=null,blocked=false;const key='123456',hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))).toString('hex');
globalThis.Deno={env:{get:k=>({SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic',TURNSTILE_ENABLED:'true',TURNSTILE_SECRET_KEY:'synthetic'})[k]},serve:f=>handler=f};
globalThis.fetch=async(u,o={})=>{
 assert(u.startsWith('https://test.invalid/')||u.startsWith('https://challenges.cloudflare.com/')); // no request to IPTV providers
 if(u.includes('siteverify'))return Response.json({success:true,hostname:'elvanoqplay.app',action:'playlist'});
 if(u.includes('portal_rate_limit'))return Response.json(true);
 if(u.includes('portal_webos_devices?'))return Response.json([{managed_device_id:'synthetic',device_key_hash:hash}]);
 if(u.includes('portal_managed_devices?'))return Response.json([{id:'synthetic',mac:'02:00:00:00:00:01',active:!blocked,key_hash:hash}]);
 if(u.includes('portal_playlist_register_host')){stored=JSON.parse(o.body);return Response.json({created:false,host_match:'matched',license:{can_play:true}});}
 if(u.includes('portal_roku_operation')){const b=JSON.parse(o.body);if(b.p_operation==='playlist'){stored=b;return Response.json({linked:true,message:'Salva',license:{status:'active',can_play:true}});}if(b.p_operation==='sync')return Response.json({license:{can_play:!blocked},playlist:blocked?null:{kind:stored.p_data.kind,credentials:stored.p_data.credentials}});throw Error('Unexpected operation');}
 if(u.includes('portal_effective_license'))return Response.json({can_play:!blocked});
 if(u.includes('portal_playlists?'))return Response.json([{kind:stored.p_kind,credentials:stored.p_credentials}]);
 throw Error('Unexpected route');
};
const existingFetch=globalThis.fetch;globalThis.fetch=(u,o)=>u.includes('portal_native_binding_claim')?Promise.resolve(Response.json(false)):existingFetch(u,o);
await import('./edge/portal-control/index.ts');
async function call(b){const r=await handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify(b)}));return {status:r.status,data:await r.json()};}
const url='http://provider.invalid:8080/get.php?username=UsEr&password=p%40ss&type=m3u_plus&output=ts';
const base={name:'Teste',kind:'m3u',url,device_key:key,captcha_token:'synthetic'};
for(const identity of [{action:'playlist',mac:'02:00:00:00:00:01'},{action:'webos-playlist',tv_code:'LG-ABCDEF123456'},{action:'roku-playlist',deviceCode:'ROKU-ABCDEFGH-12345678'}]){
 const r=await call({...base,...identity});assert.equal(r.status,200);assert.equal(r.data.converted_to_xtream,true);assert.equal(r.data.playlist_kind,'xtream');assert(!JSON.stringify(r.data).includes('p@ss'));assert(!JSON.stringify(r.data).includes(url));
 const payload=identity.action==='roku-playlist'?stored.p_data:{kind:stored.p_kind,credentials:stored.p_credentials,origin:stored.p_origin};assert.equal(payload.kind,'xtream');assert.deepEqual(payload.credentials,{host:'http://provider.invalid:8080',username:'UsEr',password:'p@ss'});assert.equal(payload.origin,'http://provider.invalid:8080');checks++;
 if(identity.action==='playlist'){const sync=await call({action:'playlist-sync',mac:identity.mac,device_key:key});assert.equal(sync.data.playlist.kind,'xtream');blocked=true;const denied=await call({action:'playlist-sync',mac:identity.mac,device_key:key});assert.equal(denied.data.active,false);assert(!denied.data.playlist);blocked=false;}
 if(identity.action==='roku-playlist'){const sync=await call({action:'roku-playlist-sync',deviceCode:identity.deviceCode,rokuClientId:'native-synthetic',device_key:key});assert.equal(sync.data.playlist.kind,'xtream');}
}
const generic=await call({...base,action:'playlist',mac:'02:00:00:00:00:01',url:'https://provider.invalid/playlist.m3u'});assert.equal(generic.data.converted_to_xtream,false);assert.equal(stored.p_kind,'m3u');assert.equal(stored.p_credentials.url,'https://provider.invalid/playlist.m3u');
console.log(`PASS: ${checks} normalization/platform scenarios; Android/LG/Roku save; Xtream sync; blocked sync; generic M3U fallback; credential privacy; no upstream fetch.`);
