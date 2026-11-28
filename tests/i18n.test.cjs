const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'../dist');
function boot(saved='en',search='',blocked=false){
 const win={addEventListener(){}};
 const context={window:win,document:{readyState:'loading',addEventListener(){}},navigator:{language:'pt-BR'},location:{search},URLSearchParams,localStorage:{getItem(){if(blocked)throw Error();return saved;}}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'i18n-en.js'),'utf8'),context);vm.runInContext(fs.readFileSync(path.join(root,'i18n.js'),'utf8'),context);return win.ELVANOQ_I18N;
}
test('saved language, explicit link and unavailable storage',()=>{
 assert.equal(boot().language,'en');assert.equal(boot('en','?lang=pt').language,'pt');assert.equal(boot('pt','?lang=xx').language,'pt');assert.equal(boot(null,'',true).language,'pt');
});
test('public forms, dynamic labels, legal text and panel pagination',()=>{
 const en=boot();assert.equal(en.t('Adicionar lista'),'Add playlist');assert.equal(en.t('Código da TV VIDAA'),'VIDAA TV code');assert.equal(en.t('Salvar lista na TV ↗'),'Save playlist on TV ↗');assert.equal(en.t('Mostrando 1–20 de 55'),'Showing 1–20 of 55');assert.equal(en.t('Página 2 de 3'),'Page 2 of 3');assert.equal(en.t('  Nome da lista  '),'  Playlist name  ');assert.equal(en.t('Versão disponível: 2.17.34'),'Available version: 2.17.34');assert.equal(en.t('VD-012345ABCDEF'),'VD-012345ABCDEF');assert.equal(en.t('https://example.com/MinhaLista'),'https://example.com/MinhaLista');assert.equal(boot('pt').t('Adicionar lista'),'Adicionar lista');
});
test('every page loads versioned locale assets without replacing existing app scripts',()=>{
 const pages=[];function visit(dir){for(const file of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,file.name);if(file.isDirectory())visit(p);else if(file.name.endsWith('.html'))pages.push(p);}}visit(root);assert.equal(pages.length,18);
 for(const p of pages){const html=fs.readFileSync(p,'utf8');for(const asset of ['i18n.css','i18n-en.js','i18n.js'])assert.equal(html.split('/'+asset+'?v=').length,2,p+' '+asset);}
});
