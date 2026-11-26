(() => {
 if(document.body.dataset.view!=='panel')return;
 const states=new Map(),make=(tag,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
 function apply(list,rows,reset=false){
  if(!list)return;let s=states.get(list.id);
  if(!s){const bar=make('nav'),summary=make('span'),label=make('label','Itens por página '),size=make('select'),prev=make('button','Anterior'),next=make('button','Próxima'),pages=make('span');
   bar.className='panel-pagination';bar.setAttribute('aria-label','Paginação de '+({deviceList:'dispositivos',staffList:'parceiros',serverCodeList:'códigos',pixOrders:'cobranças',licenseAudit:'licenças',apkReleaseList:'arquivos APK'}[list.id]||'registros'));summary.setAttribute('role','status');summary.setAttribute('aria-live','polite');
   for(const n of [10,20,50,100]){const o=make('option',String(n));o.value=n;size.append(o);}prev.type=next.type='button';label.append(size);bar.append(summary,label,prev,pages,next);list.after(bar);s={bar,summary,size,prev,pages,next,page:1,rows:[]};states.set(list.id,s);
   size.addEventListener('change',()=>{if(list.inert)return;s.page=1;paint(list,s);});prev.addEventListener('click',()=>{if(list.inert)return;s.page--;paint(list,s);});next.addEventListener('click',()=>{if(list.inert)return;s.page++;paint(list,s);});
  }
  const signature=rows.map(r=>r.dataset.deviceId||r.dataset.identity||r.dataset.search||r.textContent).join('|');
  if(reset||s.signature!==signature)s.page=1;s.signature=signature;s.rows=rows;paint(list,s);
 }
 function paint(list,s){const total=s.rows.length,size=Number(s.size.value),pages=Math.max(1,Math.ceil(total/size));s.page=Math.max(1,Math.min(s.page,pages));const first=(s.page-1)*size,last=Math.min(first+size,total),included=new Set(s.rows.slice(first,last));
  for(const row of list.children)if(row.matches('.device-card,.panel-bulk-row'))row.hidden=!included.has(row);
  s.summary.textContent=total?`Mostrando ${first+1}–${last} de ${total}`:'Mostrando 0 de 0';s.pages.textContent=`Página ${s.page} de ${pages}`;s.prev.disabled=s.page===1;s.next.disabled=s.page===pages;s.size.disabled=!total;s.bar.hidden=!total;
  window.ELVANOQ_BULK?.update(list);
 }
 window.ELVANOQ_PAGES={filtered(list,rows){if(!list)return;apply(list,rows??[...list.children].filter(r=>!r.hidden&&r.matches('.device-card,.panel-bulk-row')),true);},render(){for(const id of ['staffList','pixOrders','licenseAudit','apkReleaseList']){const list=document.getElementById(id);if(list)apply(list,[...list.children].filter(r=>r.matches('.device-card,.panel-bulk-row')));}}};
})();
