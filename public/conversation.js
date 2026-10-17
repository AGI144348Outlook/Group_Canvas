// Retain intent IDs across explicit retries; never automatically repeat a model turn.
export class ConversationSend {
  constructor({post,turn,refresh,status,id=()=>crypto.randomUUID()}) {
    Object.assign(this,{post,turn,refresh,status,id});this.pending=null;this.busy=false;
  }
  async send(input) {
    if(this.busy)throw Error('A message is already being sent.');
    if(input.route==='server'&&input.thread!=='main')throw Error('AI replies work in the Everyone conversation.');
    const key=JSON.stringify(input);
    if(!this.pending||this.pending.key!==key)this.pending={key,input,messageId:this.id(),turnId:this.id(),posted:false,replied:false};
    const p=this.pending;this.busy=true;
    try {
      if(!p.posted){this.status('Saving your message…');await this.post(p.input,p.messageId);p.posted=true;}
      if(input.route==='server'&&!p.replied){this.status('Message saved. Waiting for the AI…');const r=await this.turn(p.input,p.turnId);const failed=r.results?.filter(x=>x.status==='rejected')||[];if(failed.length)throw Error(failed.map(x=>x.reason).join('; '));p.replied=true;}
      await this.refresh();
      this.status(input.route==='external'?'Message saved. Open your connected assistant and ask it to read this room.':input.route==='server'?'Reply received.':'Message saved to the room. Select an AI companion to request a reply.');
      this.pending=null;
    }catch(e){this.status((p.posted?'Message saved; ':'Message not confirmed; ')+e.message+' You can retry this same message.',true);throw e;}
    finally{this.busy=false;}
  }
}
