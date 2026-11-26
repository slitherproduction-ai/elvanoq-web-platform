import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../dist/roku-prefill.js',import.meta.url),'utf8');
const formatter=readFileSync(new URL('../dist/roku-format.js',import.meta.url),'utf8');
const storageKey='elvanoq_pending_roku_code',code='ROKU-4F7A2C91-B03E58D6';
class Element{
 value='';hidden=true;disabled=false;readOnly=false;listeners={};selectionStart=0;
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
 dispatchEvent(event){for(const fn of this.listeners[event.type]||[])fn(event);}
 setSelectionRange(n){this.selectionStart=n;}
}
function page(search='',storage=new Map(),options={}){
 const input=new Element(),platform=new Element(),notice=new Element(),label=new Element(),android=new Element();
 platform.value='android';input.disabled=true;android.hidden=false;label.value='Código da TV LG';
 platform.addEventListener('change',()=>{input.value='';input.disabled=platform.value==='android';label.value=platform.value==='roku'?'Código da TV Roku':'Código da TV LG';android.hidden=platform.value!=='android';});
 const elements={playlistTvCode:input,playlistPlatform:platform,rokuPrefillNotice:notice};
 const context={URLSearchParams,Event,window:{location:{search},sessionStorage:{getItem:k=>{if(options.unavailable)throw Error();return storage.get(k)??null;},setItem:(k,v)=>{if(options.unavailable)throw Error();storage.set(k,v);},removeItem:k=>{if(options.unavailable)throw Error();storage.delete(k);}}},document:{getElementById:id=>elements[id]},fetch:()=>{throw Error('Must not send requests');}};
 vm.runInNewContext(formatter,context);vm.runInNewContext(source,context);
 return {input,platform,notice,label,android,storage};
}
let r=page('?codigo='+code.toLowerCase());assert.equal(r.input.value,code);assert.equal(r.platform.value,'roku');assert.equal(r.label.value,'Código da TV Roku');assert.equal(r.android.hidden,true);assert.equal(r.input.disabled,false);assert.equal(r.input.readOnly,false);assert.equal(r.notice.hidden,false);assert.equal(r.storage.get(storageKey),code);
// A round-trip through login can use another page without the query parameter.
const returned=page('',r.storage);assert.equal(returned.input.value,code);assert.equal(returned.notice.hidden,false);
r.input.value='ROKU-ABCDEFGH-12345678';r.input.dispatchEvent(new Event('input'));assert.equal(r.notice.hidden,true);assert.equal(r.storage.get(storageKey),'ROKU-ABCDEFGH-12345678');
r.platform.value='webos';r.platform.dispatchEvent(new Event('change'));assert.equal(r.storage.has(storageKey),false);assert.equal(r.notice.hidden,true);
for(const value of ['', 'ROKU-1234567-12345678','ROKU-123456789-12345678','ROKU-12345678-1234567!','LG-123456789ABC','<script>alert(1)</script>',' '+code,code+' ',code+'\n','ROKU-ＡＢＣＤＥＦＧＨ-12345678']){const state=page('?codigo='+encodeURIComponent(value));assert.equal(state.input.value,'',value);assert.equal(state.platform.value,'android',value);assert.equal(state.notice.hidden,true,value);}
r=page('?codigo='+code+'&codigo='+code);assert.equal(r.input.value,'');
r=page();assert.equal(r.platform.value,'android');assert.equal(r.input.value,'');assert.equal(r.notice.hidden,true);
r=page('?codigo=invalid',new Map([[storageKey,code]]));assert.equal(r.input.value,'');assert(!r.storage.has(storageKey));
r=page('?codigo='+code,new Map(),{unavailable:true});assert.equal(r.input.value,code);
r=page('',new Map([[storageKey,'bad']]));assert.equal(r.input.value,'');
const html=readFileSync(new URL('../dist/adicionar-lista/index.html',import.meta.url),'utf8');assert(html.includes('Código da TV preenchido automaticamente'));assert(html.indexOf('/app.js')<html.indexOf('/roku-format.js'));assert(html.indexOf('/roku-format.js')<html.indexOf('/roku-prefill.js'));
console.log('PASS: strict QR format, uppercase, editable Roku selection, no auto request/submit, login return/session restore, manual edit/platform switch, invalid/duplicate/absent parameter, denied storage, formatter compatibility and script order.');
