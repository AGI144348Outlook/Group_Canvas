import json
import sys
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
if not (ROOT/'libraries').exists():ROOT=Path('/workspace/echo-integration')
sys.path.insert(0,str(ROOT))
from libraries.echo_workspace import genesis
from learner import Learner
from run_lesson import scenes, teacher, evaluate, train

class LearningTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.core=genesis()
    def test_counter_changes_and_transfers(self):
        l=Learner(self.core)
        for w in ['I','you']:l.expose(w)
        before=evaluate(l)['correct'];train(l)
        self.assertLess(before,8);self.assertEqual(evaluate(l)['correct'],8)
    def test_labels_can_be_arbitrary_and_roles_reversed(self):
        l=Learner(self.core);mapping={'opaque-z':'addressee','opaque-k':'speaker'}
        train(l,mapping=mapping)
        self.assertEqual(evaluate(l,mapping=mapping)['correct'],8)
        # Even I/you can be taught the reverse convention: not hard-coded answers.
        r=Learner(self.core);rev={'I':'addressee','you':'speaker'};train(r,mapping=rev)
        self.assertEqual(evaluate(r,mapping=rev)['correct'],8)
    def test_freeze_and_no_feedback(self):
        l=Learner(self.core);l.expose('I');l.expose('you');state=l.state()
        for _ in range(10):evaluate(l)
        self.assertEqual(l.state(),state)
    def test_grade_requires_pending_teacher_and_is_single_use(self):
        l=Learner(self.core);s=scenes()[0];p=l.attempt('I',s)
        with self.assertRaises(ValueError):l.attempt('you',s)
        with self.assertRaises(PermissionError):l.grade(p['id'],teacher('I',s),actor='learner')
        with self.assertRaises(ValueError):l.grade(p['id'],'absent')
        l.grade(p['id'],teacher('I',s))
        with self.assertRaises(ValueError):l.grade(p['id'],teacher('I',s))
    def test_restore_preserves_pending_and_evidence(self):
        l=Learner(self.core);s=scenes()[0];p=l.attempt('I',s)
        r=Learner(self.core,state=l.state());self.assertEqual(r.state(),l.state())
        r.grade(p['id'],teacher('I',s));train(r)
        self.assertEqual(evaluate(Learner(self.core,state=r.state()))['correct'],8)
    def test_input_has_no_teacher_answer_and_unknown_abstains(self):
        l=Learner(self.core);self.assertIsNone(l.predict('unknown',scenes()[0])['entity'])
        with self.assertRaises(ValueError):l.predict('I',{**scenes()[0],'answer':'class-b'})
    def test_missing_learned_referent_abstains(self):
        l=Learner(self.core);train(l)
        self.assertIsNone(l.predict('I',{'entities':['x'],'speaker':None,'addressee':'x'})['entity'])
    def test_bad_counters_rejected(self):
        l=Learner(self.core);l.expose('I');s=l.state();s['links']['I']['speaker']['counter']=4
        with self.assertRaises(ValueError):Learner(self.core,state=s)
    def test_existing_ucb_calls_have_feedback_and_checkpoints(self):
        l=Learner(self.core,'echo-ucb');train(l)
        self.assertTrue(l.matrix.history)
        self.assertEqual(l.completed,48)
        self.assertEqual(sum(e['checkpoint'] is not None for e in l.events if e['kind']=='feedback'),12)
        self.assertTrue(l.identity.validate())

if __name__=='__main__':unittest.main(verbosity=2)
