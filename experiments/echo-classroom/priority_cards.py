"""New bounded note/Recess scheduler. No definition learning or self-grading."""
from copy import deepcopy
import json

TEMPLATES=('observation','hypothesis','question','trial')
def personal_dictionary():
    def entry(word,definition):
        return {'id':word,'word':word,'sense':'classroom','revision':1,'status':'red',
                'definition':definition,'source':'teacher-provided classroom dictionary v1'}
    return [entry('speaker','the entity expressing I in an exchange'),
            entry('addressee','the entity addressed as you in an exchange'),
            entry('question','an expression requesting information')]

class PriorityCards:
    def __init__(self,dictionary=None,state=None):
        self.dictionary=deepcopy(personal_dictionary() if dictionary is None else dictionary)
        self.notes=[];self.note_queue=[];self.tasks=[];self.events=[];self.visited=[]
        self.enabled=False;self.budget=3;self.used=0;self.streak=0;self.handover=False;self.serial=0
        if state is not None:self.restore(state)

    def request_note(self,template,body,source='teacher-request',evidence=None):
        if template not in TEMPLATES or not isinstance(body,str) or not body.strip() or len(body)>1000:
            raise ValueError('Use a bounded note template; validation is separate')
        if len(self.note_queue)>=20 or len(self.notes)+len(self.note_queue)>=200:raise ValueError('Note capacity reached; export and reset notes')
        self.serial+=1;card={'id':'note-'+str(self.serial),'template':template,'body':body,
            'source':source,'evidence':deepcopy(evidence or []),'review':'unreviewed'}
        self.note_queue.append(card);return card['id']

    def enqueue_inspection(self,entry_id):
        if not any(e['id']==entry_id for e in self.dictionary):raise ValueError('Unknown entry')
        if len(self.tasks)>=20:raise ValueError('Task queue is full')
        self.tasks.append({'kind':'inspect-entry','entry':entry_id})

    def set_recess(self,enabled):
        if type(enabled) is not bool:raise ValueError('Boolean required')
        self.enabled=enabled
        if enabled:self.used=0

    @staticmethod
    def coverage(entry,inventory):
        # A spelling-only Seen record is yellow; green needs a matching qualification.
        words=list(dict.fromkeys(entry['definition'].lower().split()))
        green=[];yellow=[]
        for word in words:
            record=inventory.get(word,{})
            qualified=isinstance(record.get('sense'),str) and bool(record['sense']) and not record.get('ambiguous') and any(q.get('scope')=='definition-reading' and q.get('sense')==record['sense'] and q.get('evidence') for q in record.get('qualifications',[]))
            if qualified:green.append(word)
            elif record.get('seen') is True:yellow.append(word)
        return {'green':green,'yellow':yellow,'unresolved':[w for w in words if w not in green+yellow]}

    def tick(self,inventory=None,teacher_pending=False):
        if len(self.events)>=1000:raise ValueError('Event capacity reached; export and reset')
        inventory=inventory or {}
        if self.note_queue and (self.streak<2 or not self.tasks):
            card=self.note_queue.pop(0);self.notes.append(card);self.streak+=1
            result={'kind':'note-captured','card':deepcopy(card),'priority':'first'}
        elif teacher_pending:result={'kind':'blocked','reason':'teacher-turn'}
        elif self.tasks:
            task=self.tasks.pop(0);self.streak=0
            entry=next(e for e in self.dictionary if e['id']==task['entry'])
            result={'kind':'task-completed','entry':deepcopy(entry),'priority':'assigned'}
        elif not self.enabled:result={'kind':'blocked','reason':'recess-disabled'}
        elif self.handover:result={'kind':'blocked','reason':'teacher-handover'}
        elif self.used>=self.budget:result={'kind':'blocked','reason':'budget'}
        elif len(self.notes)>=200:result={'kind':'blocked','reason':'note-capacity'}
        else:
            candidates=[]
            for entry in self.dictionary:
                if entry['status']!='red':continue
                c=self.coverage(entry,inventory)
                key=json.dumps([entry['id'],entry['revision'],c['green'],c['yellow']],separators=(',',':'))
                if c['green'] or c['yellow']:
                    if key not in self.visited:candidates.append((entry,c,key))
            candidates.sort(key=lambda x:(-len(x[1]['green']),-len(x[1]['yellow']),x[0]['id']))
            if not candidates:result={'kind':'blocked','reason':'no-new-supported-candidate'}
            else:
                entry,c,key=candidates[0];self.visited.append(key);self.used+=1;self.streak=0
                card_id=self.request_note('question','Investigate '+entry['word']+'; known words do not yet establish its meaning.',
                    'recess-selector',[{'entry':entry['id'],'revision':entry['revision'],'source':entry['source'],'coverage':c}])
                self.notes.append(self.note_queue.pop());self.handover=True
                result={'kind':'recess-candidate','entry':entry['id'],'coverage':c,'card':card_id,'priority':'last'}
        self.events.append(deepcopy(result));return result

    def review(self,card_id,verdict,actor='teacher'):
        if len(self.events)>=1000:raise ValueError('Event capacity reached; export and reset')
        if actor!='teacher':raise PermissionError('Teacher review required')
        if verdict not in ('accepted','rejected'):raise ValueError('Invalid review')
        card=next((n for n in self.notes if n['id']==card_id),None)
        if not card or card['review']!='unreviewed':raise ValueError('No unreviewed note')
        card['review']=verdict
        # Verdict accepts/rejects a note as a record, not its semantic truth or vocabulary.
        self.events.append({'kind':'teacher-reviewed','card':card_id,'verdict':verdict})

    def hand_over(self,actor='teacher'):
        if len(self.events)>=1000:raise ValueError('Event capacity reached; export and reset')
        if actor!='teacher':raise PermissionError('Teacher review required')
        if any(n['review']=='unreviewed' for n in self.notes):raise ValueError('Review outstanding notes first')
        self.handover=False;self.events.append({'kind':'handover-completed','vocabulary_promoted':False})

    def state(self):
        return deepcopy({'format':'echo-priority-cards/1','dictionary':self.dictionary,'notes':self.notes,
            'note_queue':self.note_queue,'tasks':self.tasks,'events':self.events,'visited':self.visited,
            'enabled':self.enabled,'budget':self.budget,'used':self.used,'streak':self.streak,
            'handover':self.handover,'serial':self.serial})

    def restore(self,s):
        if s.get('format')!='echo-priority-cards/1':raise ValueError('Invalid priority state')
        for k in ['used','streak','serial','budget']:
            if type(s.get(k)) is not int or s[k]<0:raise ValueError('Invalid budget/state')
        if s['budget']>10 or s['used']>s['budget']:raise ValueError('Invalid budget')
        for k in ['enabled','handover']:
            if type(s.get(k)) is not bool:raise ValueError('Invalid flag')
        for k in ['dictionary','notes','note_queue','tasks','events','visited']:
            if not isinstance(s.get(k),list) or len(s[k])>1000:raise ValueError('Invalid collection')
        for card in s['notes']+s['note_queue']:
            if card.get('template') not in TEMPLATES or card.get('review') not in ('unreviewed','accepted','rejected') or not isinstance(card.get('body'),str) or len(card['body'])>1000:raise ValueError('Invalid note')
        for k in ['dictionary','notes','note_queue','tasks','events','visited','enabled','budget','used','streak','handover','serial']:
            setattr(self,k,deepcopy(s[k]))
