import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,statSync} from 'node:fs';
const events={},hints=[];
const context={URL,Set,navigator:{connection:{}},location:{href:'https://elvanoqplay.app/',origin:'https://elvanoqplay.app',pathname:'/'},document:{addEventListener:(name,fn)=>events[name]=fn,createElement:()=>({}),head:{append:v=>hints.push(v)}}};
vm.runInNewContext(readFileSync('dist/navigation.js','utf8'),context);
function hover(path,extra={}){events.pointerover({target:{closest:()=>({href:new URL(path,context.location.href).href,...extra})}});}
for(const path of ['/painel/administrador/','/administrador/','/ativacao/','/adicionar-lista/','/functions/v1/portal-control','/download/?token=secret','https://elsewhere.invalid/','/ELVANOQ-Play.apk','/download/#apk'])hover(path);
assert.equal(hints.length,0);
hover('/download/');hover('/download/');assert.equal(hints.length,1);assert.equal(hints[0].rel,'prefetch');assert.equal(hints[0].as,'document');
context.navigator.connection.saveData=true;hover('/seguranca/');assert.equal(hints.length,1);context.navigator.connection.saveData=false;
context.navigator.connection.effectiveType='2g';hover('/seguranca/');assert.equal(hints.length,1);context.navigator.connection.effectiveType='4g';
for(const path of ['/seguranca/','/compatibilidade/','/legal/','/suporte/'])hover(path);assert.equal(hints.length,4);
const css=readFileSync('dist/style.css','utf8');assert(!css.includes('@import'));assert(css.includes('prefers-reduced-motion'));
let before=0,after=0;for(const name of ['ELVANOQ_logo_transparent','ELVANOQ_wordmark_white_transparent']){before+=statSync('dist/assets/'+name+'.png').size;after+=statSync('dist/assets/'+name+'.webp').size;}assert(after<before*.15);
console.log(`PASS: public-only prefetch; no auth/API/download/query requests; deduplication, 4-page budget, low-data opt-out; no CSS import chain; brand image bytes ${before} → ${after} (${(100-after/before*100).toFixed(1)}% less).`);

class Element{listeners={};children=[];classList={toggle(){}};append(...v){this.children.push(...v);}replaceChildren(...v){this.children=v;}addEventListener(n,f){this.listeners[n]=f;}setAttribute(){}focus(){}remove(){}style={};}
const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
const windowEvents={};let calls=0;let releaseRequest;let gated=true;
const apkContext={AbortSignal,Date,Promise,console,location:{hash:'#apk'},window:{ELVANOQ_CONFIG:{downloadService:'https://downloads.test'},ELVANOQ_ADMIN_ACCESS:{token:async()=> 'synthetic'},addEventListener:(n,f)=>windowEvents[n]=f},document:{getElementById:get,createElement:()=>new Element()},fetch:async()=>{calls++;if(gated)await new Promise(r=>releaseRequest=r);return {ok:true,json:async()=>({current:null,releases:[]})};}};
vm.runInNewContext(readFileSync('dist/apk-manager.js','utf8'),apkContext);
await new Promise(r=>setImmediate(r));windowEvents.hashchange();assert.equal(calls,1);releaseRequest();gated=false;await new Promise(r=>setImmediate(r));
windowEvents.hashchange();await new Promise(r=>setImmediate(r));assert.equal(calls,1);
await get('apkRefresh').listeners.click();assert.equal(calls,2);
console.log('PASS: concurrent APK history requests coalesced, 30-second memory reuse, explicit Refresh bypasses cache.');
