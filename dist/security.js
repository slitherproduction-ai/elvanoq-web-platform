(() => {
 'use strict';
 const {url,publishableKey}=window.ELVANOQ_CONFIG,widgets=new Map(),tokens=new Map();
 const ready=(async()=>{
  const forms=[['login',document.getElementById('loginForm')],['playlist',document.getElementById('playlistForm')]].filter(([,form])=>form);
  if(!forms.length)return {turnstile_enabled:false};
  const response=await fetch(url+'/functions/v1/portal-control',{method:'POST',headers:{apikey:publishableKey,'Content-Type':'application/json'},body:JSON.stringify({action:'security-config'}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('Não foi possível consultar a verificação de segurança. Recarregue a página.');
  const config=await response.json();if(!config.turnstile_enabled)return config;
  if(!config.site_key)throw new Error('Verificação de segurança indisponível. Procure o responsável.');
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onload=resolve;script.onerror=()=>reject(new Error('Não foi possível carregar a verificação de segurança.'));document.head.append(script);});
  for(const [action,form] of forms){const container=document.createElement('div');container.className='captcha-container';form.querySelector('button[type=submit]').before(container);const id=window.turnstile.render(container,{sitekey:config.site_key,action,theme:'dark',size:'flexible',callback:token=>tokens.set(action,token),'expired-callback':()=>tokens.delete(action),'error-callback':()=>tokens.delete(action)});widgets.set(action,id);}
  return config;
 })();
 ready.catch(error=>{const box=document.getElementById('loginMessage')||document.getElementById('playlistMessage');if(box){box.hidden=false;box.textContent=error.message;}});
 window.ELVANOQ_SECURITY={async take(action){const config=await ready;if(!config.turnstile_enabled)return undefined;const value=tokens.get(action);if(!value)throw new Error('Conclua a verificação de segurança antes de continuar.');tokens.delete(action);return value;},reset(action){tokens.delete(action);if(widgets.has(action))window.turnstile.reset(widgets.get(action));}};
})();
