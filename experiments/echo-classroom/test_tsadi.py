import json,unittest
from pathlib import Path
from tsadi_tool import TsadiTool,profile

SCENE={'entities':['visitor-a','visitor-b'],'speaker':None,'addressee':None}
class ToolTests(unittest.TestCase):
    def ready(self):t=TsadiTool();t.copy_tool(profile());return t
    def test_copy_before_use(self):
        t=TsadiTool()
        with self.assertRaises(ValueError):t.ask('Who','speaker',SCENE)
        bad=profile();bad['symbol']='ץ'
        with self.assertRaises(ValueError):t.copy_tool(bad)
        t.copy_tool(profile());self.assertTrue(t.copied)
    def test_only_who_authorized(self):
        t=self.ready()
        for word in ['What','When','Where','Why','How']:
            with self.assertRaises(PermissionError):t.ask(word,'speaker',SCENE)
    def test_no_caller_green_bypass(self):
        t=self.ready();s=t.state();s['cards'][0]['profile']['slots'][1]['status']='green'
        with self.assertRaises(ValueError):TsadiTool(s)
    def test_question_uses_unknown_context_no_answer(self):
        t=self.ready();q=t.ask('Who','speaker',SCENE)
        self.assertIsNone(q['scene']['speaker']);self.assertEqual(q['expression'],'Who is speaking?')
        with self.assertRaises(ValueError):t.ask('Who','addressee',SCENE)
        t.answer(q['id'],'visitor-b');self.assertEqual(t.completed,1)
    def test_known_target_or_answer_injection_rejected(self):
        t=self.ready()
        with self.assertRaises(ValueError):t.ask('Who','speaker',{**SCENE,'speaker':'visitor-a'})
        with self.assertRaises(ValueError):t.ask('Who','speaker',{**SCENE,'answer':'visitor-a'})
    def test_teacher_reply_guard_and_single_use(self):
        t=self.ready();q=t.ask('Who','addressee',SCENE)
        with self.assertRaises(PermissionError):t.answer(q['id'],'visitor-a','learner')
        with self.assertRaises(ValueError):t.answer(q['id'],'missing')
        r=t.answer(q['id'],'visitor-a');self.assertFalse(r['vocabulary_promoted'])
        with self.assertRaises(ValueError):t.answer(q['id'],'visitor-a')
    def test_expansion_preserves_card_profile(self):
        t=self.ready();before=t.state()['cards'][0];t.expand('own:tsadi')
        self.assertEqual(t.cards[0]['id'],before['id']);self.assertEqual(t.cards[0]['profile'],before['profile']);self.assertEqual(t.cards[0]['lines'][:3],before['lines'])
    def test_valid_relations_and_dedup(self):
        t=self.ready();a=t.paperclip('practice:encounter','practice:context');b=t.paperclip('practice:context','practice:encounter');self.assertEqual(a,b)
        with self.assertRaises(ValueError):t.paperclip('own:tsadi','own:tsadi')
        with self.assertRaises(ValueError):t.paperclip('missing','own:tsadi')
    def test_pending_and_history_restore(self):
        t=self.ready();t.expand('own:tsadi');t.ask('Who','speaker',SCENE);r=TsadiTool(t.state());self.assertEqual(r.state(),t.state())

def fixture():
    t=TsadiTool();t.copy_tool(profile());t.expand('own:tsadi');t.paperclip('practice:encounter','practice:context');t.ask('Who','speaker',SCENE);pending=t.state();t.answer(1,'visitor-b')
    p=Path(__file__).parent/'evidence/tsadi.json';p.write_text(json.dumps({'format':'echo-tsadi-fixture/1','pending':pending,'complete':t.state()},separators=(',',':'))+'\n')
if __name__=='__main__':
    suite=unittest.defaultTestLoader.loadTestsFromTestCase(ToolTests);r=unittest.TextTestRunner(verbosity=2).run(suite)
    if not r.wasSuccessful():raise SystemExit(1)
    fixture()
