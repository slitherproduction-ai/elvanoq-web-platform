(() => {
  if(document.body.dataset.view!=='panel')return;
  const $=id=>document.getElementById(id);
  const make=(tag,text='',cls='')=>{const el=document.createElement(tag);el.textContent=text;el.className=cls;return el;};
  const dashboard=$('dashboardView'),management=$('managementView'),account=$('accountSettings');
  if(!dashboard||!management||!account)return;
  document.body.classList.add('admin-layout','management-studio');
  if(!$('adminNavigation')){
    const nav=make('nav','','admin-sidebar');nav.id='adminNavigation';nav.setAttribute('aria-label','Funções do painel');
    nav.append(make('p','ÁREA DO PARCEIRO','eyebrow'));
    for(const [route,title] of [['dispositivos','Dispositivos'],['cadastrar','Vincular dispositivo'],['conta','Minha conta']]){
      const a=make('a',title);a.href='#'+route;a.dataset.adminRoute=route;nav.append(a);
    }
    dashboard.prepend(nav);
    const register=$('deviceForm')?.closest('details');
    if(register){
      const section=make('section','','admin-view');section.id='view-cadastrar';
      section.append(make('h2','Vincular dispositivo'));register.before(section);register.open=true;section.append(register);
    }
    const devices=make('section','','admin-view');devices.id='view-dispositivos';devices.append(make('h2','Dispositivos'));
    const first=management.firstElementChild;
    first?.before(devices);
    while(devices.nextElementSibling&&devices.nextElementSibling.id!=='view-cadastrar'&&devices.nextElementSibling.id!=='adminPanel')devices.append(devices.nextElementSibling);
    account.classList.add('admin-view');account.open=true;
  }
  const nav=$('adminNavigation');
  nav?.querySelectorAll('a').forEach((a,i)=>{a.dataset.index=String(i+1).padStart(2,'0');});
  const metrics=make('section','','management-metrics');metrics.id='managementMetrics';metrics.setAttribute('aria-label','Resumo dos dispositivos cadastrados');
  ($('roleLabel')||account).after(metrics);
  const list=$('deviceList');
  if(list){
    const filters=make('div','','management-filters');
    const search=$('macSearch'),code=$('deviceCodeFilter');
    search?.before(filters);
    for(const input of [search,code]){
      if(!input)continue;
      const label=dashboard.querySelector('label[for="'+input.id+'"]');
      const group=make('div');if(label)group.append(label);group.append(input);filters.append(group);
    }
    for(const [id,title,opts] of [
      ['devicePlatformFilter','Plataforma',[['','Todas as plataformas']]],
      ['deviceStateFilter','Situação',[['','Todas as situações'],['active','Habilitado · sem expiração detectada'],['expired','Licença expirada ou suspensa'],['blocked','Desativado']]]
    ]){
      const group=make('div'),label=make('label',title),select=make('select');select.id=id;label.htmlFor=id;
      for(const [value,text]of opts){const o=make('option',text);o.value=value;select.append(o);}
      group.append(label,select);filters.append(group);
    }
    const reset=make('button','Limpar filtros','compact-button');reset.type='button';filters.append(reset);
    reset.addEventListener('click',()=>{
      for(const id of ['macSearch','deviceCodeFilter','devicePlatformFilter','deviceStateFilter']){const el=$(id);if(el){el.value='';el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));}}
      search?.focus();
    });
    const empty=make('div','','management-empty');empty.id='deviceFilterEmpty';empty.hidden=true;
    empty.append(make('strong','Nenhum resultado para estes filtros'),make('p','Tente outro nome, identificador ou plataforma. Use “Limpar filtros” para ver todos os aparelhos.'));
    list.after(empty);
  }
  window.ELVANOQ_MANAGEMENT={render(data){
    metrics.hidden=!!data.must_change_password;
    if(data.must_change_password)return;
    metrics.replaceChildren();
    const devices=data.devices||[],enabled=devices.filter(d=>d.active).length,expired=devices.filter(d=>['expired','suspended','blocked'].includes(d.license?.status)).length;
    for(const [value,label,note]of [[devices.length,'Dispositivos','No seu escopo de gerenciamento'],[enabled,'Habilitados','Estado administrativo ativo'],[devices.length-enabled,'Desativados','Acesso desativado no painel'],[expired,'Atenção à licença','Expirada, suspensa ou bloqueada']]){
      const tile=make('article','','metric-card');tile.append(make('small',label),make('strong',String(value)),make('span',note));metrics.append(tile);
    }
    const platforms=$('devicePlatformFilter');
    if(platforms){
      const current=platforms.value,values=[...new Set(devices.map(d=>window.ELVANOQ_DEVICE_FILTERS.platform(d)))].sort();
      platforms.replaceChildren();
      for(const value of ['',...values]){
        const names=window.ELVANOQ_DEVICE_FILTERS.labels;
        const opt=make('option',value?(names[value]||value):'Todas as plataformas');opt.value=value;platforms.append(opt);
      }
      platforms.value=values.includes(current)?current:'';
    }
  }};
})();
