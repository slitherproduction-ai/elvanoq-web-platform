const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../dist/playback-diagnostics.js'),'utf8');
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(){
 const nodes={},listeners={},intervals=new Map(),calls=[];let observer,id=0;
 class E{constructor(tag='div'){this.tagName=tag.toUpperCase();this.nodeType=1;this.children=[];this.dataset={};this.attrs={};this.hidden=false;this.value='';this.style={};this.events={};this.textContent='';}set id(v){this._id=v;nodes[v]=this;}get id(){return this._id;}set innerHTML(v){this.html=v;for(const m of v.matchAll(/<(\w+)[^>]*\bid="([^"]+)"[^>]*>/g)){const e=new E(m[1]);e.id=m[2];e.hidden=/\bhidden\b/.test(m[0]);}nodes.diagHours.value='24';}after(e){this.following=e;}append(...v){this.children.push(...v);}replaceChildren(...v){this.children=v;}setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}addEventListener(k,v){this.events[k]=v;}closest(){return {querySelector:()=>({textContent:'Diagnóstico'})};}}
 const root=new E();root.id='view-diagnostico';root.hidden=true;const link=new E();link.id='diagnosticsLink';link.hidden=true;
 const document={body:{dataset:{page:'administrador'}},hidden:false,getElementById:id=>nodes[id],createElement:t=>new E(t),createElementNS:(ns,t)=>{const e=new E(t);e.namespaceURI=ns;return e;},addEventListener:(e,f)=>listeners[e]=f};
 const window={addEventListener:(e,f)=>listeners[e]=f};const ctx={window,document,MutationObserver:class{constructor(f){observer=f;}observe(){}},AbortController,Date,console,setTimeout,clearTimeout,setInterval:f=>{const i=++id;intervals.set(i,f);return i;},clearInterval:i=>intervals.delete(i),fetch:(url,options)=>new Promise((resolve,reject)=>calls.push({url,options,resolve,reject}))};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {nodes,root,link,document,window,observer,listeners,intervals,calls,access:window.ELVANOQ_DIAGNOSTICS};
}
const respond=async(c,body,status=200)=>{c.resolve({ok:status>=200&&status<300,status,json:async()=>body});await tick();};
const allText=e=>e.textContent+' '+e.children.map(allText).join(' ');
(async()=>{
 const f=fixture(),n=f.nodes;let expired='';const admin={role:'admin',token:async()=>'test-session',expired:m=>{expired=m}};
 f.access.setAccess({role:'reseller',token:async()=>{throw Error('must not run')}});f.root.hidden=false;f.observer();await tick();assert.equal(f.calls.length,0);assert.equal(f.link.hidden,true);
 f.root.hidden=true;f.access.setAccess(admin);await tick();assert.equal(f.calls.length,0);assert.equal(f.link.hidden,false);
 f.root.hidden=false;f.observer();await tick();assert.equal(f.calls.length,1);assert.equal(f.intervals.size,1);
 assert.equal(f.calls[0].url,'https://xrrgjssvdqvtrqhxpask.supabase.co/functions/v1/tv-telemetry');assert.deepEqual(JSON.parse(f.calls[0].options.body),{action:'summary',hours:24,platform:null,server_host:null});assert.equal(f.calls[0].options.headers.Authorization,'Bearer test-session');
 const body={devices:2,totals:{stall:2,open_fail:2,recovered:2,buffering:4},by_platform:[{platform:'roku',buffering:1,avg_buffering_ms:1000},{platform:'lg-msx',buffering:3,avg_buffering_ms:3000}],by_server:[{server_host:'low.test',problems:1,devices:1},{server_host:'high.test:8080',problems:10,devices:2,fatals:1}],by_hour:[{hour:'2026-11-25T10:00:00Z',problems:3,buffering:4,devices:2}],by_format:[{stream_format:'',problems:1}],recent:[{event:'fatal',device:'12345678901234',detail:'<img src=x onerror=alert(1)>',duration_ms:2500}]};
 await respond(f.calls[0],body);assert.match(allText(n.diagMetrics),/taxa indisponível/);assert.match(allText(n.diagMetrics),/2,5 s/);assert.match(allText(n.diagFormats),/Desconhecido/);assert.match(allText(n.diagRecent),/12345678/);assert(!allText(n.diagRecent).includes('123456789'));assert(allText(n.diagRecent).includes('<img src=x'));assert.equal(n.diagServers.children[0].children[0].children[1].children[0].className,'diag-critical');
 body.quality={incidents:2,recovered_incidents:1,sessions:5,playing_sessions:4,watched_ms:3600000,affected_devices:2};
 n.diagFilters.events.submit({preventDefault(){}});await tick();await respond(f.calls.at(-1),body);assert.match(allText(n.diagMetrics),/50% de 2 incidentes/);assert.match(allText(n.diagMetrics),/Horas observadas/);
 const server=n.diagServers.children[0].children[0].children[1].children[0].children[0].children[0];server.onclick();await tick();assert.equal(JSON.parse(f.calls.at(-1).options.body).server_host,'high.test:8080');await respond(f.calls.at(-1),{totals:{},devices:0});assert.equal(n.diagEmpty.hidden,false);assert.equal(n.diagData.hidden,true);
 for(const platform of ['roku','lg-webos','lg-msx','samsung-msx','samsung-tizen','whale']){n.diagPlatform.value=platform;n.diagPlatform.events.change();await tick();assert.equal(JSON.parse(f.calls.at(-1).options.body).platform,platform);await respond(f.calls.at(-1),body);}
 n.diagEvent.value='buffering';n.diagEvent.onchange();assert(!allText(n.diagRecent).includes('Tela de erro'));n.diagEvent.value='';n.diagEvent.onchange();assert(allText(n.diagRecent).includes('Tela de erro'));
 const before=f.calls.length;n.diagHost.value='http://user:password@test/list';n.diagHost.events.change();await tick();assert.equal(f.calls.length,before);assert.equal(n.diagError.hidden,false);n.diagHost.value='';
 [...f.intervals.values()][0]();await tick();const pending=f.calls.at(-1);[...f.intervals.values()][0]();await tick();assert.equal(f.calls.at(-1),pending);
 n.diagPlatform.value='roku';n.diagPlatform.events.change();await tick();assert.equal(pending.options.signal.aborted,true);const latest=f.calls.at(-1);await respond(latest,body);await respond(pending,{devices:999,totals:{}});assert(!allText(n.diagMetrics).includes('999'));
 f.root.hidden=true;f.observer();assert.equal(f.intervals.size,0);f.root.hidden=false;f.observer();await tick();await respond(f.calls.at(-1),{error:'Apenas administradores'},403);assert.equal(n.diagError.textContent,'Apenas administradores');assert.equal(f.link.hidden,true);assert.equal(f.intervals.size,0);
 f.access.setAccess(admin);await tick();await respond(f.calls.at(-1),{error:'Sessão vencida'},401);assert.equal(expired,'Sessão vencida');assert.equal(f.intervals.size,0);assert.equal(n.diagData.hidden,true);
 f.access.setAccess(admin);await tick();await respond(f.calls.at(-1),{error:'Indisponível'},503);assert.equal(n.diagError.textContent,'Indisponível');assert.equal(n.diagRefresh.disabled,false);f.access.setAccess(null);
 const html=fs.readFileSync(path.join(__dirname,'../dist/painel/administrador/index.html'),'utf8');assert(html.indexOf('/playback-diagnostics.js')<html.indexOf('/app.js'));
 const reseller=fs.readFileSync(path.join(__dirname,'../dist/painel/parceiro/index.html'),'utf8');assert(!reseller.includes('diagnosticsLink'));assert(!reseller.includes('/playback-diagnostics.js'));
 console.log('Diagnóstico: isolamento admin/revenda, contrato, filtros, gráfico, médias, percentuais, eventos seguros, atualização, cancelamento, 401/403/503 e estado vazio OK');
})().catch(e=>{console.error(e);process.exitCode=1;});
