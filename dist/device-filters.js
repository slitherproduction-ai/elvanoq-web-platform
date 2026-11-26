(() => {
 'use strict';
 const text=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const labels={android:'Android',androidtv:'Android TV / Google TV',firetv:'Fire TV',vega:'Fire TV · Vega OS',webos:'TV LG',samsung:'TV Samsung',roku:'Roku',ios:'iOS (MSX)',titan:'Titan OS',whale:'Whale OS',vidaa:'VIDAA'};
 function platform(device={}){
  const value=text(device.platform).replace(/[\s_-]/g,''),code=String(device.visual_code||'').trim().toUpperCase();
  const prefix=code.split('-')[0],byCode={LG:'webos',SM:'samsung',ROKU:'roku',IOS:'ios',TT:'titan',WH:'whale',VD:'vidaa'};
  if(byCode[prefix])return byCode[prefix];
  if(value.includes('roku'))return 'roku';
  if(value.includes('samsung')||value==='tizen')return 'samsung';
  if(value.includes('webos')||value==='lg'||value==='lgmsx')return 'webos';
  if(value.includes('ios'))return 'ios';
  if(value.includes('whale'))return 'whale';
  if(value.includes('titan'))return 'titan';
  if(value.includes('vidaa'))return 'vidaa';
  if(value.includes('vega')||value.includes('vegas'))return 'vega';
  if(value.includes('fire')||value==='amazon')return 'firetv';
  if(value.includes('androidtv')||value.includes('googletv'))return 'androidtv';
  return value||'android';
 }
 function matches(row,filters={}){
  const search=text(filters.search),identity=text(row.identity),haystack=text(row.search||row.identity);
  const compact=value=>value.replace(/[:\s-]/g,'');
  return (!search||haystack.includes(search)||(!!identity&&!!compact(search)&&compact(identity).includes(compact(search))))
   &&(!text(filters.code)||text(row.code).includes(text(filters.code)))
   &&(!filters.platform||platform({platform:row.platform})===platform({platform:filters.platform}))
   &&(!filters.state||row.state===filters.state);
 }
 window.ELVANOQ_DEVICE_FILTERS={platform,labels,matches};
})();
