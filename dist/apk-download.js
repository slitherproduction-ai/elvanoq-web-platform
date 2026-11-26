(()=>{'use strict';
 const button=document.querySelector('[data-apk-download]'),base=window.ELVANOQ_CONFIG?.downloadService;
 if(!button||!base)return;
 const status=document.getElementById('apkReleaseStatus'),details=document.getElementById('apkReleaseDetails'),news=document.getElementById('apkReleaseNews'),notes=document.getElementById('apkReleaseNotes'),refresh=document.getElementById('apkReleaseRefresh');
 let busy=false;
 // The fixed Portal URL always serves the current release, even if metadata cannot be fetched.
 button.href=base+'/ELVANOQ-Play.apk';
 async function update(){
  if(busy)return;busy=true;if(refresh)refresh.disabled=true;
  try{
   const response=await fetch(base+'/release.json',{cache:'no-store',signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error();
   const data=await response.json(),r=data?.release;
   if(r===null){button.textContent='Baixar APK ↓';button.setAttribute('aria-label','Baixar APK');if(status)status.textContent='Nenhuma versão disponibilizada no portal ainda.';if(details)details.hidden=true;if(news)news.hidden=true;return;}
   if(!r?.id||r.ready!==true||typeof r.version!=='string'||!/^\d+\.\d+\.\d+(?:[-.][A-Za-z0-9.-]+)?$/.test(r.version))throw Error();
   button.textContent='Baixar APK v'+r.version+' ↓';button.setAttribute('aria-label','Baixar APK versão '+r.version);
   if(status)status.textContent='Versão disponível: '+r.version;
   if(details){const values=[];if(Number.isFinite(r.size)&&r.size>0)values.push((r.size/1048576).toLocaleString('pt-BR',{maximumFractionDigits:1})+' MB');const time=r.published_at||r.created_at;if(time&&Number.isFinite(Date.parse(time)))values.push('Disponibilizada em '+new Date(time).toLocaleDateString('pt-BR'));details.textContent=values.join(' · ');details.hidden=!values.length;}
   if(notes&&news){const value=typeof r.notes==='string'?r.notes.trim():'';notes.textContent=value||'Nenhuma novidade informada para esta versão.';news.hidden=false;}
  }catch{
   // Remove stale metadata rather than presenting it as the current release.
   button.textContent='Baixar APK ↓';button.setAttribute('aria-label','Baixar APK');if(status)status.textContent='Não foi possível consultar a versão agora. O botão mantém o endereço oficial de download. Tente atualizar as informações.';if(details)details.hidden=true;if(news)news.hidden=true;
  }finally{busy=false;if(refresh)refresh.disabled=false;}
 }
 refresh?.addEventListener('click',update);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
 window.addEventListener('pageshow',e=>{if(e.persisted)update();});
 setInterval(()=>{if(!document.hidden)update();},60000);
 update();
})();
