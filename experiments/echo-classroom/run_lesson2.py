"""Frozen transfer lesson and reproducible priority trace; no new labels taught."""
import json
from pathlib import Path
from run_lesson import genesis, Learner, scenes
from priority_cards import PriorityCards

def novel_scenes():
    old={(s['entities'].index(s['speaker']),s['entities'].index(s['addressee'])) for s in scenes()}
    result=[]
    for n in [2,3,4]:
        for speaker in range(n):
            for addressee in range(n):
                if speaker==addressee or (n==3 and (speaker,addressee) in old):continue
                ids=[f'lesson2-{n}-{speaker}-{addressee}-{i}' for i in range(n)]
                result.append({'entities':ids,'speaker':ids[speaker],'addressee':ids[addressee]})
    return result

def assess2(learner):
    before=learner.state();items=[]
    for s in novel_scenes():
        for word,role in [('I','speaker'),('you','addressee')]:
            p=learner.predict(word,s);items.append({'word':word,'scene':s,'prediction':p,'correct':p['entity']==s[role],'kind':'novel-layout'})
    for speaker,addressee in [(None,'a'),('a',None),(None,None)]:
        s={'entities':['a','b'],'speaker':speaker,'addressee':addressee}
        for word,role in [('I','speaker'),('you','addressee')]:
            p=learner.predict(word,s);items.append({'word':word,'scene':s,'prediction':p,'correct':p['entity']==s[role],'kind':'missing-context'})
    if before!=learner.state():raise AssertionError('Frozen assessment changed learner')
    return {'correct':sum(x['correct'] for x in items),'total':len(items),'items':items,
            'novelLayouts':len(novel_scenes()),'frozen':True,'greenAdmission':False}

def priority_trace():
    p=PriorityCards();inventory={'i':{'seen':True},'you':{'seen':True}};out=[]
    p.request_note('observation','I encountered a classroom card.');p.enqueue_inspection('speaker');p.set_recess(True)
    out.append(p.tick(inventory,True));out.append(p.tick(inventory,True));out.append(p.tick(inventory))
    out.append(p.tick(inventory));out.append(p.tick(inventory))
    for note in p.notes:p.review(note['id'],'accepted')
    p.hand_over();p.enqueue_inspection('addressee');out.append(p.tick(inventory));out.append(p.tick(inventory))
    return {'steps':out,'state':p.state()}

def main():
    root=Path(__file__).parent;data=json.loads((root/'evidence/lesson.json').read_text());core=genesis()
    outputs={}
    for mode in ['counter','echo-ucb']:
        outputs[mode]=assess2(Learner(core,mode,data['runs'][mode]['state']))
    control=Learner(core);control.expose('I');control.expose('you');outputs['no-feedback']=assess2(control)
    result={'format':'echo-lesson2/1','runs':outputs,'priorities':priority_trace(),'newTrainingTurns':0}
    (root/'evidence/lesson2.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
    (root/'public/lesson2-evidence.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
    print(json.dumps({k:{'correct':v['correct'],'total':v['total']} for k,v in outputs.items()},indent=2))
if __name__=='__main__':main()
