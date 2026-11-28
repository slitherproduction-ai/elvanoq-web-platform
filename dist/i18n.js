/* Presentation-only localization. Never translates form values or request payloads. */
(() => {
 'use strict';
 const dictionary=window.ELVANOQ_EN||{},key='elvanoq_portal_language';
 const normalize=s=>s.replace(/\s+/g,' ').trim();
 const exact=new Map(Object.entries(dictionary).map(([a,b])=>[normalize(a),b.trim()]));
 const reverse=new Map(Object.entries(dictionary).map(([a,b])=>[normalize(b),a.trim()]));
 const canonical=text=>reverse.has(normalize(text))?text.match(/^\s*/)[0]+reverse.get(normalize(text))+text.match(/\s*$/)[0]:text;
 const fragments=Object.entries(dictionary).filter(([a])=>/^\s|\s$/.test(a)).sort((a,b)=>b[0].length-a[0].length);
 let language='pt',observer,scheduled=false;
 const originals=new WeakMap(),attributes=new WeakMap();
 const ignored='script,style,code,pre,textarea,[contenteditable],[translate="no"],[data-i18n-ignore],#profileName,#profileEmail,#apkReleaseNotes,.device-summary-identity strong';
 try {const saved=localStorage.getItem(key),query=new URLSearchParams(location.search).get('lang');language=query==='en'||query==='pt'?query:saved==='en'||saved==='pt'?saved:/^en\b/i.test(navigator.language||'')?'en':'pt';}catch{}
 function translate(text){
  const core=normalize(text);if(!core)return text;
  let value=exact.get(core);
  if(value===undefined){
   let match;
   if((match=core.match(/^Mostrando (\d+[–-]\d+|0) de (\d+)$/)))value=`Showing ${match[1]} of ${match[2]}`;
   else if((match=core.match(/^Página (\d+) de (\d+)$/)))value=`Page ${match[1]} of ${match[2]}`;
   else if((match=core.match(/^(\d+) \/ (\d+|sem limite) dispositivos$/)))value=`${match[1]} / ${match[2]==='sem limite'?'unlimited':match[2]} devices`;
   else if((match=core.match(/^(\d+) de (\d+) selecionados$/)))value=`${match[1]} of ${match[2]} selected`;
   else {
    // Only anchored UI fragments. Never replace arbitrary words inside user data.
    value=core;
    for(const [pt,en] of fragments){
     if(/\s$/.test(pt)&&!/^\s/.test(pt)&&value.startsWith(pt)){value=en+value.slice(pt.length);break;}
    }
    for(const [pt,en] of fragments){
     if(/^\s/.test(pt)&&! /\s$/.test(pt)&&value.endsWith(pt)){value=value.slice(0,-pt.length)+en;break;}
    }
   }
  }
  return text.match(/^\s*/)[0]+value+text.match(/\s*$/)[0];
 }
 function textNode(node){
  if(node.parentElement?.closest(ignored))return;
  const current=node.nodeValue,old=originals.get(node);
  const source=old&&current===old.output?old.source:canonical(current);
  const output=language==='en'?translate(source):source;
  originals.set(node,{source,output});if(current!==output)node.nodeValue=output;
 }
 function element(el){
  if(el.closest(ignored))return;
  let cache=attributes.get(el);if(!cache){cache={};attributes.set(el,cache);}
  for(const name of ['placeholder','title','aria-label','alt']){
   if(!el.hasAttribute(name))continue;
   const current=el.getAttribute(name),old=cache[name],source=old&&current===old.output?old.source:canonical(current);
   const output=language==='en'?translate(source):source;cache[name]={source,output};if(current!==output)el.setAttribute(name,output);
  }
 }
 function walk(root){
  if(root.nodeType===3){textNode(root);return;}
  if(root.nodeType!==1&&root.nodeType!==9)return;
  if(root.nodeType===1){if(root.closest(ignored))return;element(root);}
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,{acceptNode:n=>n.nodeType===1&&n.matches(ignored)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
  while(walker.nextNode()){const n=walker.currentNode;n.nodeType===3?textNode(n):element(n);}
 }
 function observe(){observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label','alt']});}
 function apply(){
  observer?.disconnect();walk(document.documentElement);document.documentElement.lang=language==='en'?'en':'pt-BR';
  document.querySelectorAll('[data-language-select]').forEach(s=>{s.value=language;s.setAttribute('aria-label',language==='en'?'Language':'Idioma');});
  observe();
 }
 function setLanguage(value){
  if(!['pt','en'].includes(value))return;
  language=value;try{localStorage.setItem(key,value);}catch{}
  // A shared language URL must not override a later explicit choice on reload.
  const url=new URL(location.href);if(url.searchParams.has('lang')){url.searchParams.set('lang',value);history.replaceState(history.state,'',url);}
  apply();window.dispatchEvent(new CustomEvent('elvanoq:languagechange',{detail:{language:value}}));
 }
 window.ELVANOQ_I18N={get language(){return language;},get locale(){return language==='en'?'en-US':'pt-BR';},t:text=>language==='en'?translate(String(text)):String(text),setLanguage};
 function init(){
  const host=document.querySelector('.site-header')||document.querySelector('header')||document.body;
  const label=document.createElement('label');label.className='portal-language';label.setAttribute('translate','no');
  const caption=document.createElement('span');caption.textContent='PT / EN';caption.setAttribute('aria-hidden','true');
  const select=document.createElement('select');select.dataset.languageSelect='';select.name='portal-language';
  for(const [value,text]of [['pt','Português'],['en','English']]){const o=document.createElement('option');o.value=value;o.textContent=text;select.append(o);}
  select.value=language;select.addEventListener('change',()=>setLanguage(select.value));label.append(caption,select);host.append(label);
  observer=new MutationObserver(records=>{
   if(scheduled)return;scheduled=true;
   queueMicrotask(()=>{scheduled=false;observer.disconnect();
    const roots=new Set();for(const r of records){if(r.type==='childList')r.addedNodes.forEach(n=>roots.add(n));else roots.add(r.target);}
    for(const n of roots)if(n.isConnected)walk(n);observe();
   });
  });
  apply();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
 window.addEventListener('storage',event=>{if(event.key===key&&['pt','en'].includes(event.newValue))setLanguage(event.newValue);});
})();
