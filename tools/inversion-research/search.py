"""Read one pinned private R2 archive; encrypt bounded research matches for its owner."""
import hashlib, io, json, os, re, subprocess, tempfile, urllib.parse, urllib.request, zipfile
from pathlib import Path
TERMS = ['recursive return', 'recursive-return', 'recursive sentenc', 'sentence engine', 'sentencing engine', 'continuation', 'n+1', 'ⁿ+¹', 'suspend', 'unfinished expression']
def text_of(msg):
    text = msg.get('text')
    if isinstance(text, str) and text:
        return text
    content = msg.get('content', [])
    return '\n'.join(c.get('text','') for c in content if isinstance(c,dict) and isinstance(c.get('text',''),str)) if isinstance(content,list) else ''
def scan(data):
    conversations = data if isinstance(data,list) else data.get('conversations', [])
    records=[]; count=0
    for c in conversations:
        messages=c.get('chat_messages',c.get('messages',[]))
        for i,m in enumerate(messages):
            count+=1; text=text_of(m); lower=text.casefold()
            terms=[t for t in TERMS if t in lower]
            if not terms: continue
            spans=[]
            for t in terms:
                for match in list(re.finditer(re.escape(t),lower))[:8]:
                    a=max(0,match.start()-1800); b=min(len(text),match.end()+3000)
                    spans.append([a,b])
            spans.sort(); merged=[]
            for a,b in spans:
                if merged and a<=merged[-1][1]: merged[-1][1]=max(b,merged[-1][1])
                else: merged.append([a,b])
            records.append({'conversation_id':c.get('uuid',c.get('id')),'title':c.get('name',c.get('title')),
                'conversation_created':c.get('created_at'),'message_index':i,'message_id':m.get('uuid',m.get('id')),
                'speaker':m.get('sender',m.get('role')),'created_at':m.get('created_at'),'terms':terms,
                'excerpts':[{'offset':a,'text':text[a:b]} for a,b in merged],
                'previous':text_of(messages[i-1])[-2500:] if i else ''})
    return {'conversations_scanned':len(conversations),'messages_scanned':count,'matches':records}
def get(key,limit):
    account=os.environ['CLOUDFLARE_ACCOUNT_ID'];token=os.environ['CLOUDFLARE_API_TOKEN']
    if not re.fullmatch('[a-fA-F0-9]{32}',account): raise ValueError('account')
    url='https://api.cloudflare.com/client/v4/accounts/'+account+'/r2/buckets/group-canvas-citadel-sources/objects/'+urllib.parse.quote('claude-exports/2026-10-20/'+key,safe='')
    req=urllib.request.Request(url,headers={'Authorization':'Bearer '+token})
    with urllib.request.urlopen(req,timeout=180) as r: data=r.read(limit+1)
    if len(data)>limit: raise ValueError('size')
    return data
def main():
    data=get('conversations-000.zip',16640005)
    identity=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
    if len(data)!=16640005 or identity!='70938cc8b9a75e5395943e4615a8a2ea4b92a60e': raise ValueError('archive identity')
    provenance=json.loads(get('transfer-provenance.json',200000))
    entry=next(f for f in provenance['files'] if f['name']=='conversations-000.zip')
    if hashlib.sha256(data).hexdigest()!=entry['sha256']: raise ValueError('provenance')
    reports=[]
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        if sum(i.file_size for i in z.infolist())>512*1024**2: raise ValueError('expansion')
        if z.testzip(): raise ValueError('crc')
        for name in z.namelist():
            if name.endswith('.json'):
                payload=json.loads(z.read(name))
                if isinstance(payload,(list,dict)): reports.append({'member':name,**scan(payload)})
    Path('encrypted-research').mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as d:
        source=Path(d)/'matches.json'
        source.write_text(json.dumps({'source_sha256':entry['sha256'],'reports':reports},ensure_ascii=False))
        subprocess.run(['openssl','cms','-encrypt','-binary','-aes-256-cbc','-in',str(source),'-out','encrypted-research/matches.cms','-outform','DER',str(Path(__file__).with_name('recipient.pem'))],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    print('Private R2 archive verified; encrypted research artifact prepared. No transcripts logged.')
if __name__=='__main__':
    try: main()
    except Exception as exc:
        print('Read-only research stopped: '+type(exc).__name__)
        raise SystemExit(1)
