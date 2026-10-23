import io
import unittest
import zipfile
from unittest.mock import patch
from scan import Bound, analyze, digest, paginate


class ScanTests(unittest.TestCase):
    def test_json_locations_and_candidates(self):
        result = analyze(b'{"parts":["# IETF Framework\\nDetails"]}', 'fixture.json')
        self.assertEqual(result['status'], 'analyzed')
        self.assertEqual(result['candidates'][0]['location'], 'fixture.json#$/parts/0')
        self.assertEqual(result['candidates'][0]['line'], 1)

    def test_bad_json_and_encoding_are_explicit(self):
        self.assertEqual(analyze(b'{broken', 'x.json')['status'], 'malformed-or-deep-json')
        self.assertEqual(analyze(b'\xff', 'x.txt')['status'], 'unsupported-binary-or-encoding')

    def test_pagination_and_repeated_cursor(self):
        pages = iter([{'result': [{'key': 'a'}], 'result_info': {'cursor': 'x'}}, {'result': [{'key': 'b'}], 'result_info': {}}])
        self.assertEqual(len(list(paginate(lambda p: next(pages), '/objects'))), 2)
        with self.assertRaises(Bound):
            list(paginate(lambda p: {'result': [], 'result_info': {'cursor': 'x'}}, '/objects'))

    def test_archive_names_are_labels(self):
        data = io.BytesIO()
        with zipfile.ZipFile(data, 'w') as archive:
            archive.writestr('../../outside.txt', '# Framework A')
        result = analyze(data.getvalue(), 'x.zip')
        self.assertEqual(result['status'], 'analyzed')
        self.assertIn('../../outside.txt', result['candidates'][0]['location'])

    def test_archive_and_candidate_limits(self):
        data = io.BytesIO()
        with zipfile.ZipFile(data, 'w') as archive:
            archive.writestr('x.txt', 'Framework')
        with patch('scan.MAX_OBJECT', 1):
            self.assertEqual(analyze(data.getvalue(), 'x.zip')['status'], 'archive-expansion-limit')
        with patch('scan.MAX_CANDIDATES', 1):
            self.assertEqual(analyze(b'Framework A\nFramework B', 'x.txt')['status'], 'candidate-limit')

    def test_duplicate_identity_is_exact_bytes(self):
        self.assertEqual(digest(b'a'), digest(b'a'))
        self.assertNotEqual(digest(b'a'), digest(b'a '))

    def test_encrypted_zip_member_rejected(self):
        data = io.BytesIO()
        with zipfile.ZipFile(data, 'w') as archive:
            archive.writestr('x.txt', 'Framework')
        with patch('scan.zipfile.ZipFile') as mock:
            info = zipfile.ZipInfo('x.txt'); info.flag_bits = 1; info.file_size = 1
            mock.return_value.__enter__.return_value.infolist.return_value = [info]
            self.assertEqual(analyze(data.getvalue(), 'x.zip')['status'], 'encrypted-archive-member')


if __name__ == '__main__':
    unittest.main()
