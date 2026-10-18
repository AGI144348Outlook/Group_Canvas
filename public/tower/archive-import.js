import {conversationRecords,describeConversation,sourceFingerprint,recordHash} from './archive-parser.js';
// Storage and progress injection makes checkpoint behavior independently testable.
export async function importArchive({file,id,db,emit=()=>{},shouldPause=()=>false}){
 let dataset;
 try{
  dataset=await db.getDataset(id);if(!dataset)throw Error('Dataset was not initialized.');
  const source=await sourceFingerprint(file);
  if(dataset.source.size!==source.size||dataset.source.sampleHash!==source.sampleHash)throw Error('This file does not match the saved archive size and sampled fingerprint. Choose the original file to resume.');
  dataset={...dataset,status:'importing',error:null};await db.putDataset(dataset);emit({type:'progress',dataset});
  for await(const record of conversationRecords(file,{offset:dataset.offset,chunkBytes:file.chunkBytes||64*1024})){
   if(shouldPause())break;
   const description=describeConversation(record.value,dataset.count),hash=await recordHash(record.raw);
   const next={...dataset,count:dataset.count+1,offset:record.end,messages:dataset.messages+description.messages,userMessages:dataset.userMessages+(description.roles.user||0),assistantMessages:dataset.assistantMessages+(description.roles.assistant||0),warningCount:dataset.warningCount+description.warnings.length,updated:new Date().toISOString()};
   await db.commitConversation({datasetId:dataset.id,...description,raw:record.raw,hash,byteStart:record.start,byteEnd:record.end},next);dataset=next;emit({type:'progress',dataset});
  }
  dataset={...dataset,status:shouldPause()?'paused':'complete',offset:shouldPause()?dataset.offset:file.size,updated:new Date().toISOString()};await db.putDataset(dataset);emit({type:'done',dataset});return dataset;
 }catch(e){
  if(dataset){const committed=await db.getDataset(dataset.id).catch(()=>null);if(committed)dataset=committed;dataset={...dataset,status:'error',error:e.name==='QuotaExceededError'?'Phone storage is full. Earlier conversations are saved. Free storage before resuming.':e.message};await db.putDataset(dataset).catch(()=>{});}
  emit({type:'failed',message:e.message,dataset});return dataset;
 }
}
