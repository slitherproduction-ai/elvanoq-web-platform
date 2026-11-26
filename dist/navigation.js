(() => {
 'use strict';
 // Prepare only public documents on deliberate navigation intent.
 // No API calls, staff pages, downloads, query strings or user data are prefetched.
 const pages=new Set(['/','/download/','/compatibilidade/','/seguranca/','/legal/','/politica-de-privacidade/','/termos-de-uso/','/suporte/']);
 const prepared=new Set();
 function prepare(event){
  if(navigator.connection?.saveData||/^(slow-)?2g$/.test(navigator.connection?.effectiveType||''))return;
  const anchor=event.target.closest?.('a[href]');if(!anchor||anchor.download||anchor.target==='_blank')return;
  let url;try{url=new URL(anchor.href,location.href);}catch{return;}
  if(url.origin!==location.origin||url.search||url.hash||url.pathname===location.pathname||!pages.has(url.pathname)||prepared.has(url.pathname)||prepared.size>=4)return;
  prepared.add(url.pathname);const hint=document.createElement('link');hint.rel='prefetch';hint.as='document';hint.href=url.href;document.head.append(hint);
 }
 document.addEventListener('pointerover',prepare,{passive:true});
 document.addEventListener('focusin',prepare);
 document.addEventListener('touchstart',prepare,{passive:true});
})();
