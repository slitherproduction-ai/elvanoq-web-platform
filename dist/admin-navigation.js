(() => {
 const nav=document.getElementById('adminNavigation');if(!nav)return;
 const views=[...document.querySelectorAll('.admin-view')],links=[...nav.querySelectorAll('a')];
 function activate(focus=false){
  const restricted=!document.getElementById('firstAccessNotice').hidden;
  const requested=location.hash.slice(1),route=restricted?'conta':links.some(a=>a.dataset.adminRoute===requested)?requested:'dispositivos';
  for(const view of views){const id=view.id==='accountSettings'?'conta':view.id.replace('view-','');view.hidden=id!==route;}
  for(const a of links){const active=a.dataset.adminRoute===route;a.toggleAttribute('aria-current',active);if(active)a.setAttribute('aria-current','page');a.hidden=(restricted&&a.dataset.adminRoute!=='conta')||a.dataset.accessPending==='true';}
  if(focus){const heading=views.find(v=>!v.hidden)?.querySelector('h2,summary');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
 }
 window.addEventListener('hashchange',()=>activate(true));
 new MutationObserver(()=>activate()).observe(document.getElementById('firstAccessNotice'),{attributes:true,attributeFilter:['hidden']});
 activate();
})();
