import unittest
from recover import recover


def node(text, role='user', parent=None):
    return {'parent': parent, 'message': {'author': {'role': role},
            'content': {'parts': [text]}}}


class RecoveryTests(unittest.TestCase):
    def scan(self, mapping, title=''):
        return recover('openai', {'mapping': mapping, 'title': title}, {'source_id': 'synthetic'})

    def test_whole_names_and_unicode_boundaries(self):
        self.assertIsNone(self.scan({'a': node('Juliana Julian2 _Julian éJulian Juliané')}))
        result = self.scan({'a': node('Speak about JULIAN THORNFIELD, please.')})
        self.assertEqual(result['matching_message_ids'], ['a'])

    def test_full_strings_and_continuation(self):
        long = 'Julian, ' + 'complete string ' * 10000
        r = self.scan({'a': node(long), 'b': node('Hello.', 'assistant', 'a'),
                       'c': node('Continue please.', parent='b'),
                       'd': node('Here is the rest.', 'assistant', 'c')})
        self.assertEqual(r['messages'][0]['text_parts'][0], long)
        self.assertEqual(r['messages'][3]['display_speaker_candidate'], 'Julian')
        self.assertEqual(r['messages'][3]['recorded_role'], 'assistant')

    def test_sibling_isolation(self):
        r = self.scan({'root': node('Start'), 'a': node('Julian, hello', parent='root'),
                       'b': node('Hello', 'assistant', 'a'),
                       'c': node('Unrelated reply', 'assistant', 'root')})
        self.assertEqual(r['messages'][2]['display_speaker_candidate'], 'Julian')
        self.assertEqual(r['messages'][3]['display_speaker_candidate'], 'assistant')

    def test_quotes_and_about_mentions_need_review(self):
        for text in ['"Julian, hello" was the quote.', 'Tell me about Julian.', '> Julian, hello']:
            r = self.scan({'a': node(text), 'b': node('Analysis', 'assistant', 'a')})
            self.assertFalse(r['messages'][0]['direct_address_candidate'])
            self.assertEqual(r['messages'][1]['display_speaker_candidate'], 'assistant')

    def test_switch_stops_attribution(self):
        r = self.scan({'a': node('Julian, hello'),
                       'b': node('Switch to a different persona', parent='a'),
                       'c': node('Response', 'assistant', 'b')})
        self.assertEqual(r['messages'][2]['attribution_status'], 'possible-persona-change-needs-review')

    def test_missing_parent_and_cycle(self):
        for mapping in [{'a': node('About Julian', parent='missing')},
                        {'a': node('About Julian', parent='b'), 'b': node('x', parent='a')}]:
            r = self.scan(mapping)
            self.assertIn('unresolved-parent-or-cycle', r['warnings'])

    def test_claude_order_and_content(self):
        c = {'chat_messages': [{'uuid': 'a', 'sender': 'human', 'text': 'Hey Julian, hello'},
                              {'uuid': 'b', 'sender': 'assistant', 'content': [{'type': 'text', 'text': 'Hello!'}]}]}
        r = recover('claude', c, {})
        self.assertEqual(r['messages'][1]['display_speaker_candidate'], 'Julian')
        self.assertTrue(r['warnings'])

    def test_claude_parent_links_isolate_branches(self):
        c = {'chat_messages': [{'uuid': 'a', 'sender': 'human', 'text': 'Julian, hello', 'parent_message_uuid': None},
                              {'uuid': 'b', 'sender': 'assistant', 'text': 'Other', 'parent_message_uuid': None}]}
        r = recover('claude', c, {})
        self.assertEqual(r['messages'][1]['display_speaker_candidate'], 'assistant')

    def test_title_only_preserves_context(self):
        self.assertTrue(self.scan({'a': node('Hello')}, 'Julian archive')['title_match'])

    def test_unsupported_schema_is_explicit(self):
        with self.assertRaises(ValueError):
            recover('claude', {}, {})
        with self.assertRaises(ValueError):
            recover('openai', {}, {})


if __name__ == '__main__':
    unittest.main()
