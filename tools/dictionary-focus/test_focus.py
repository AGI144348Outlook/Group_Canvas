import copy
import unittest
from focus import focus

class FocusTests(unittest.TestCase):
    def fixture(self):
        return {'summary':{},'candidates':[{'id':'a','title':'Julian fixture','role':'user','julian_context_candidate':True,'references':[{'source':'fixture'}],'excerpts':[{'text':'AI dictionary: Lexicon Resonance. Core Definition: example.'}]},{'id':'b','title':'Other','role':'assistant','julian_context_candidate':False,'references':[],'excerpts':[{'text':'unrelated dictionary mention'}]}]}
    def test_focus_preserves_evidence_and_does_not_modify_input(self):
        d=self.fixture();before=copy.deepcopy(d);r=focus(d)
        self.assertEqual(d,before);self.assertEqual(r['candidates'],[d['candidates'][0]])
        self.assertEqual(r['summary']['user_messages'],1)
    def test_order_is_deterministic_and_empty_result_is_explicit(self):
        d=self.fixture();self.assertEqual(focus(d),focus(d))
        d['candidates']=d['candidates'][1:];self.assertEqual(focus(d)['summary']['focused_candidate_messages'],0)
if __name__=='__main__':unittest.main()
