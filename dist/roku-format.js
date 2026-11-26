(()=>{'use strict';
 const input=document.getElementById('playlistTvCode'),platform=document.getElementById('playlistPlatform');
 if(!input||!platform)return;
 const settings={whale:{prefix:'WH-',strip:/^\s*WH[\s-]*/,invalid:/[^A-F0-9]/g,length:12,pattern:'WH-[A-F0-9]{12}'},vidaa:{prefix:'VD-',strip:/^\s*VD[\s-]*/,invalid:/[^A-F0-9]/g,length:12,pattern:'VD-[A-F0-9]{12}'},roku:{prefix:'ROKU-',strip:/^\s*ROKU[\s-]*/,invalid:/[^A-Z0-9]/g,length:16,pattern:'ROKU-[A-Z0-9]{8}-[A-Z0-9]{8}'},webos:{prefix:'LG-',strip:/^\s*LG[\s-]*/,invalid:/[^A-F0-9]/g,length:12,pattern:'LG-[A-F0-9]{12}'},ios:{prefix:'IOS-',strip:/^\s*IOS[\s-]*/,invalid:/[^A-F0-9]/g,length:12,pattern:'IOS-[A-F0-9]{12}'},samsung:{prefix:'SM-',strip:/^\s*SM[\s-]*/,invalid:/[^A-F0-9]/g,length:12,pattern:'SM-[A-F0-9]{12}'}};
 const config=()=>settings[platform.value==='webos-msx'?'webos':platform.value];
 const body=value=>String(value).toUpperCase().replace(config().strip,'').replace(config().invalid,'').slice(0,config().length);
 const format=value=>{const data=body(value);return config().prefix+(platform.value==='roku'?data.slice(0,8)+(data.length>8?'-'+data.slice(8):''):data);};
 function apply(){
  if(!config())return;
  const value=input.value,position=input.selectionStart??value.length;
  const count=body(value.slice(0,position)).length;
  input.value=format(value);
  let caret=config().prefix.length,seen=0;
  while(caret<input.value.length&&seen<count){if(input.value[caret]!=='-')seen++;caret++;}
  input.setSelectionRange?.(caret,caret);
 }
 input.addEventListener('focus',()=>{if(config()&&!input.value){input.value=config().prefix;input.setSelectionRange?.(config().prefix.length,config().prefix.length);}});
 input.addEventListener('input',apply);
 input.addEventListener('blur',()=>{if(config()&&!body(input.value))input.value='';});
 function configure(){
  if(!config())return;
  // Leave room for pasted spaces/separators; the formatter limits each platform identity length.
  input.maxLength=128;input.autocapitalize='characters';input.spellcheck=false;
  input.pattern=config().pattern;
  if(input.value)apply();
 }
 platform.addEventListener('change',configure);configure();
})();
