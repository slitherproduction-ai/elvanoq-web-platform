(()=>{'use strict';
 const format=value=>(String(value).replace(/[^0-9a-f]/gi,'').slice(0,12).toUpperCase().match(/.{1,2}/g)||[]).join(':');
 for(const id of ['pixMac','deviceMac','newDeviceMac']){const input=document.getElementById(id);if(!input)continue;input.maxLength=17;input.spellcheck=false;input.autocapitalize='characters';input.addEventListener('input',()=>{const value=input.value,position=input.selectionStart??value.length;let before=value.slice(0,position).replace(/[^0-9a-f]/gi,'').length;input.value=format(value);let caret=0,seen=0;while(caret<input.value.length&&seen<before){if(input.value[caret]!==':')seen++;caret++;}if(input.setSelectionRange)input.setSelectionRange(caret,caret);});input.value=format(input.value);}
})();
