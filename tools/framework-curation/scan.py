"""Read-only private R2 inventory; source text is never printed or executed."""
import gzip
import hashlib
import io
import json
import os
import re
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path
from xml.etree import ElementTree

MAX_OBJECT = 512 * 1024**2
MAX_TEXT = 32 * 1024**2
MAX_TOTAL = 2 * 1024**3
MAX_CANDIDATES = 10000
PATTERN = re.compile(r'(?i)\b(codex|framework|architecture|blueprint|design|protocol|model|engine|domain|lvt|ietf|nve|tema|mashet|foundry|chronotool)\b')


class Bound(Exception):
    pass


def digest(data):
    return hashlib.sha256(data).hexdigest()


def paginate(fetch, path, field=None, max_pages=200):
    cursor = None
    seen = set()
    for _ in range(max_pages):
        query = {'per_page': 1000 if field is None else 100}
        if cursor:
            query['cursor'] = cursor
        page = fetch(path + '?' + urllib.parse.urlencode(query))
        result = page.get('result')
        rows = result.get(field) if field and isinstance(result, dict) else result
        if not isinstance(rows, list):
            raise Bound('unsupported-list-schema')
        yield from rows
        info = page.get('result_info') or {}
        nxt = info.get('cursor') or (result.get('cursor') if isinstance(result, dict) else None)
        truncated = info.get('is_truncated', False)
        if not nxt:
            if truncated or info.get('total_count', len(rows)) > len(rows) and not seen:
                raise Bound('pagination-incomplete')
            return
        if nxt in seen:
            raise Bound('repeated-pagination-cursor')
        seen.add(nxt)
        cursor = nxt
    raise Bound('pagination-limit')


def text_candidates(text, location):
    if len(text.encode('utf-8')) > MAX_TEXT:
        raise Bound('text-document-limit')
    for line_no, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if len(stripped) <= 1000 and PATTERN.search(stripped):
            # Candidates include ordinary discussion; this is not semantic certification.
            yield {'location': location, 'line': line_no, 'text': stripped}


def json_strings(value, location='$', depth=0):
    if depth > 100:
        raise Bound('json-depth-limit')
    if isinstance(value, str):
        yield value, location
    elif isinstance(value, list):
        for i, item in enumerate(value):
            yield from json_strings(item, location + '/' + str(i), depth + 1)
    elif isinstance(value, dict):
        for key, item in value.items():
            escaped = str(key).replace('~', '~0').replace('/', '~1')
            yield from json_strings(item, location + '/' + escaped, depth + 1)


def documents(data, name, depth=0, budget=None):
    if depth > 20:
        raise Bound('archive-depth-limit')
    if budget is None:
        budget = [MAX_OBJECT]
    low = name.lower()
    if low.endswith('.docx'):
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            info = archive.getinfo('word/document.xml')
            if info.file_size > MAX_TEXT or info.flag_bits & 1:
                raise Bound('docx-limit-or-encrypted')
            raw = archive.read(info)
            root = ElementTree.fromstring(raw)
            ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
            yield '\n'.join(''.join(p.itertext()) for p in root.iter(ns + 'p')), name
        return
    if low.endswith('.zip') or data[:4] == b'PK\x03\x04':
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            infos = archive.infolist()
            if len(infos) > 20000 or sum(i.file_size for i in infos) > budget[0]:
                raise Bound('archive-expansion-limit')
            for info in infos:
                if info.is_dir():
                    continue
                if info.flag_bits & 1:
                    raise Bound('encrypted-archive-member')
                if info.file_size > MAX_OBJECT:
                    raise Bound('archive-member-limit')
                budget[0] -= info.file_size
                if budget[0] < 0:
                    raise Bound('archive-expansion-limit')
                # Member names are labels only, never filesystem paths.
                yield from documents(archive.read(info), name + '!/' + info.filename, depth + 1, budget)
        return
    if low.endswith('.gz') or data[:2] == b'\x1f\x8b':
        with gzip.GzipFile(fileobj=io.BytesIO(data)) as stream:
            expanded = stream.read(min(MAX_OBJECT, budget[0]) + 1)
        budget[0] -= len(expanded)
        if len(expanded) > MAX_OBJECT or budget[0] < 0:
            raise Bound('gzip-expansion-limit')
        yield from documents(expanded, name[:-3], depth + 1, budget)
        return
    if low.endswith('.pdf') or data[:4] == b'%PDF':
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted or len(reader.pages) > 10000:
            raise Bound('pdf-encrypted-or-page-limit')
        for index, page in enumerate(reader.pages):
            yield page.extract_text() or '', name + '#page=' + str(index + 1)
        return
    try:
        text = data.decode('utf-8-sig')
    except UnicodeDecodeError:
        raise Bound('unsupported-binary-or-encoding') from None
    if '\x00' in text:
        raise Bound('unsupported-binary-text')
    if low.endswith('.json') or (not low.endswith(('.jsonl', '.ndjson')) and text.lstrip().startswith(('{', '['))):
        try:
            parsed = json.loads(text)
        except (ValueError, RecursionError):
            raise Bound('malformed-or-deep-json') from None
        for item, location in json_strings(parsed):
            yield item, name + '#' + location
    elif low.endswith('.jsonl') or low.endswith('.ndjson'):
        for number, line in enumerate(text.splitlines(), 1):
            if not line.strip():
                continue
            try:
                parsed = json.loads(line)
            except ValueError:
                raise Bound('malformed-jsonl') from None
            for item, location in json_strings(parsed):
                yield item, name + '#line=' + str(number) + location
    else:
        yield text, name


def analyze(data, name):
    candidates = []
    count = 0
    try:
        for text, location in documents(data, name):
            count += 1
            for row in text_candidates(text, location):
                if len(candidates) >= MAX_CANDIDATES:
                    raise Bound('candidate-limit')
                candidates.append(row)
        return {'status': 'analyzed', 'documents': count, 'candidates': candidates}
    except Exception as exc:
        status = str(exc) if isinstance(exc, Bound) else 'parser-error:' + type(exc).__name__
        return {'status': status, 'documents': count, 'candidates': candidates}


class API:
    def __init__(self):
        account = os.environ.get('CLOUDFLARE_ACCOUNT_ID', '')
        self.token = os.environ.get('CLOUDFLARE_API_TOKEN', '')
        if not re.fullmatch('[a-fA-F0-9]{32}', account) or not self.token:
            raise Bound('existing-credential-unavailable')
        self.base = 'https://api.cloudflare.com/client/v4/accounts/' + account + '/r2/buckets'

    def get(self, path, raw=False):
        request = urllib.request.Request(self.base + path, headers={'Authorization': 'Bearer ' + self.token})
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                data = response.read((MAX_OBJECT if raw else 16 * 1024**2) + 1)
        except urllib.error.HTTPError as exc:
            raise Bound('read-http-' + str(exc.code)) from None
        except Exception:
            raise Bound('read-unavailable') from None
        if len(data) > (MAX_OBJECT if raw else 16 * 1024**2):
            raise Bound('response-size-limit')
        if raw:
            return data
        result = json.loads(data)
        if result.get('success') is False:
            raise Bound('api-denied')
        return result


def main():
    report = {'format': 'private-framework-candidates/1', 'buckets': [], 'objects': [], 'errors': [], 'originals_unchanged': True, 'complete_inventory': False}
    downloaded = 0
    seen = {}
    try:
        api = API()
        for bucket in paginate(api.get, '', 'buckets'):
            if len(report['buckets']) >= 100:
                raise Bound('bucket-limit')
            name = bucket.get('name')
            if not isinstance(name, str):
                raise Bound('unsupported-bucket-schema')
            bucket_record = {'name': name, 'jurisdiction': bucket.get('jurisdiction'), 'listed': False}
            report['buckets'].append(bucket_record)
            try:
                path = '/' + urllib.parse.quote(name, safe='') + '/objects'
                for obj in paginate(api.get, path):
                    if len(report['objects']) >= 20000:
                        raise Bound('object-count-limit')
                    key = obj.get('key')
                    if not isinstance(key, str):
                        raise Bound('unsupported-object-schema')
                    row = {'bucket': name, 'key': key, 'size': obj.get('size'), 'etag': obj.get('etag')}
                    report['objects'].append(row)
                    if not isinstance(row['size'], int) or row['size'] > MAX_OBJECT:
                        row['status'] = 'unsupported-size-or-object-limit'
                        continue
                    if downloaded + row['size'] > MAX_TOTAL:
                        row['status'] = 'aggregate-download-limit'
                        continue
                    try:
                        data = api.get(path + '/' + urllib.parse.quote(key, safe=''), raw=True)
                        downloaded += len(data)
                        row['sha256'] = digest(data)
                        if len(data) != row['size']:
                            row['status'] = 'listed-read-size-mismatch'
                        elif row['sha256'] in seen:
                            row.update({'status': 'exact-byte-duplicate', 'duplicate_of': seen[row['sha256']]})
                        else:
                            seen[row['sha256']] = len(report['objects']) - 1
                            row.update(analyze(data, key))
                    except Bound as exc:
                        row['status'] = str(exc)
                bucket_record['listed'] = True
            except Bound as exc:
                bucket_record['error'] = str(exc)
        report['complete_inventory'] = all(b['listed'] for b in report['buckets'])
    except Exception as exc:
        report['errors'].append(str(exc) if isinstance(exc, Bound) else 'runner-error:' + type(exc).__name__)
    summary = {'buckets': len(report['buckets']), 'listed_buckets': sum(b['listed'] for b in report['buckets']), 'objects': len(report['objects']), 'downloaded_bytes': downloaded, 'analyzed_objects': sum(o.get('status') == 'analyzed' for o in report['objects']), 'duplicates': sum(o.get('status') == 'exact-byte-duplicate' for o in report['objects']), 'candidate_occurrences': sum(len(o.get('candidates', [])) for o in report['objects']), 'incomplete_objects': sum(o.get('status') not in ('analyzed', 'exact-byte-duplicate') for o in report['objects']), 'complete_inventory': report['complete_inventory'], 'complete_content_review': False, 'errors': report['errors'], 'originals_unchanged': True}
    report['summary'] = summary
    Path('curation-result').mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as directory:
        source = Path(directory) / 'inventory.json.gz'
        source.write_bytes(gzip.compress(json.dumps(report, ensure_ascii=False).encode()))
        subprocess.run(['openssl', 'cms', '-encrypt', '-binary', '-aes-256-cbc', '-in', str(source), '-out', 'curation-result/private-inventory.cms', '-outform', 'DER', 'tools/framework-curation/recipient.pem'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    Path('curation-result/summary.json').write_text(json.dumps(summary, indent=2))
    print('PRIVATE CURATION SUMMARY ' + json.dumps(summary), flush=True)
    return 1 if report['errors'] or not report['complete_inventory'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
