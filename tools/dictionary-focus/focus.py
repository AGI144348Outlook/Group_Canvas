"""Organize retained private excerpts; no additional source access or admission."""
import datetime as dt
import gzip
import json
from pathlib import Path
import re
import sys

PATTERN=re.compile(r'lexicon resonance|narrative example|thought.provoking question|short but sweet|core definition|AI insight|lexicon entry',re.I)
def focus(report):
    rows=[]
    for r in report['candidates']:
        text='\n'.join(e['text'] for e in r['excerpts'])
        if not PATTERN.search(text):continue
        # Ordering is an editorial search aid, never an authorship/truth score.
        rank=(20*bool(re.search(r'AI dictionary',text,re.I))+10*bool(re.search('lexicon resonance',text,re.I))+
              5*bool(re.search('Julian',r['title'],re.I))+2*bool(re.search('core definition|lexicon entry',text,re.I)))
        rows.append((rank,r))
    rows=[r for _,r in sorted(rows,key=lambda x:(-x[0],x[1]['id']))]
    return {'format':'echo-dictionary-focused/1','broad_summary':report['summary'],
        'summary':{'focused_candidate_messages':len(rows),'julian_context_candidates':sum(r['julian_context_candidate'] for r in rows),
                   'user_messages':sum(r['role']=='user' for r in rows),'assistant_messages':sum(r['role']=='assistant' for r in rows),
                   'records_are_definition_claims_not_verified_entries':True,'selection_from_retained_broad_candidates_only':True},
        'candidates':rows,'limits':report.get('limits',[])+['Editorial keyword focus is not semantic validation; earlier broad omissions remain.']}
def date(value):
    try:
        return dt.datetime.fromtimestamp(value,dt.timezone.utc).isoformat() if isinstance(value,(int,float)) else str(value)
    except (ValueError,OverflowError):return 'unresolved'
def main():
    source=Path(sys.argv[1]);out=Path(sys.argv[2]);report=focus(json.loads(source.read_text()))
    raw=json.dumps(report,ensure_ascii=False,separators=(',',':')).encode();out.write_bytes(raw)
    out.with_suffix('.json.gz').write_bytes(gzip.compress(raw,mtime=0))
    lines=['# Private dictionary recovery — focused source guide','',
           'These are historical source candidates. No definition or character attribution is verified by inclusion.',
           'The original broad scan retained 5,000 of 8,463 matches; this guide cannot recover the omitted matches.',
           'Excerpts can be partial. Use source pointers for complete entries and surrounding revisions.','',
           '## Focus summary',json.dumps(report['summary'],ensure_ascii=False,indent=2),'',
           '## Source groups']
    groups={}
    for r in report['candidates']:groups.setdefault((r['provider'],r['title']),[]).append(r)
    for (provider,title),rows in sorted(groups.items(),key=lambda x:-len(x[1])):
        lines.append(f'- {provider} · {title}: {len(rows)} candidate messages')
    lines+=['','## Selected passages — explicit dictionary discussion first']
    for r in report['candidates'][:100]:
        lines.extend([f"### {r['title']} · {r['role']} · {date(r['time'])}",
                      'Julian context is a search signal, not certified speaker identity: '+str(r['julian_context_candidate']),
                      'Source: '+json.dumps(r['references'],ensure_ascii=False),
                      '\n\n'.join(e['text'] for e in r['excerpts']),''])
    out.with_suffix('.md').write_text('\n'.join(lines))
    out.with_suffix('.summary.json').write_text(json.dumps(report['summary'],indent=2)+'\n')
if __name__=='__main__':main()
