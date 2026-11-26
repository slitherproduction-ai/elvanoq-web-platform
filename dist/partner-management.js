(() => {
 if(document.body.dataset.view!=='panel')return;
 const $=id=>document.getElementById(id),el=(tag,text='',cls='')=>{const x=document.createElement(tag);x.textContent=text;x.className=cls;return x;};
 let ctx=null,data=null,newPlan=null;
 function field(form,title,type='text',value=''){const label=el('label',title),input=el('input');input.type=type;input.value=value;label.append(input);form.append(label);return input;}
 function planFields(form,p={}){
  const name=field(form,'Nome do plano','text',p.plan_name||'Plano anual');name.required=true;name.maxLength=80;
  const label=el('label','Prazo da parceria'),type=el('select');for(const [v,t]of [['annual','Anual'],['lifetime','Vitalício'],['custom','Sem prazo definido']]){const o=el('option',t);o.value=v;type.append(o);}type.value=p.plan_type||'annual';label.append(type);form.append(label);
  const nextYear=new Date();nextYear.setFullYear(nextYear.getFullYear()+1);
  const expires=field(form,'Validade da parceria','date',p.plan_expires_at?p.plan_expires_at.slice(0,10):nextYear.toISOString().slice(0,10));
  const limit=field(form,'Limite de dispositivos','number',p.device_limit??'');limit.min='1';limit.max='1000000';limit.step='1';limit.placeholder='Vazio = sem limite';
  const update=()=>{expires.parentElement.hidden=type.value!=='annual';expires.required=type.value==='annual';};type.addEventListener('change',update);update();
  form.append(el('p','O prazo controla novos cadastros e renovações da parceria. Não concede licença vitalícia aos aparelhos. Reduzir o limite preserva os dispositivos existentes.','field-note'));
  return ()=>({plan_name:name.value.trim(),plan_type:type.value,plan_expires_at:type.value==='annual'?new Date(expires.value+'T23:59:59').toISOString():null,device_limit:limit.value===''?null:Number(limit.value)});
 }
 const staffForm=$('staffForm');if(staffForm&&document.body.dataset.page==='administrador'){
  const group=el('div','','partner-plan-fields');staffForm.querySelector('button[type=submit]').before(group);newPlan=planFields(group);
 }
 const nav=$('adminNavigation'),management=$('managementView');let listForm,deviceSelect;
 if(nav&&management){
  const link=el('a','Adicionar lista');link.href='#listas';link.dataset.adminRoute='listas';link.dataset.index=String(nav.querySelectorAll('a[data-admin-route]').length+1).padStart(2,'0');nav.append(link);
  const section=el('section','','admin-view');section.id='view-listas';section.hidden=true;section.append(el('h2','Adicionar lista'),el('p','Selecione um aparelho sob sua responsabilidade e envie a lista do provedor. Nenhuma nova chave será gerada.','field-note'));
  listForm=el('form');const label=el('label','Dispositivo cadastrado');deviceSelect=el('select');deviceSelect.required=true;label.append(deviceSelect);listForm.append(label);
  const name=field(listForm,'Nome da lista');name.required=true;name.maxLength=100;name.placeholder='Ex.: Lista da sala';
  const kindLabel=el('label','Tipo de conexão'),kind=el('select');for(const [v,t]of [['m3u','URL M3U'],['xtream','Xtream Codes']]){const o=el('option',t);o.value=v;kind.append(o);}kindLabel.append(kind);listForm.append(kindLabel);
  const url=field(listForm,'URL M3U','url');url.maxLength=4096;const host=field(listForm,'Servidor Xtream','url'),username=field(listForm,'Usuário'),password=field(listForm,'Senha','password');host.maxLength=2048;username.maxLength=256;password.maxLength=1024;username.autocomplete=password.autocomplete='off';
  const toggle=()=>{const m3u=kind.value==='m3u';url.parentElement.hidden=!m3u;url.required=m3u;for(const i of [host,username,password]){i.parentElement.hidden=m3u;i.required=!m3u;}};kind.addEventListener('change',toggle);toggle();
  const consent=el('label','Tenho autorização para utilizar esta lista. O envio substitui a lista anterior.','check-label'),check=el('input');check.type='checkbox';check.required=true;consent.prepend(check);listForm.append(consent);
  const save=el('button','Salvar lista e disponibilizar no app','primary');save.type='submit';const message=el('div','','message');message.hidden=true;message.setAttribute('role','status');listForm.append(save,message,el('p','Depois de salvar, abra Listas Salvas no aplicativo e sincronize. As credenciais não são guardadas neste formulário.','field-note'));
  listForm.addEventListener('submit',async event=>{event.preventDefault();if(!ctx)return;const d=data.devices.find(d=>d.id===deviceSelect.value);if(!d)return;save.disabled=true;message.hidden=true;try{const r=await ctx.api('staff-playlist-save',{id:d.id,platform:d.platform==='roku'?'roku':'managed',name:name.value,kind:kind.value,url:url.value,host:host.value,username:username.value,password:password.value});for(const input of [url,host,username,password])input.value='';check.checked=false;await ctx.load();message.textContent=r.message;message.classList.add('success');message.hidden=false;}catch(e){message.textContent=e.message;message.classList.remove('success');message.hidden=false;}finally{save.disabled=false;}});
  section.append(listForm);management.append(section);
 }
 window.ELVANOQ_PARTNERS={newPlan:()=>newPlan?newPlan():{},render(value,context){
  data=value;ctx=context;if(value.must_change_password)return;
  const plan=value.partner_plan;
  if(value.role!=='admin'&&plan){let summary=$('partnerPlanSummary');if(!summary){summary=el('section','','partner-plan-summary');summary.id='partnerPlanSummary';$('managementMetrics').after(summary);}summary.replaceChildren(el('strong',plan.plan_name||'Sua parceria'),el('span',`${plan.device_count||0} / ${plan.device_limit??'sem limite'} dispositivos`),el('small',plan.plan_expires_at?'Validade da parceria: '+new Date(plan.plan_expires_at).toLocaleDateString('pt-BR'):'Parceria sem vencimento definido'),el('p','Aparelhos atribuídos também utilizam vagas. Revogar mantém a vaga; excluir libera.'));
  }
  if(deviceSelect){const selected=deviceSelect.value;deviceSelect.replaceChildren();const first=el('option','Selecione o dispositivo');first.value='';deviceSelect.append(first);for(const d of value.devices.filter(d=>d.active&&!d.archived_at)){const o=el('option',`${({samsung:'TV Samsung',webos:'TV LG',roku:'Roku'}[d.platform]||d.platform||'Android')} · ${d.display_name} · ${d.visual_code||d.mac}`);o.value=d.id;deviceSelect.append(o);}if([...deviceSelect.options].some(o=>o.value===selected))deviceSelect.value=selected;}
  for(const d of value.devices){const card=document.querySelector('.device-disclosure[data-device-id="'+d.id+'"]');if(!card)continue;const content=card.querySelector('.device-expanded');
   content.append(el('small','Cadastrado por: '+(d.created_by_label||'Aplicativo / cadastro anterior')));
   const list=el('button','Adicionar / substituir lista','compact-button');list.type='button';list.disabled=!d.active||!!d.archived_at;list.addEventListener('click',()=>{deviceSelect.value=d.id;location.hash='listas';listForm.querySelector('input').focus({preventScroll:true});});content.append(list);
   if(value.role!=='admin'&&!d.archived_at&&!d.license?.device_lifetime&&!d.license?.lifetime){
    const details=el('details','','management-block');details.append(el('summary','Renovar licença por mais 1 ano'));const form=el('form');form.append(el('p','Acrescenta um ano ao período pago restante. A renovação não reativa um aparelho revogado e não registra um pagamento financeiro.','field-note'));const reason=field(form,'Motivo da renovação');reason.required=true;reason.minLength=5;reason.maxLength=500;
    const label=el('label','Confirmo a renovação anual deste aparelho.','check-label'),confirm=el('input');confirm.type='checkbox';confirm.required=true;label.prepend(confirm);const save=el('button','Confirmar renovação anual','primary'),message=el('div','','message');save.type='submit';message.hidden=true;message.setAttribute('role','status');form.append(label,save,message);let requestId=null;
    form.addEventListener('submit',async e=>{e.preventDefault();save.disabled=true;message.hidden=true;try{requestId||=crypto.randomUUID();const r=await ctx.api('staff-device-renew',{id:d.id,platform:d.platform==='roku'?'roku':'managed',reason:reason.value.trim(),request_id:requestId});await ctx.load();const status=$('deviceMessage');status.textContent=r.message;status.hidden=false;status.classList.add('success');}catch(e){message.textContent=e.message;message.hidden=false;save.disabled=false;}});details.append(form);content.append(details);
   }
  }
  if(value.role==='admin')for(const staff of value.staff.filter(s=>s.role==='reseller')){
   const card=document.querySelector('[data-staff-id="'+staff.user_id+'"]');if(!card)continue;
   card.append(el('strong',`${staff.device_count||0} / ${staff.device_limit??'sem limite'} dispositivos`),el('small',(staff.plan_name||'Plano atual')+(staff.plan_expires_at?' · até '+new Date(staff.plan_expires_at).toLocaleDateString('pt-BR'):'')));
   const details=el('details','','management-block');details.append(el('summary','Editar plano e limite'));const form=el('form'),read=planFields(form,staff),save=el('button','Salvar plano','primary'),message=el('div','','message');save.type='submit';message.hidden=true;message.setAttribute('role','status');form.append(save,message);form.addEventListener('submit',async e=>{e.preventDefault();save.disabled=true;try{await ctx.api('partner-plan-save',{partner_id:staff.user_id,...read()});await ctx.load();}catch(e){message.textContent=e.message;message.hidden=false;save.disabled=false;}});details.append(form);card.append(details);
  }
 }};
})();
