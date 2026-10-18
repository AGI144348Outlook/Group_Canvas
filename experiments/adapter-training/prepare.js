// Dataset preparation only: no provider SDK, network call, training or model loading.
import {createHash} from 'node:crypto';
const sha=text=>createHash('sha256').update(text).digest('hex');
export function evidenceId(record){return sha(JSON.stringify(record));}
function groupFor(source){if(source?.conversationId)return 'conversation:'+source.conversationId;if(source?.conversationSha256)return 'conversation-hash:'+source.conversationSha256;throw Error('Conversation identity is required for leakage-resistant splitting');}
export function prepareAdapter(records,{identity,approvedIds=[],excludedIds=[],seed='adapter-dataset-v1',validationPercent=10}={}){
 if(!['self','julian'].includes(identity))throw Error('Separate Self or Julian identity required');
 if(!Array.isArray(records)||records.length>100000)throw Error('Bounded input record list required');
 if(!Number.isInteger(validationPercent)||validationPercent<1||validationPercent>50)throw Error('Validation percentage must be 1–50');
 const approved=new Set(approvedIds),excluded=new Set(excludedIds),result={format:'adapter-preparation/1',identity,objective:identity==='self'?'user-text-continuation':'approved-prompt-reply-supervision',seed,validationPercent,train:[],validation:[],review:[],rejected:[],duplicates:0,readyForTraining:false,blockers:['Choose compatible base model and exact revision','Choose trainer and approve compute budget','Run model-tokenizer checks and assistant-only loss masking where applicable','Review evaluation examples before training']};
 const seen=new Set(),groups=new Map();
 for(const record of records){const id=evidenceId(record);if(excluded.has(id)){result.rejected.push({id,reason:'explicit-exclusion'});continue;}
  const source=record.source;if(!source?.fileId||!/^[a-f0-9]{64}$/.test(source.sha256||'')){result.rejected.push({id,reason:'missing-source-provenance'});continue;}
  let group;try{group=groupFor(source);}catch{result.rejected.push({id,reason:'missing-conversation-identity'});continue;}
  const flagged=Array.isArray(record.flags)&&record.flags.length>0;
  if(identity==='julian'&&(!approved.has(id)||!['direct','inherited'].includes(record.tier)||!record.prompt?.text?.trim()||!record.reply?.text?.trim())){result.review.push({id,reason:'requires-explicit-session-approval-and-complete-pair'});continue;}
  if(identity==='self'&&(record.role!=='user'||typeof record.text!=='string'||!record.text.trim())){result.rejected.push({id,reason:'not-user-text'});continue;}
  if(identity==='self'&&flagged&&!approved.has(id)){result.review.push({id,reason:'flagged-text-requires-review',flags:record.flags});continue;}
  const example=identity==='self'?{text:record.text}:{messages:[{role:'user',content:record.prompt.text},{role:'assistant',content:record.reply.text}]};
  // Exact content duplicates are removed before a split, so they cannot leak across sets.
  const contentHash=sha(JSON.stringify(example));if(seen.has(contentHash)){result.duplicates++;continue;}seen.add(contentHash);
  const split=parseInt(sha(seed+'\0'+group).slice(0,8),16)%100<validationPercent?'validation':'train';groups.set(group,split);
  result[split].push({...example,provenance:{id,source,group,contentHash,tier:record.tier??null,flags:record.flags||[]}});
 }
 result.counts={train:result.train.length,validation:result.validation.length,review:result.review.length,rejected:result.rejected.length,groups:groups.size,duplicates:result.duplicates};
 if(!result.train.length)result.blockers.push('No approved training examples');if(!result.validation.length)result.blockers.push('No held-out evaluation examples');return result;
}
