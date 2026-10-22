"""Teacher-provided צ portfolio. Scaffolds tool use; not learned question grammar."""
from copy import deepcopy
from learner import checked_scene

WORDS=['Who','What','When','Where','Why','How']
PROCEDURE=['Choose an unknown entity role: speaker or addressee.',
           'Select a teacher-enabled interrogative slot.',
           'Use פ to express its supplied question template.',
           'Wait for the teacher to point to an entity.',
           'Record the reply and its source; do not self-qualify vocabulary.']
def profile():
    return {'id':'teacher:tsadi','revision':1,'symbol':'צ',
            'functions':['question','expand-blank-lines','paperclip'],
            'procedure':PROCEDURE.copy(),
            'slots':[{'word':w,'status':'green' if w=='Who' else 'red',
                      'scope':'teacher-directed questioning tool only' if w=='Who' else 'locked'} for w in WORDS]}

class TsadiTool:
    def __init__(self,state=None):
        self.copied=False;self.completed=0;self.pending=None;self.events=[];self.links=[]
        self.cards=[{'id':i,'revision':1,'lines':['','',''],'kind':kind} for i,kind in
            [('own:tsadi','tool-copy'),('practice:encounter','encounter-fixture'),('practice:context','context-fixture')]]
        if state is not None:self.restore(state)

    def copy_tool(self,submitted):
        if self.copied:raise ValueError('Tool was already copied')
        if submitted!=profile():raise ValueError('Copy differs from indexboard')
        card=self.cards[0];card['profile']=deepcopy(submitted);card['revision']+=1
        self.copied=True;self.events.append({'kind':'verified-tool-copy','card':card['id'],'stamp':'ע','scope':'exact receipt; not comprehension'})

    def _ready(self):
        if not self.copied:raise ValueError('Copy the indexboard tool first')

    def ask(self,word,target,scene):
        self._ready();checked_scene(scene)
        if self.pending:raise ValueError('Teacher reply is pending')
        if word!='Who':raise PermissionError('This question slot is locked')
        if target not in ('speaker','addressee') or scene[target] is not None:
            raise ValueError('Choose an explicitly unknown entity role')
        question='Who is speaking?' if target=='speaker' else 'Who is being addressed?'
        self.pending={'id':self.completed+1,'word':word,'target':target,'scene':deepcopy(scene),'expression':question,
                      'source':'supplied definition-back template; expressed through פ'}
        self.events.append({'kind':'question-egress',**deepcopy(self.pending)})
        return deepcopy(self.pending)

    def answer(self,turn,entity,actor='teacher'):
        if actor!='teacher':raise PermissionError('Teacher reply required')
        if not self.pending or self.pending['id']!=turn:raise ValueError('No matching pending question')
        if entity not in self.pending['scene']['entities']:raise ValueError('Point to a present entity')
        result={'kind':'teacher-reply','turn':turn,'entity':entity,'target':self.pending['target'],
                'source':'teacher-pointed reference','vocabulary_promoted':False}
        self.events.append(result);self.completed+=1;self.pending=None;return deepcopy(result)

    def expand(self,card_id,count=2):
        self._ready()
        card=next((c for c in self.cards if c['id']==card_id),None)
        if not card or type(count) is not int or not 1<=count<=10 or len(card['lines'])+count>30:
            raise ValueError('Invalid expansion')
        before=len(card['lines']);card['lines'].extend(['']*count);card['revision']+=1
        result={'kind':'expanded','card':card_id,'from':before,'to':len(card['lines']),'revision':card['revision']}
        self.events.append(result);return deepcopy(result)

    def paperclip(self,left,right):
        self._ready();ids={c['id'] for c in self.cards}
        if left==right or left not in ids or right not in ids:raise ValueError('Distinct existing cards required')
        endpoints=sorted([left,right]);old=next((l for l in self.links if l['endpoints']==endpoints),None)
        if old:return deepcopy(old)
        link={'id':'clip:'+str(len(self.links)+1),'endpoints':endpoints,'kind':'paperclip','source':'local practice operation'}
        self.links.append(link);self.events.append({'kind':'paperclipped',**deepcopy(link)});return deepcopy(link)

    def state(self):return deepcopy({'format':'echo-tsadi-tool/1','copied':self.copied,'completed':self.completed,
        'pending':self.pending,'cards':self.cards,'links':self.links,'events':self.events})

    def restore(self,s):
        if s.get('format')!='echo-tsadi-tool/1' or type(s.get('copied')) is not bool or type(s.get('completed')) is not int or not 0<=s['completed']<=200:raise ValueError('Invalid tool state')
        if len(s.get('cards',[]))!=3 or len({c['id'] for c in s['cards']})!=3:raise ValueError('Invalid practice cards')
        if {c['id'] for c in s['cards']}!={'own:tsadi','practice:encounter','practice:context'}:raise ValueError('Unexpected card')
        for card in s['cards']:
            if type(card['revision']) is not int or card['revision']<1 or not 3<=len(card['lines'])<=30 or any(not isinstance(x,str) for x in card['lines']):raise ValueError('Invalid lines/revision')
        own=next(c for c in s['cards'] if c['id']=='own:tsadi')
        if s['copied'] and own.get('profile')!=profile():raise ValueError('Tool profile is not the teacher revision')
        if len(s.get('events',[]))>1000 or len(s.get('links',[]))>3:raise ValueError('Tool state limit')
        for link in s['links']:
            if len(link['endpoints'])!=2 or len(set(link['endpoints']))!=2 or any(e not in {c['id'] for c in s['cards']} for e in link['endpoints']):raise ValueError('Invalid relation')
        if s['pending']:
            p=s['pending'];checked_scene(p['scene'])
            if p['word']!='Who' or p['target'] not in ('speaker','addressee') or p['scene'][p['target']] is not None or p['id']!=s['completed']+1:raise ValueError('Invalid pending question')
        for k in ['copied','completed','pending','cards','links','events']:setattr(self,k,deepcopy(s[k]))
