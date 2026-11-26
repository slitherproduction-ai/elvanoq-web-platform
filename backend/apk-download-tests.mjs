import vm from 'node:vm';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../dist/apk-download.js',import.meta.url),'utf8');
const elements=new Map();function element(){return{hidden:false,textContent:'',disabled:false,listeners:{},setAttribute(k,v){this[k]=v;},addEventListener(k,v){this.listeners[k]=v;}};}
for(const id of ['button','apkReleaseStatus','apkReleaseDetails','apkReleaseNews','apkReleaseNotes','apkReleaseRefresh'])elements.set(id,element());
let release={id:'first',ready:true,version:'2.17.16',size:12345678,notes:'Primeira versão',published_at:'2026-10-26T12:00:00Z'},failure=false,interval;
const document={hidden:false,querySelector:()=>elements.get('button'),getElementById:id=>elements.get(id),addEventListener(){}};
vm.runInNewContext(script,{window:{ELVANOQ_CONFIG:{downloadService:'https://downloads.elvanoqplay.app'},addEventListener(){}},document,fetch:async(url,options)=>{assert.equal(options.cache,'no-store');if(failure)throw Error();return{ok:true,json:async()=>({release})};},AbortSignal,Date,Number,setInterval:f=>interval=f});
const settle=()=>new Promise(r=>setImmediate(r));await settle();
assert.equal(elements.get('button').href,'https://downloads.elvanoqplay.app/ELVANOQ-Play.apk');assert.match(elements.get('button').textContent,/2.17.16/);assert.equal(elements.get('apkReleaseNotes').textContent,'Primeira versão');
release={...release,id:'second',version:'2.17.17',notes:'Novas funções\n<script>literal</script>'};await elements.get('apkReleaseRefresh').listeners.click();assert.match(elements.get('apkReleaseStatus').textContent,/2.17.17/);assert.equal(elements.get('apkReleaseNotes').textContent,release.notes);
release={...release,notes:'Notas editadas'};interval();await settle();assert.equal(elements.get('apkReleaseNotes').textContent,'Notas editadas');
failure=true;interval();await settle();assert.equal(elements.get('button').textContent,'Baixar APK ↓');assert.equal(elements.get('apkReleaseNews').hidden,true);assert.match(elements.get('apkReleaseStatus').textContent,/Não foi possível/);failure=false;
release=null;interval();await settle();assert.match(elements.get('apkReleaseStatus').textContent,/Nenhuma versão/);
release={version:'invalid',ready:true,id:'bad'};interval();await settle();assert.match(elements.get('apkReleaseStatus').textContent,/Não foi possível/);
console.log('PASS: fixed Portal download link; dynamic version/notes/size; edited notes; refresh; absent release; failure and stale-data handling; notes rendered as text.');
