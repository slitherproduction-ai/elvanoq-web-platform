const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'../dist',f),'utf8');
class El{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.hidden=false;this.value='';this.events={};}
 append(...els){this.children.push(...els);if(this.tagName==='SELECT'&&!this.value&&els[0])this.value=String(els[0].value);}
 after(el){this.following=el;}setAttribute(){}addEventListener(e,fn){this.events[e]=fn;}
 matches(){return this.className==='device-card'||this.className==='panel-bulk-row';}
}
for(const role of ['administrador','parceiro']){
 const list=new El();list.id='deviceList';const els={deviceList:list};
 for(const id of ['macSearch','deviceCodeFilter','devicePlatformFilter','deviceStateFilter','deviceCount','deviceFilterEmpty'])els[id]=new El();
 const window={},ctx={window,document:{body:{dataset:{view:'panel',page:role}},createElement:t=>new El(t),getElementById:id=>els[id]}};
 vm.createContext(ctx);vm.runInContext(read('device-filters.js'),ctx);vm.runInContext(read('panel-pagination.js'),ctx);
 const f=window.ELVANOQ_DEVICE_FILTERS;
 for(const [raw,expected]of [['samsung-msx','samsung'],['samsung','samsung'],['webos-msx','webos'],['lg-msx','webos'],['ios-msx','ios'],['android-tv','androidtv'],['google_tv','androidtv'],['fire-tv','firetv'],['vegas-os','vega'],['whale-os','whale']])assert.equal(f.platform({platform:raw}),expected);
 assert.equal(f.platform({platform:'android',visual_code:'WH-123456ABCDEF'}),'whale');
 const devices=Array.from({length:25},(_,i)=>({platform:i<12?'samsung-msx':i<23?'webos-msx':'roku',visual_code:(i<12?'SM-':i<23?'LG-':'ROKU-')+String(i).padStart(12,'0'),name:i===0?'Sala São Paulo':'TV '+i}));
 const android={platform:'android',mac:'02:D4:25:4A:FB:55',name:'Celular'};devices.push(android);
 for(const d of devices){const e=new El();e.className='panel-bulk-row';e.dataset={deviceId:String(list.children.length),platform:f.platform(d),identity:d.visual_code||d.mac,search:(d.visual_code||d.mac)+' '+d.name+' '+f.labels[f.platform(d)],state:'active',code:'FlixPlay'};list.append(e);}
 ctx.$=id=>els[id];ctx.overview={devices};
 const app=read('app.js'),start=app.indexOf(' function filterDevices(){'),end=app.indexOf(" document.addEventListener('change'",start);
 vm.runInContext(app.slice(start,end),ctx);
 const filter=()=>vm.runInContext('filterDevices()',ctx),visible=()=>list.children.filter(e=>!e.hidden);
 filter();assert.equal(visible().length,10);assert.match(list.following.children[0].textContent,/de 26/);
 list.following.children[4].events.click();assert.equal(visible()[0].dataset.deviceId,'10');
 els.devicePlatformFilter.value='samsung';filter();assert.equal(visible().length,10);assert(visible().every(e=>e.dataset.platform==='samsung'));assert.match(list.following.children[0].textContent,/1–10 de 12/);
 list.following.children[4].events.click();assert.equal(visible().length,2);assert(visible().every(e=>e.dataset.platform==='samsung'));
 els.devicePlatformFilter.value='webos';filter();assert.equal(visible().length,10);assert.match(list.following.children[0].textContent,/de 11/);
 els.macSearch.value='inexistente';filter();assert.equal(visible().length,0);assert.equal(els.deviceFilterEmpty.hidden,false);
 els.macSearch.value='';els.devicePlatformFilter.value='';filter();assert.equal(visible().length,10);assert.match(list.following.children[0].textContent,/de 26/);
 els.macSearch.value='sao paulo';filter();assert.equal(visible().length,1);
 els.macSearch.value='02d4254afb55';filter();assert.equal(visible().length,1);assert.equal(visible()[0].dataset.platform,'android');
 els.macSearch.value='';els.deviceCodeFilter.value='flixplay';els.devicePlatformFilter.value='roku';filter();assert.equal(visible().length,2);
 els.deviceStateFilter.value='blocked';filter();assert.equal(visible().length,0);
 assert.equal(f.matches({identity:'SM-123'},{search:'---'}),false);
 const html=read('painel/'+role+'/index.html');assert(html.indexOf('/device-filters.js')<html.indexOf('/management-ui.js'));assert(html.indexOf('/device-filters.js')<html.indexOf('/app.js'));
 console.log(role+': plataformas, busca, filtros combinados, limpeza, contagem e paginação OK');
}
