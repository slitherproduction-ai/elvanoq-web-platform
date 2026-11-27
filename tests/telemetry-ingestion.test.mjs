import assert from 'node:assert/strict';
let handler, inserted;
globalThis.Deno={env:{get:()=> 'https://test.invalid'},serve:fn=>{handler=fn;}};
globalThis.fetch=async(url,opts)=>{
 if(url.includes('portal_rate_limit'))return new Response('true');
 if(url.includes('tv_playback_events')){inserted=JSON.parse(opts.body);assert.match(url,/on_conflict=device_hash,event_id/);assert.match(opts.headers.Prefer,/ignore-duplicates/);return new Response('');}
 if(url.includes('/auth/'))return new Response('{}',{status:401});
 throw Error('Unexpected request');
};
await import('../backend/edge/tv-telemetry/index.ts');
const send=b=>handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify(b)}));
let response=await send({action:'report',platform:'samsung-msx',device_code:'SM-TEST',app_version:'1.2.7',events:[{event:'stall',event_id:'event-test-123',session_id:'session-test-123',incident_id:'incident-test-123',occurred_at:new Date().toISOString(),server_host:'https://user:secret@host.test/live/user/secret/1.ts',detail:'error https://host.test/u/secret token=SECRET',media_error:2,buffer_ms:0,ready_state:2,network_state:2,phase:'playback',engine:'html5-native',device_model:'TV-MODEL'}]});
assert.equal(response.status,200);assert.equal(inserted[0].server_host,'host.test');assert(!JSON.stringify(inserted).includes('secret'));assert(!JSON.stringify(inserted).includes('SECRET'));assert.equal(inserted[0].media_error,2);assert.equal(inserted[0].buffer_ms,0);assert.equal(inserted[0].session_id,'session-test-123');
response=await send({action:'report',platform:'lg-msx',events:[{event:'buffering'},{event:'watch_time',session_id:'bad/url',occurred_at:'2099-01-01',buffer_ms:'oops'}]});
assert.equal(response.status,200);assert.equal(inserted[0].session_id,null);assert.equal(inserted[0].media_error,null);assert.equal(inserted[1].occurred_at,null);assert.equal(inserted[1].buffer_ms,null);
assert.equal((await send({action:'summary'})).status,401);
assert.equal((await send({action:'report',platform:'invalid'})).status,400);
console.log('Telemetry ingestion: legacy compatibility, structured data, privacy, deduplication, clock validation and summary authentication OK');
