"""Echo chronology index: dated source cards, not inferred historical truth.
Preserves provider, branches, source pointers and unresolved timestamps. No LLM.
"""
import datetime as dt
import hashlib
import json
import re

def utc_time(value):
    if value is None or isinstance(value,bool):return None
    try:
        if isinstance(value,(int,float)):
            value=float(value)
            if abs(value)>100000000000:value/=1000
            date=dt.datetime.fromtimestamp(value,dt.timezone.utc)
        elif isinstance(value,str):
            date=dt.datetime.fromisoformat(value.replace('Z','+00:00'))
            if date.tzinfo is None:return None
            date=date.astimezone(dt.timezone.utc)
        else:return None
        return date.isoformat().replace('+00:00','Z')
    except (ValueError,OverflowError,OSError):return None

def identity(*parts):return hashlib.sha256(json.dumps(parts,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()[:32]

class TimelineIndexer:
    def __init__(self):
        self.events={};self.unresolved=[];self.sources={};self.conversations=set();self.conflicts=[]
    def add(self,provider,conversation,source):
        if provider not in ('openai','claude'):raise ValueError('Explicit provider required')
        if not isinstance(conversation,dict):raise ValueError('Conversation object required')
        cid=str(conversation.get('uuid') or conversation.get('id') or conversation.get('conversation_id') or 'missing:'+identity(source))
        title=conversation.get('name') or conversation.get('title') or '(untitled)'
        self.conversations.add((provider,cid));self.sources[source['source_id']]=source
        mapping=conversation.get('mapping',{})
        active=set();cursor=conversation.get('current_node');visited=set()
        while cursor and cursor in mapping and cursor not in visited:
            visited.add(cursor);active.add(cursor);cursor=mapping[cursor].get('parent')
        rows=[]
        if isinstance(mapping,dict):
            for nid,node in mapping.items():
                msg=node.get('message') if isinstance(node,dict) else None
                if not isinstance(msg,dict):continue
                rows.append((str(nid),msg,node.get('parent'),'selected-path' if nid in active else 'other-recorded-branch' if active else 'path-unresolved'))
        if provider=='claude':
            for i,msg in enumerate(conversation.get('chat_messages',conversation.get('messages',[]))):
                if isinstance(msg,dict):rows.append((str(msg.get('uuid') or msg.get('id') or i),msg,msg.get('parent_message_uuid'),'export-order-not-branch-proof'))
        for mid,msg,parent,branch in rows:
            raw=msg.get('create_time') if msg.get('create_time') is not None else msg.get('created_at')
            time=utc_time(raw)
            role=msg.get('author',{}).get('role') if isinstance(msg.get('author'),dict) else None
            role=role or msg.get('sender') or msg.get('role') or 'unknown'
            eid=identity(provider,cid,mid,time)
            ref={**source,'conversation_id':cid,'message_id':mid,'parent_id':parent,'branch':branch,'message_sha256':hashlib.sha256(json.dumps(msg,sort_keys=True,ensure_ascii=False).encode()).hexdigest()}
            event={'id':eid,'provider':provider,'conversation_id':cid,'message_id':mid,'title':str(title),
                'role':'user' if role=='human' else role,'time':time,'kind':'message-record','references':[ref],
                'status':'export-timestamp-not-verified-world-event','date_mentions':[]}
            # Explicit ISO dates in text are candidates, not message timestamps or accepted milestones.
            text=msg.get('text','')
            content=msg.get('content',{})
            if not isinstance(text,str):text=''
            if not text and isinstance(content,dict):text='\n'.join(p for p in content.get('parts',[]) if isinstance(p,str))
            if not text and isinstance(content,list):text='\n'.join(p.get('text','') for p in content if isinstance(p,dict) and isinstance(p.get('text'),str))
            event['date_mentions']=[{'date':d,'status':'text-mention-candidate-not-event'} for d in sorted(set(re.findall(r'\b\d{4}-\d{2}-\d{2}\b',text)))[:5]]
            if eid in self.events:
                old=self.events[eid]
                if ref not in old['references']:old['references'].append(ref)
                if old['role']!=event['role'] or old['title']!=event['title'] or any(r.get('message_sha256')!=ref['message_sha256'] for r in old['references']):
                    self.conflicts.append({'id':eid,'source':source,'alternate_title':event['title'],'alternate_role':event['role']})
                dates={d['date']:d for d in old['date_mentions']+event['date_mentions']};old['date_mentions']=list(dates.values())
            else:self.events[eid]=event
    def report(self):
        dated=sorted((e for e in self.events.values() if e['time']),key=lambda e:(e['time'],e['id']))
        unresolved=[e for e in self.events.values() if not e['time']]
        return {'format':'echo-conversation-timeline/1','events':dated,'unresolved':unresolved,'sources':list(self.sources.values()),
            'conflicts':self.conflicts,'summary':{'conversations':len(self.conversations),'dated_messages':len(dated),'undated_messages':len(unresolved),
            'source_objects':len(self.sources),'first':dated[0]['time'] if dated else None,'last':dated[-1]['time'] if dated else None},
            'boundaries':['All recorded OpenAI branches retained; selected path marked when available.',
            'Date mentions are unverified candidates, not milestones or causal history.',
            'Source timestamps order records; they do not establish comprehension, learning, or truth.',
            'No conversation text is included; titles and identifiers are private. Originals unchanged.']}

if __name__=='__main__':
    import sys,zipfile
    from pathlib import Path
    try:
        index=TimelineIndexer()
        for line in sys.stdin:
            envelope=json.loads(line)
            if 'archive_path' in envelope:
                with zipfile.ZipFile(envelope['archive_path']) as z:
                    if sum(i.file_size for i in z.infolist())>512*1024**2:raise ValueError('Expansion budget')
                    if z.testzip():raise ValueError('Archive CRC')
                    for name in z.namelist():
                        if name.endswith('conversations.json'):
                            data=json.loads(z.read(name));data=data if isinstance(data,list) else data.get('conversations',[])
                            for ordinal,conversation in enumerate(data):index.add('claude',conversation,{**envelope['source'],'ordinal':ordinal,'archive_member':name})
            else:index.add(envelope['provider'],envelope['conversation'],envelope['source'])
        Path(sys.argv[1]).write_text(json.dumps(index.report(),ensure_ascii=False,separators=(',',':')))
        print('Private chronology index built. No message text emitted.')
    except Exception:
        print('Private chronology indexing stopped; inspect source schema without publishing transcript data.',file=sys.stderr)
        raise SystemExit(1)
