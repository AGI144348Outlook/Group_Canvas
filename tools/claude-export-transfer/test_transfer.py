import copy
import hashlib
import io
import unittest
import zipfile
from transfer import TransferError, ensure_copy, sha, transfer, validate_source


class FakeR2:
    def __init__(self):
        self.objects = {}; self.puts = 0; self.corrupt = False

    def get(self, key):
        if key not in self.objects:
            return None
        data = self.objects[key]
        return {'sha256': sha(data), 'bytes': len(data)}

    def put(self, key, data):
        self.puts += 1
        self.objects[key] = b'corrupt' if self.corrupt else data


def fixture():
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, 'w') as z:
        z.writestr('conversations.json', '[]')
    data = stream.getvalue()
    f = {'name': 'conversations-000.zip', 'path': 'docs/conversations-000.zip',
         'bytes': len(data), 'git_blob_sha1': hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()}
    m = {'source_repository': 'AGI144348Outlook/Echo_Green_Future', 'source_commit': 'a' * 40,
         'bucket': 'group-canvas-citadel-sources', 'prefix': 'claude-exports/2026-10-20/',
         'missing_expected_archives': ['frames-000.zip'], 'files': [f]}
    return m, data


class Tests(unittest.TestCase):
    def test_success_and_retry_preserve_original_bytes(self):
        m, data = fixture(); r2 = FakeR2()
        first = transfer(m, r2, lambda url, count: data)
        writes = r2.puts
        second = transfer(m, r2, lambda url, count: data)
        self.assertEqual(first, second)
        self.assertEqual(r2.puts, writes)
        self.assertEqual(r2.objects[m['prefix'] + m['files'][0]['name']], data)

    def test_conflict_is_not_overwritten(self):
        r2 = FakeR2(); r2.objects['key'] = b'old'
        with self.assertRaises(TransferError):
            ensure_copy(r2, 'key', b'new')
        self.assertEqual(r2.objects['key'], b'old'); self.assertEqual(r2.puts, 0)

    def test_readback_mismatch_fails(self):
        r2 = FakeR2(); r2.corrupt = True
        with self.assertRaises(TransferError):
            ensure_copy(r2, 'key', b'new')

    def test_bad_source_prevents_all_writes(self):
        m, data = fixture(); r2 = FakeR2()
        with self.assertRaises(TransferError):
            transfer(m, r2, lambda url, count: data[:-1])
        self.assertEqual(r2.puts, 0)

    def test_source_hash_mismatch_rejected(self):
        m, data = fixture(); m['files'][0]['git_blob_sha1'] = '0' * 40
        with self.assertRaises(TransferError):
            validate_source(data, m['files'][0])

    def test_wrong_destination_or_traversal_rejected_before_download(self):
        m, data = fixture()
        variants = []
        bad = copy.deepcopy(m); bad['prefix'] = 'gpt/'; variants.append(bad)
        bad = copy.deepcopy(m); bad['files'][0]['name'] = '../bad'; variants.append(bad)
        bad = copy.deepcopy(m); bad['files'].append(bad['files'][0]); variants.append(bad)
        for bad in variants:
            r2 = FakeR2()
            with self.assertRaises(TransferError):
                transfer(bad, r2, lambda *args: self.fail('must not download'))
            self.assertEqual(r2.puts, 0)


if __name__ == '__main__':
    unittest.main()
