"""Copy pinned export archives into an existing private R2 bucket; no extraction or training."""
import hashlib
import json
import os
import re
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path


class TransferError(Exception):
    pass


def sha(data):
    return hashlib.sha256(data).hexdigest()


def validate_manifest(manifest):
    if manifest.get('source_repository') != 'AGI144348Outlook/Echo_Green_Future':
        raise TransferError('Unexpected source repository')
    if not re.fullmatch('[a-f0-9]{40}', manifest.get('source_commit', '')):
        raise TransferError('A pinned commit is required')
    if manifest.get('bucket') != 'group-canvas-citadel-sources' or manifest.get('prefix') != 'claude-exports/2026-10-20/':
        raise TransferError('Unexpected destination')
    seen = set()
    for f in manifest.get('files', []):
        if not re.fullmatch(r'[A-Za-z0-9_.-]+', f.get('name', '')):
            raise TransferError('Invalid source filename')
        if f.get('path') != 'docs/' + f['name'] or f['name'] in seen:
            raise TransferError('Invalid or duplicate source path')
        if type(f.get('bytes')) is not int or not 0 < f['bytes'] <= 100 * 1024**2:
            raise TransferError('Source size is outside transfer limits')
        if not re.fullmatch('[a-f0-9]{40}', f.get('git_blob_sha1', '')):
            raise TransferError('Missing source blob identity')
        seen.add(f['name'])
    if not seen:
        raise TransferError('Empty source manifest')


def validate_source(data, f):
    if len(data) != f['bytes']:
        raise TransferError('Source size mismatch')
    identity = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    if identity != f['git_blob_sha1']:
        raise TransferError('Source Git blob mismatch')
    # Inspect ZIP directories and CRCs, never extract to paths or execute contents.
    if f['name'].endswith('.zip'):
        import io
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            if any(i.flag_bits & 1 for i in archive.infolist()):
                raise TransferError('Encrypted archive cannot be verified')
            if sum(i.file_size for i in archive.infolist()) > 2 * 1024**3:
                raise TransferError('Archive expansion exceeds verification budget')
            if archive.testzip() is not None:
                raise TransferError('ZIP CRC check failed')
    else:
        json.loads(data)
    return sha(data)


def fetch_source(url, expected_bytes):
    try:
        with urllib.request.urlopen(url, timeout=180) as response:
            data = response.read(expected_bytes + 1)
    except urllib.error.HTTPError as exc:
        raise TransferError('Source download HTTP ' + str(exc.code)) from None
    except Exception:
        raise TransferError('Source download unavailable') from None
    return data


class R2:
    def __init__(self, account, token, bucket):
        if not re.fullmatch('[a-fA-F0-9]{32}', account or '') or not token:
            raise TransferError('Existing Cloudflare credential is unavailable')
        self.token = token
        self.base = 'https://api.cloudflare.com/client/v4/accounts/' + account + '/r2/buckets/' + bucket + '/objects/'

    def request(self, method, key, data=None):
        url = self.base + urllib.parse.quote(key, safe='')
        headers = {'Authorization': 'Bearer ' + self.token}
        if data is not None:
            headers['Content-Type'] = 'application/octet-stream'
        request = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                if method == 'GET':
                    h = hashlib.sha256(); n = 0
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        h.update(chunk); n += len(chunk)
                    return {'sha256': h.hexdigest(), 'bytes': n}
                response.read()
                return True
        except urllib.error.HTTPError as exc:
            if exc.code == 404 and method == 'GET':
                return None
            raise TransferError('R2 ' + method + ' HTTP ' + str(exc.code)) from None
        except Exception:
            raise TransferError('R2 request unavailable') from None

    def get(self, key):
        return self.request('GET', key)

    def put(self, key, data):
        return self.request('PUT', key, data)


def ensure_copy(r2, key, data):
    expected = {'sha256': sha(data), 'bytes': len(data)}
    existing = r2.get(key)
    if existing is not None:
        if existing != expected:
            raise TransferError('Destination collision; existing bytes were not overwritten')
        return 'verified-existing'
    r2.put(key, data)
    if r2.get(key) != expected:
        raise TransferError('R2 full read-back checksum mismatch')
    return 'copied-and-verified'


def transfer(manifest, r2, loader=fetch_source):
    validate_manifest(manifest)
    # Download and verify all sources before writing any archive to R2.
    with tempfile.TemporaryDirectory() as directory:
        sources = []
        for i, f in enumerate(manifest['files']):
            url = 'https://raw.githubusercontent.com/' + manifest['source_repository'] + '/' + manifest['source_commit'] + '/' + f['path']
            data = loader(url, f['bytes'])
            digest = validate_source(data, f)
            path = Path(directory) / str(i); path.write_bytes(data)
            sources.append((f, path, digest))
        records = []
        for f, path, digest in sources:
            key = manifest['prefix'] + f['name']
            action = ensure_copy(r2, key, path.read_bytes())
            records.append({**f, 'object_key': key, 'sha256': digest, 'verified_full_readback': True})
            print('VERIFIED ' + f['name'] + ': ' + action, flush=True)
        report = {**manifest, 'files': records, 'originals_unchanged': True,
                  'zip_contents_executed': False, 'storage_verified': True}
        # Stable manifest: retries cannot collide merely because a timestamp changed.
        payload = json.dumps(report, ensure_ascii=False, sort_keys=True, indent=2).encode()
        ensure_copy(r2, manifest['prefix'] + 'transfer-provenance.json', payload)
        return report


def main():
    path = Path(__file__).with_name('source-manifest.json')
    manifest = json.loads(path.read_text())
    destination = R2(os.environ.get('CLOUDFLARE_ACCOUNT_ID'), os.environ.get('CLOUDFLARE_API_TOKEN'), manifest['bucket'])
    report = transfer(manifest, destination)
    Path('claude-transfer-result').mkdir(exist_ok=True)
    Path('claude-transfer-result/result.json').write_text(json.dumps(report, indent=2))
    print('COMPLETE: ' + str(len(report['files'])) + ' files verified in existing R2 bucket.')
    print('Missing expected archives: ' + ', '.join(manifest['missing_expected_archives']))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        # Do not print remote error bodies, signed URLs, credentials or export contents.
        print('TRANSFER STOPPED: ' + (str(exc) if isinstance(exc, TransferError) else type(exc).__name__), flush=True)
        raise SystemExit(1)
