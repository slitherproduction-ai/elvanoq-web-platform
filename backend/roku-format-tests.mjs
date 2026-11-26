import vm from 'node:vm';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const input={value:'',selectionStart:0,listeners:{},addEventListener(k,f){this.listeners[k]=f;},setSelectionRange(a){this.selectionStart=a;}};
const platform={value:'roku',listeners:{},addEventListener(k,f){this.listeners[k]=f;}};
vm.runInNewContext(readFileSync(new URL('../dist/roku-format.js',import.meta.url),'utf8'),{document:{getElementById:id=>id==='playlistTvCode'?input:platform}});
input.listeners.focus();assert.equal(input.value,'ROKU-');
function type(value,pos=value.length){input.value=value;input.selectionStart=pos;input.listeners.input();return input.value;}
assert.equal(type('abcdefgh12345678'),'ROKU-ABCDEFGH-12345678');
assert.equal(type(' roku-abcd efgh-1234 5678 '),'ROKU-ABCDEFGH-12345678');
assert.equal(type('ROKU-abcdefghijklmnopEXTRA'),'ROKU-ABCDEFGH-IJKLMNOP');
assert.equal(type('ROKU-ab!@cd'),'ROKU-ABCD');
assert.equal(type('ROKU-ABCDEFGH-12345678',7),'ROKU-ABCDEFGH-12345678');assert.equal(input.selectionStart,7);
input.value='';input.listeners.focus();for(const char of 'abcd1234efgh5678'){input.value+=char;input.selectionStart=input.value.length;input.listeners.input();}assert.equal(input.value,'ROKU-ABCD1234-EFGH5678');
type('ROKU-');input.listeners.blur();assert.equal(input.value,'');
platform.value='webos';assert.equal(type('LG-abcdef123456'),'LG-ABCDEF123456');
assert.equal(type('abcdef123456'),'LG-ABCDEF123456');
assert.equal(type(' lg-abcd ef12-3456 '),'LG-ABCDEF123456');
assert.equal(type('LG-Z!ab12cd34ef56EXTRA'),'LG-AB12CD34EF56');
input.value='';input.listeners.focus();assert.equal(input.value,'LG-');for(const char of 'abcdef123456'){input.value+=char;input.selectionStart=input.value.length;input.listeners.input();}assert.equal(input.value,'LG-ABCDEF123456');
assert.equal(type('LG-ABCDEF123456',6),'LG-ABCDEF123456');assert.equal(input.selectionStart,6);
type('LG-');input.listeners.blur();assert.equal(input.value,'');
platform.listeners.change();assert.equal(input.pattern,'LG-[A-F0-9]{12}');
platform.value='webos-msx';platform.listeners.change();assert.equal(input.pattern,'LG-[A-F0-9]{12}');assert.equal(type('lg-abcdef123456'),'LG-ABCDEF123456');
platform.value='android';assert.equal(type('02:93:2C:98:C5:E5'),'02:93:2C:98:C5:E5');
console.log('PASS: incremental typing, full/compact paste, uppercase, separators, length, caret, empty blur, LG incremental/paste/hex/length/caret/blur; Android isolation.');

platform.value='ios';platform.listeners.change();assert.equal(input.pattern,'IOS-[A-F0-9]{12}');assert.equal(type('ios-abcdef123456'),'IOS-ABCDEF123456');assert.equal(type('abcdef123456'),'IOS-ABCDEF123456');
