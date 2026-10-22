"""Real preserved-Echo calls, synthetic teacher fixtures; output only synthetic evidence."""
import hashlib
import json
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2] if (Path(__file__).resolve().parents[2] / 'libraries').exists() else Path('/workspace/echo-integration')
sys.path.insert(0, str(ROOT))
from libraries.echo_workspace import genesis
from libraries.catalog_box import CatalogBox
from learner import Learner, ARMS

def scenes(prefix='class'):
    a,b,c = [prefix + '-' + x for x in 'abc']
    return [
        {'entities':[a,b,c], 'speaker':b, 'addressee':a},
        {'entities':[c,a,b], 'speaker':a, 'addressee':b},
        {'entities':[b,c,a], 'speaker':c, 'addressee':a},
        {'entities':[a,c,b], 'speaker':b, 'addressee':c},
    ]

def teacher(word, scene, mapping=None):
    # Answer fixture is teacher-side only; learner.py never imports this function.
    return scene[(mapping or {'I':'speaker','you':'addressee'})[word]]

def evaluate(learner, cases=None, mapping=None):
    frozen = json.dumps(learner.state(), sort_keys=True)
    outcomes=[]
    for scene in cases or scenes('unfamiliar'):
        for word in mapping or ['I','you']:
            answer=learner.predict(word,scene)
            outcomes.append({'word':word,'scene':scene,'prediction':answer,'correct':answer['entity']==teacher(word,scene,mapping)})
    if frozen != json.dumps(learner.state(), sort_keys=True):
        raise AssertionError('Assessment changed learner state')
    return {'correct':sum(x['correct'] for x in outcomes),'total':len(outcomes),'outcomes':outcomes}

def train(learner, cycles=6, mapping=None):
    for _ in range(cycles):
        for scene in scenes():
            for word in mapping or ['I','you']:
                p=learner.attempt(word,scene)
                learner.grade(p['id'],teacher(word,scene,mapping))

def main():
    core=genesis()
    result={'format':'echo-classroom-evidence/1','source_blob':'63eb982989b4f3478d649430b555c8f4ba755c27',
            'scope':'I/you reference selection among four supplied structural hypotheses; no free language comprehension',
            'hypotheses':ARMS,'runs':{},'no_private_data':True}
    for mode in ['echo-ucb','counter']:
        learner=Learner(core,mode)
        for word in ['I','you']:learner.expose(word)
        before=evaluate(learner)
        train(learner)
        after=evaluate(learner)
        result['runs'][mode]={'before':before,'after':after,'state':learner.state(),
            'feedback_contract':'chosen-arm binary outcomes' if mode=='echo-ucb' else 'teacher-labelled reference evaluates every hypothesis; new B1-c bridge'}
    control=Learner(core,'counter')
    for word in ['I','you']:control.expose(word)
    first=evaluate(control)
    for _ in range(48):control.predict('I',scenes()[0])
    result['no_feedback']={'before':first,'after':evaluate(control)}
    learner=Learner(core,'counter',result['runs']['counter']['state'])
    out=Path(__file__).parent/'evidence';out.mkdir(exist_ok=True)
    db=out/'lesson.sqlite'
    if db.exists():raise ValueError('Use a fresh evidence directory; no overwrite')
    with CatalogBox(db) as box:
        for n,event in enumerate(learner.events):
            box.put_card('lesson:'+str(n),event['kind'],{'kind':'classroom-experience',**event},provenance={'teacher':'synthetic fixture','learner':'new bridge + preserved A-113'})
        box.put_card('learner:state','Learner checkpoint',{'kind':'learner-state','state':learner.state()})
    with CatalogBox(db) as box:
        restored=Learner(core,'counter',box.get('cards','learner:state')['body']['state'])
        result['persistence']={'restored_equal':restored.state()==learner.state(),'cards':len(box.list('cards'))}
    result['database_sha256']=hashlib.sha256(db.read_bytes()).hexdigest()
    (out/'lesson.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    (out/'summary.json').write_text(json.dumps({k:{'before':v['before']['correct'],'after':v['after']['correct'],'total':v['after']['total']} for k,v in result['runs'].items()},indent=2)+'\n')
    print((out/'summary.json').read_text())

if __name__=='__main__':main()
