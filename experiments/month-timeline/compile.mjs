import {createHash} from 'node:crypto';
import {monthNumber,monthKey,checkedManifest} from './public/model.js';
export function compileBlocks(files,index){
 if(index?.format!=='echo-conversation-timeline/1'||!Array.isArray(index.events))throw Error('Chronology index required');
 const unique=new Map();for(const f of files)if(/^conversations(?:[-_ ]\d+)?\.json$/i.test(f.source?.name||''))unique.set(f.id,f);
 const sorted=[...unique.values()].sort((a,b)=>a.source.name.localeCompare(b.source.name,undefined,{numeric:true})||a.id.localeCompare(b.id));
 const blocks=sorted.map(f=>({id:f.id,label:f.source.name,status:f.status,bytes:f.source.size,
   coverage:f.status==='complete'?'not-in-index':'pending-upload',months:{},datedRecords:0,undatedRecords:0,conversations:0,
   vocabulary:'unassessed',placement:'not-attempted'}));
 const byId=new Map(blocks.map(b=>[b.id,b]));const conversations=new Map(blocks.map(b=>[b.id,new Set()]));let dated=0,unresolved=0;const unknownSources=new Set();
 for(const event of [...index.events,...(index.unresolved||[])]){
  if(event.provider!=='openai')continue;
  const sourceIds=new Set((event.references||[]).map(r=>r.source_id));
  const time=typeof event.time==='string'&&/(Z|[+-]\d\d:\d\d)$/.test(event.time)?Date.parse(event.time):NaN;
  if(Number.isFinite(time))dated++;else unresolved++;
  for(const id of sourceIds){
   const block=byId.get(id);if(!block){unknownSources.add(id);continue;}if(block.status!=='complete')continue;
   block.coverage='indexed';conversations.get(id).add(event.conversation_id);
   if(Number.isFinite(time)){const month=new Date(time).toISOString().slice(0,7);block.months[month]=(block.months[month]||0)+1;block.datedRecords++;}else block.undatedRecords++;
  }
 }
 for(const b of blocks)b.conversations=conversations.get(b.id).size;
 const keys=blocks.flatMap(b=>Object.keys(b.months)).sort((a,b)=>monthNumber(a)-monthNumber(b));
 const firstMonth=keys[0]||new Date().toISOString().slice(0,7),lastMonth=keys.at(-1)||firstMonth;
 const base={format:'echo-gpt-block-months/1',firstMonth,lastMonth,blocks,
   summary:{blocks:blocks.length,complete:blocks.filter(b=>b.status==='complete').length,pending:blocks.filter(b=>b.status!=='complete').length,
   indexed:blocks.filter(b=>b.coverage==='indexed').length,completedNotIndexed:blocks.filter(b=>b.status==='complete'&&b.coverage!=='indexed').length,
   datedOpenaiMessages:dated,undatedOpenaiMessages:unresolved,uncataloguedSourceCount:unknownSources.size},
   metric:'UTC calendar months; equal display width, not equal day count',
   boundaries:['Equal block spacing is an editorial arrangement, not a date assignment.','All recorded GPT branches remain in timestamp counts.','Pending uploads and completed-but-unindexed files are not zero-message blocks.','No source text or conversation titles are copied.','Vocabulary assessment and semantic placement have not been performed.']};
 const revision=createHash('sha256').update(JSON.stringify(base)).digest('hex');return checkedManifest({...base,revision});
}
