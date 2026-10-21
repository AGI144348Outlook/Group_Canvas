"""Synthetic data only; these are extraction checks, not comprehension tests."""
import unittest
from search import Recovery,signals,selected_path,text_of

class RecoveryTests(unittest.TestCase):
    def test_openai_and_claude_text(self):
        self.assertEqual(text_of({'content':{'parts':['a',{},'b']}}),'a\nb')
        self.assertEqual(text_of({'content':[{'text':'c'}]}),'c')
    def test_definition_shape_differs_from_mention(self):
        self.assertEqual(signals('Functional Translation: a fixture')[2],'definition-shaped-candidate')
        self.assertEqual(signals('We may write a dictionary someday.')[2],'dictionary-discussion-or-mention')
    def test_exact_unicode_offsets_and_bounds(self):
        text='ß '+('x'*2000)+' Definition '+('y'*5000)
        terms,spans,_=signals(text)
        self.assertIn('definition',terms)
        self.assertLessEqual(sum(len(s['text']) for s in spans),3600)
        for s in spans:self.assertEqual(s['text'],text[s['start_codepoint']:s['end_codepoint']])
    def test_selected_path_and_cycle(self):
        self.assertEqual(selected_path({'a':{'parent':None},'b':{'parent':'a'}},'b'),({'a','b'},True))
        self.assertFalse(selected_path({'a':{'parent':'a'}},'a')[1])
    def test_julian_context_is_candidate_not_authorship(self):
        r=Recovery();r.add('claude',{'id':'c','name':'Julian fixture','chat_messages':[{'id':'m','sender':'assistant','text':'Functional Translation: fixture'}]},{'source_id':'test','sha256':'fixture'})
        row=next(iter(r.records.values()));self.assertTrue(row['julian_context_candidate']);self.assertEqual(row['julian_attribution'],'not-verified')
    def test_source_dedup_preserves_references(self):
        r=Recovery();c={'id':'c','messages':[{'id':'m','role':'user','text':'A dictionary definition.'}]}
        r.add('claude',c,{'source_id':'a'});r.add('claude',c,{'source_id':'b'})
        self.assertEqual(len(r.records),1);self.assertEqual(len(next(iter(r.records.values()))['references']),2)
    def test_branches_and_roles(self):
        r=Recovery();mapping={'a':{'parent':None,'message':{'author':{'role':'user'},'content':{'parts':['dictionary']}}},'b':{'parent':'a','message':{'author':{'role':'assistant'},'content':{'parts':['definition']}}},'c':{'parent':'a','message':{'author':{'role':'assistant'},'content':{'parts':['lexicon']}}},'tool':{'parent':None,'message':{'author':{'role':'tool'},'content':{'parts':['definition']}}}}
        r.add('openai',{'id':'c','mapping':mapping,'current_node':'b'},{'source_id':'s'})
        self.assertEqual(len(r.records),3);self.assertEqual(r.skipped_roles,1)
        self.assertEqual(next(x for x in r.records.values() if x['message_id']=='c')['references'][0]['branch'],'other-recorded-branch')
    def test_same_identity_changed_text_not_overwritten(self):
        r=Recovery()
        for text in ['dictionary one','dictionary two']:r.add('claude',{'id':'c','messages':[{'id':'m','role':'user','text':text}]},{'source_id':'s'})
        self.assertEqual(len(r.records),2)

if __name__=='__main__':unittest.main()
