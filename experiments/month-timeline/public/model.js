export const MONTH_WIDTH=116,MAX_MONTHS=1200;
export function monthNumber(value){if(typeof value!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(value))throw Error('Use a year and month');return Number(value.slice(0,4))*12+Number(value.slice(5))-1;}
export function monthKey(value){if(!Number.isInteger(value)||value<12||value>9999*12+11)throw Error('Month outside supported range');return String(Math.floor(value/12)).padStart(4,'0')+'-'+String(value%12+1).padStart(2,'0');}
export function monthsBetween(first,last){const a=monthNumber(first),b=monthNumber(last);if(b<a||b-a+1>MAX_MONTHS)throw Error('Month range exceeds its limit');return Array.from({length:b-a+1},(_,i)=>monthKey(a+i));}
export function extendRange(first,last,side,count=6){if(!['left','right'].includes(side)||!Number.isInteger(count)||count<1)throw Error('Invalid extension');const a=monthNumber(first)-(side==='left'?count:0),b=monthNumber(last)+(side==='right'?count:0);const result=[monthKey(a),monthKey(b)];monthsBetween(...result);return result;}
export function equalPositions(count,width){if(!Number.isInteger(count)||count<0||!Number.isFinite(width)||width<=0)throw Error('Invalid layout');return Array.from({length:count},(_,i)=>(i+.5)*width/count);}
export function checkedManifest(data){
 if(data?.format!=='echo-gpt-block-months/1'||!Array.isArray(data.blocks)||data.blocks.length>1000)throw Error('Unsupported block manifest');
 monthsBetween(data.firstMonth,data.lastMonth);const ids=new Set();
 for(const b of data.blocks){if(typeof b.id!=='string'||ids.has(b.id)||typeof b.label!=='string'||typeof b.coverage!=='string')throw Error('Invalid block');ids.add(b.id);if(!b.months||typeof b.months!=='object')throw Error('Invalid month counts');for(const [key,value]of Object.entries(b.months)){monthNumber(key);if(!Number.isSafeInteger(value)||value<0)throw Error('Invalid count');}}
 return data;
}
export function blockCount(block,month=''){if(block.coverage!=='indexed')return null;return month?(block.months[month]||0):block.datedRecords;}
export function reviewState(saved,revision,blockCount){
 if(!saved||saved.revision!==revision)return {revision,selected:0,month:'',reviews:{}};
 const result={revision,selected:Number.isInteger(saved.selected)&&saved.selected>=0&&saved.selected<blockCount?saved.selected:0,month:'',reviews:{}};
 if(saved.month){try{monthNumber(saved.month);result.month=saved.month;}catch{}}
 for(const [index,status]of Object.entries(saved.reviews||{}))if(/^\d+$/.test(index)&&Number(index)<blockCount&&['not-started','vocabulary','placement','reviewed'].includes(status))result.reviews[index]=status;
 return result;
}
