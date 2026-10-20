"""Fetch a pinned archived artifact for read-only local inspection. No archive execution."""
import hashlib, subprocess, tempfile, urllib.request
from pathlib import Path
u='https://raw.githubusercontent.com/AGI144348Outlook/dual-order-os/b88d62c90d4f6cdf5f4965d9433a03045bb3bb10/vendor/echo-genesis/integration-inbox/core-lexicon/core-lexicon.zip'
with urllib.request.urlopen(u,timeout=120) as r:data=r.read(7426612)
assert len(data)==7426611
assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()=='370e23a301badb6362eac29682afc5bba9e8d5a4'
Path('encrypted-research').mkdir(exist_ok=True)
with tempfile.TemporaryDirectory() as d:
 p=Path(d)/'source.zip';p.write_bytes(data)
 subprocess.run(['openssl','cms','-encrypt','-binary','-aes-256-cbc','-in',str(p),'-out','encrypted-research/matches.cms','-outform','DER',str(Path(__file__).with_name('recipient.pem'))],check=True)
print('Pinned lexicon archive verified; encrypted read-only inspection handoff prepared.')
