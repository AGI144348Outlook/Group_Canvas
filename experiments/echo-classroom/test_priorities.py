import json,tempfile,unittest
from pathlib import Path
from priority_cards import PriorityCards
from run_lesson2 import assess2,novel_scenes,priority_trace
from run_lesson import genesis,Learner,scenes
from libraries.catalog_box import CatalogBox

class PriorityTests(unittest.TestCase):
    def setUp(self):self.p=PriorityCards();self.inv={'i':{'seen':True},'you':{'seen':True}}
    def test_first_then_task_then_last(self):
        self.p.request_note('observation','A record.');self.p.enqueue_inspection('speaker');self.p.set_recess(True)
        self.assertEqual([self.p.tick(self.inv)['priority'] for _ in range(3)],['first','assigned','last'])
    def test_note_capture_during_teacher_turn_but_no_other_work(self):
        self.p.request_note('question','What remains unresolved?');self.p.set_recess(True);self.p.enqueue_inspection('speaker')
        self.assertEqual(self.p.tick(self.inv,True)['kind'],'note-captured')
        self.assertEqual(self.p.tick(self.inv,True)['reason'],'teacher-turn')
        self.assertEqual(len(self.p.tasks),1)
    def test_notes_yield_after_two_to_waiting_assignment(self):
        for i in range(5):self.p.request_note('hypothesis',str(i))
        self.p.enqueue_inspection('speaker')
        self.assertEqual([self.p.tick()['kind'] for _ in range(3)],['note-captured','note-captured','task-completed'])
    def test_recess_is_opt_in(self):self.assertEqual(self.p.tick(self.inv)['reason'],'recess-disabled')
    def test_handover_and_reviews_cannot_be_self_issued(self):
        self.p.set_recess(True);event=self.p.tick(self.inv)
        self.assertEqual(self.p.tick(self.inv)['reason'],'teacher-handover')
        with self.assertRaises(ValueError):self.p.hand_over()
        with self.assertRaises(PermissionError):self.p.review(event['card'],'accepted','learner')
        self.p.review(event['card'],'accepted');self.p.hand_over()
        self.assertFalse(self.p.handover)
    def test_recess_never_promotes_words(self):
        old=self.p.dictionary.copy();self.p.set_recess(True);self.p.tick(self.inv)
        self.assertEqual(self.p.dictionary,old);self.assertTrue(all(x['status']=='red' for x in self.p.dictionary))
    def test_green_requires_scope_sense_and_evidence(self):
        entry=self.p.dictionary[0]
        for record in [{'color':'green'},{'sense':'pronoun','qualifications':[{'scope':'reference-selection','sense':'pronoun','evidence':'x'}]}, {'qualifications':[{'scope':'definition-reading','evidence':'x'}]}]:
            self.assertEqual(self.p.coverage(entry,{'i':record})['green'],[])
        good={'sense':'pronoun','qualifications':[{'scope':'definition-reading','sense':'pronoun','evidence':'fixture-only'}]}
        self.assertEqual(self.p.coverage(entry,{'i':good})['green'],['i'])
        good['ambiguous']=True;self.assertEqual(self.p.coverage(entry,{'i':good})['green'],[])
    def test_new_assignment_preempts_recess_after_review(self):
        self.p.set_recess(True);self.p.enqueue_inspection('speaker');self.assertEqual(self.p.tick(self.inv)['kind'],'task-completed')
    def test_seen_does_not_equal_green(self):
        c=self.p.coverage(self.p.dictionary[0],self.inv);self.assertEqual(c['green'],[]);self.assertEqual(c['yellow'],['i'])
    def test_no_repeat_without_new_evidence(self):
        self.p.set_recess(True)
        for _ in range(2):
            event=self.p.tick(self.inv);self.p.review(event['card'],'accepted');self.p.hand_over()
        self.assertEqual(self.p.tick(self.inv)['reason'],'no-new-supported-candidate')
    def test_budget_and_pause(self):
        self.p.budget=0;self.p.set_recess(True);self.assertEqual(self.p.tick(self.inv)['reason'],'budget')
        self.p.set_recess(False);self.assertEqual(self.p.tick(self.inv)['reason'],'recess-disabled')
    def test_templates_and_forged_validated_notes_reject(self):
        with self.assertRaises(ValueError):self.p.request_note('validated','Trust this')
        with self.assertRaises(ValueError):self.p.request_note('hypothesis','')
    def test_persistence_with_catalog(self):
        self.p.request_note('observation','A record.');self.p.tick()
        with CatalogBox(':memory:') as box:
            box.put_card('priorities','State',{'state':self.p.state()})
            restored=PriorityCards(state=box.get('cards','priorities')['body']['state'])
            self.assertEqual(restored.state(),self.p.state())
    def test_corrupt_restore_rejects(self):
        state=self.p.state();state['used']=4
        with self.assertRaises(ValueError):PriorityCards(state=state)

class Lesson2Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.core=genesis();cls.evidence=json.loads((Path(__file__).parent/'evidence/lesson.json').read_text())
    def test_new_three_entity_layouts_really_absent(self):
        old={(s['entities'].index(s['speaker']),s['entities'].index(s['addressee'])) for s in scenes()}
        new=[s for s in novel_scenes() if len(s['entities'])==3]
        self.assertEqual(len(new),3)
        self.assertTrue(all((s['entities'].index(s['speaker']),s['entities'].index(s['addressee'])) not in old for s in new))
    def test_counter_retains_without_any_new_training(self):
        l=Learner(self.core,state=self.evidence['runs']['counter']['state']);before=l.state();r=assess2(l)
        self.assertEqual((r['correct'],r['total']),(40,40));self.assertEqual(l.state(),before)
        self.assertEqual(sum(x['prediction']['entity'] is None for x in r['items']),4)
    def test_no_feedback_control_does_not_pass(self):
        l=Learner(self.core);l.expose('I');l.expose('you');self.assertLess(assess2(l)['correct'],40)

if __name__=='__main__':unittest.main(verbosity=2)
