(() => {
 'use strict';
 const input=document.getElementById('playlistTvCode');
 const platform=document.getElementById('playlistPlatform');
 const notice=document.getElementById('rokuPrefillNotice');
 if(!input||!platform||!notice)return;
 const storageKey='elvanoq_pending_roku_code';
 const valid=value=>typeof value==='string'&&value.toUpperCase().length===22&&/^ROKU-[A-Z0-9]{8}-[A-Z0-9]{8}$/.test(value.toUpperCase())?value.toUpperCase():null;
 const read=()=>{try{return window.sessionStorage.getItem(storageKey);}catch{return null;}};
 const remember=value=>{try{if(value)window.sessionStorage.setItem(storageKey,value);else window.sessionStorage.removeItem(storageKey);}catch{}};
 const params=new URLSearchParams(window.location.search);
 let code;
 if(params.has('codigo')){
  code=params.getAll('codigo').length===1?valid(params.get('codigo')):null;
  remember(code);
 }else code=valid(read());
 if(!code)return;
 // The existing platform handler configures labels and clears the old field.
 // Run it before assigning the QR code, without submitting or contacting the API.
 platform.value='roku';
 platform.dispatchEvent(new Event('change',{bubbles:true}));
 input.value=code;
 input.dispatchEvent(new Event('input',{bubbles:true}));
 notice.hidden=false;
 remember(code);
 input.addEventListener('input',()=>{
  notice.hidden=input.value!==code;
  remember(platform.value==='roku'?valid(input.value):null);
 });
 platform.addEventListener('change',()=>{notice.hidden=true;remember(null);});
})();
