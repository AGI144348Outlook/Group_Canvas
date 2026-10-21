"""Private definition recovery. Candidate evidence, never an authoritative dictionary.
Echo performs actual bounded indexing/similarity calls; Codex supplies the search policy.
"""
import collections
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
import zipfile

TERMS=('definition','define','dictionary','lexicon','glossary','functional translation',
       'structural logic','state shift','example usage','usage example','ai dictionary','mashet','משת')
STRUCTURAL=('functional translation','structural logic','state shift')
PATTERNS={t:re.compile(re.escape(t),re.I) for t in TERMS}
CORE_BLOB='63eb982989b4f3478d649430b555c8f4ba755c27'

def sha(value):return hashlib.sha256(value).hexdigest()
def text_of(message):
    text=message.get('text')
    if isinstance(text,str) and text:return text
    content=message.get('content',{})
    if isinstance(content,dict):return '\n'.join(p for p in content.get('parts',[]) if isinstance(p,str))
    if isinstance(content,list):return '\n'.join(p.get('text','') for p in content if isinstance(p,dict) and isinstance(p.get('text'),str))
    return ''

def selected_path(mapping,current):
    selected=set();visited=set()
    if not current:return selected,False
    while current:
        if current in visited or current not in mapping:return selected,False
        visited.add(current);selected.add(current);node=mapping[current]
        if not isinstance(node,dict):return selected,False
        current=node.get('parent')
    return selected,True

def signals(text):
    spans=[];terms=[]
    for term,pattern in PATTERNS.items():
        found=list(pattern.finditer(text))
        if found:terms.append(term)
        for match in found[:8]:spans.append((max(0,match.start()-180),min(len(text),match.end()+1200)))
    # Context excerpts remain exact source slices. Bounded coverage is explicit.
    merged=[]
    for start,end in sorted(spans):
        if merged and start<=merged[-1][1]:merged[-1][1]=max(end,merged[-1][1])
        else:merged.append([start,end])
    chosen=[];remaining=3600
    for start,end in merged[:3]:
        stop=min(end,start+remaining)
        if stop<=start:break
        chosen.append({'start_codepoint':start,'end_codepoint':stop,'text':text[start:stop]})
        remaining-=stop-start
    structural=sum(t in terms for t in STRUCTURAL)
    definition_shape=bool(structural or re.search(r'(?im)^\s*(?:#{1,4}\s*)?(?:\d+[.):]\s*)?[^\n:]{1,100}:\s*\S',text) and any(t in terms for t in ('definition','dictionary','lexicon','glossary')))
    return terms,chosen,'definition-shaped-candidate' if definition_shape else 'dictionary-discussion-or-mention'

class Recovery:
    def __init__(self):
        self.records={};self.conversations=set();self.sources={};self.messages=0;self.nontext=0;self.skipped_roles=0
        self.terms=collections.Counter();self.raw_matches=0
    def add(self,provider,conversation,source):
        if provider not in ('openai','claude') or not isinstance(conversation,dict):raise ValueError('Unsupported source schema')
        cid=str(conversation.get('uuid') or conversation.get('id') or conversation.get('conversation_id') or 'missing:'+sha(json.dumps(source,sort_keys=True).encode())[:20])
        title=str(conversation.get('name') or conversation.get('title') or '(untitled)')
        self.conversations.add((provider,cid));self.sources[source['source_id']]=source
        mapping=conversation.get('mapping',{})
        if not isinstance(mapping,dict):mapping={}
        active,path_ok=selected_path(mapping,conversation.get('current_node'))
        rows=[]
        if provider=='openai':
            for mid,node in mapping.items():
                if not isinstance(node,dict) or not isinstance(node.get('message'),dict):continue
                prev={};parent=node.get('parent');seen=set()
                for _ in range(8):
                    if not parent or parent in seen or parent not in mapping:break
                    seen.add(parent);pn=mapping[parent]
                    if not isinstance(pn,dict):break
                    pm=pn.get('message') or {}
                    if text_of(pm):prev=pm;break
                    parent=pn.get('parent')
                rows.append((str(mid),node['message'],node.get('parent'),prev,'selected-path' if path_ok and mid in active else 'other-recorded-branch' if path_ok else 'path-unresolved'))
        else:
            messages=conversation.get('chat_messages',conversation.get('messages',[]))
            if not isinstance(messages,list):raise ValueError('Claude message schema')
            for i,m in enumerate(messages):
                if isinstance(m,dict):rows.append((str(m.get('uuid') or m.get('id') or i),m,m.get('parent_message_uuid'),messages[i-1] if i and isinstance(messages[i-1],dict) else {},'export-order-not-branch-proof'))
        for mid,msg,parent,prev,branch in rows:
            self.messages+=1;role=(msg.get('author') or {}).get('role') if isinstance(msg.get('author'),dict) else None
            role=role or msg.get('sender') or msg.get('role') or 'unknown';role='user' if role=='human' else role
            if role not in ('user','assistant'):self.skipped_roles+=1;continue
            text=text_of(msg)
            if not text:self.nontext+=1;continue
            terms,excerpts,kind=signals(text)
            if not terms:continue
            self.raw_matches+=1;self.terms.update(terms)
            previous=text_of(prev);julian=bool(re.search(r'\bjulian\b',title+'\n'+text+'\n'+previous,re.I))
            message_hash=sha(json.dumps(msg,sort_keys=True,ensure_ascii=False).encode())
            rid=sha(json.dumps([provider,cid,mid,message_hash],ensure_ascii=False).encode())
            ref={**source,'conversation_id':cid,'message_id':mid,'message_sha256':message_hash,'parent_id':parent,'branch':branch}
            if rid in self.records:
                if ref not in self.records[rid]['references']:self.records[rid]['references'].append(ref)
                continue
            rank=10*sum(t in terms for t in STRUCTURAL)+4*int(julian)+sum(t in terms for t in ('dictionary','definition','lexicon','glossary'))
            prev_short=previous[-800:]
            self.records[rid]={'id':rid,'provider':provider,'conversation_id':cid,'message_id':mid,'title':title,'role':role,
                'time':msg.get('create_time') if msg.get('create_time') is not None else msg.get('created_at'),
                'kind':kind,'status':'unreviewed-source-candidate','terms':terms,'julian_context_candidate':julian,
                'julian_attribution':'not-verified','heuristic_rank':rank,'references':[ref],
                'excerpts':excerpts,'source_characters':len(text),'excerpt_characters':sum(len(x['text']) for x in excerpts),
                'excerpt_is_partial':sum(len(x['text']) for x in excerpts)<len(text),
                'preceding_context':{'text':prev_short,'partial':len(previous)>800},
                'source_role_is_not_authorship_proof':True}
    def finish(self,core):
        ordered=sorted(self.records.values(),key=lambda r:(-r['heuristic_rank'],r['id']))
        retained=[];size=0
        for record in ordered[:5000]:
            length=len(json.dumps(record,ensure_ascii=False).encode())
            if size+length>19*1024**2:break
            retained.append(record);size+=length
        matrix=core.AlgorithmMatrix();identity=core.ReshIdentity(matrix);identity.anchor()
        query=set('julian ai dictionary definition functional translation structural logic state shift'.split())
        for record in retained:
            evidence='\n'.join(x['text'] for x in record['excerpts'])[:4000]
            units=matrix.index_content(evidence,category='dictionary-recovery:'+record['provider'])
            record['echo_source_overlap']=matrix.content_similarity(units,query)
        summary={'format':'echo-dictionary-recovery/1','conversations':len(self.conversations),'messages_scanned':self.messages,
            'source_objects':len(self.sources),'matching_message_occurrences':self.raw_matches,'unique_matching_messages':len(ordered),
            'retained_candidates':len(retained),'omitted_by_report_budget':len(ordered)-len(retained),
            'definition_shaped_candidates':sum(r['kind']=='definition-shaped-candidate' for r in retained),
            'julian_context_candidates':sum(r['julian_context_candidate'] for r in retained),
            'roles':dict(collections.Counter(r['role'] for r in retained)),
            'providers':dict(collections.Counter(r['provider'] for r in retained)),
            'matched_terms':dict(self.terms),'nontext_messages':self.nontext,'excluded_other_roles':self.skipped_roles,
            'echo_documents_indexed':matrix.documents_seen,'echo_indexed_units':len(matrix.content_units),
            'echo_identity_valid':identity.validate(),'echo_core_git_blob':CORE_BLOB,
            'echo_role':'actual index_content and Jaccard content_similarity calls on retained bounded excerpts',
            'automatic_definition_admission':False,'neural_training':False}
        return {'summary':summary,'sources':list(self.sources.values()),'candidates':retained,
            'limits':['Codex-defined pattern search; candidates are not validated definitions or Julian authorship.',
                      'All recorded OpenAI branches inspected separately; Claude export order is not branch proof.',
                      'Regex definition-shape and rank are heuristics; terms may occur in quotations or unrelated text.',
                      'At most three exact spans and 3600 excerpt characters per message, plus bounded preceding context.',
                      'Echo indexes at most 4000 characters per retained candidate; no WordAgents or VGM truths are acquired.',
                      'An index card candidate is not comprehension; no recovered definition is promoted automatically.']}

def main():
    target=Path(sys.argv[1]);corepath=Path(sys.argv[2]);b=corepath.read_bytes()
    if hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()!=CORE_BLOB:raise ValueError('Core identity')
    spec=importlib.util.spec_from_file_location('dictionary_recovery_genesis',corepath);core=importlib.util.module_from_spec(spec);sys.modules[spec.name]=core;spec.loader.exec_module(core)
    recovery=Recovery()
    for line in sys.stdin:
        item=json.loads(line)
        if 'archive_path' in item:
            with zipfile.ZipFile(item['archive_path']) as z:
                if sum(i.file_size for i in z.infolist())>512*1024**2 or z.testzip():raise ValueError('Archive validation')
                found=False
                for name in z.namelist():
                    if name.endswith('conversations.json'):
                        found=True;data=json.loads(z.read(name));data=data if isinstance(data,list) else data.get('conversations',[])
                        for i,c in enumerate(data):recovery.add('claude',c,{**item['source'],'ordinal':i,'archive_member':name})
                if not found:raise ValueError('Missing conversations member')
        else:recovery.add(item['provider'],item['conversation'],item['source'])
    report=recovery.finish(core);raw=json.dumps(report,ensure_ascii=False,separators=(',',':')).encode()
    if len(raw)>20*1024**2:raise ValueError('Report bound')
    target.write_bytes(raw);target.with_suffix('.json.gz').write_bytes(gzip.compress(raw,mtime=0))
    lines=['# Private dictionary recovery','',json.dumps(report['summary'],ensure_ascii=False,indent=2),'',
        'Unreviewed candidates. Name mentions do not prove Julian attribution. Originals unchanged.','']
    for record in report['candidates'][:100]:
        lines.extend([f"## {record['provider']} · {record['title']} · {record['role']} · {record['time']}",
                      'Source pointers: '+json.dumps(record['references'],ensure_ascii=False),
                      'Status: '+record['kind']+'; Julian context candidate: '+str(record['julian_context_candidate']),
                      '\n\n'.join(x['text'] for x in record['excerpts']),''])
    target.with_suffix('.md').write_text('\n'.join(lines))
    print('Bounded private dictionary recovery complete. No transcript text emitted.')

if __name__=='__main__':
    try:main()
    except Exception as exc:
        print('Private dictionary recovery stopped: '+type(exc).__name__,file=sys.stderr);raise SystemExit(1)
