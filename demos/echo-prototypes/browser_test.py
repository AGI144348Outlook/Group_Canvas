import json,shutil,argparse
from pathlib import Path
from playwright.sync_api import sync_playwright
HERE=Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('--python',action='store_true');parser.add_argument('--url');parser.add_argument('--private-index');args=parser.parse_args()
url=args.url or (HERE/'index.html').as_uri()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(url);page.get_by_text('Some poodle carries some parcel.',exact=True).wait_for()
 page.locator('#generalize').click();page.get_by_text('Some dog carries some parcel.',exact=True).wait_for()
 page.locator('#generalize').click();page.get_by_text('Some animal carries some parcel.',exact=True).wait_for()
 page.locator('#specialize').click();assert 'candidate-needs-instance-evidence' in page.locator('#sentence-output').inner_text()
 page.locator('#reverse').click();assert 'Outside supported SVO order' in page.locator('#sentence-output').inner_text()
 page.locator('#restore-order').click();page.select_option('#predicate','have');assert 'has some parcel' in page.locator('#sentence-output').inner_text()
 page.select_option('#predicate','sleep');assert 'No tested inflection' in page.locator('#sentence-output').inner_text()
 page.locator('#reset').click();page.locator('#generalize').click();page.locator('#save').click();page.reload();page.locator('#load').click();page.get_by_text('Some dog carries some parcel.',exact=True).wait_for()
 (HERE/'qa').mkdir(exist_ok=True)
 page.screenshot(path=str(HERE/'qa/mobile-cards.png'),full_page=True)
 page.locator('[data-tab="questions"]').click();page.locator('#word').fill('clock');page.locator('#definition').fill('an object measuring time');page.select_option('#category','');page.locator('#tag').click()
 result=page.locator('#tag-output').inner_text();assert 'time-interval' in result and '"when"' not in result
 page.select_option('#question','owner|whose');page.locator('#ask').click();assert 'UNKNOWN' in page.locator('#answer-output').inner_text()
 page.select_option('#question','agent|who');page.select_option('#condition','contradiction');page.locator('#ask').click();assert 'WITHHOLD' in page.locator('#answer-output').inner_text()
 page.locator('#word').fill('<img src=x onerror=alert(1)>');page.locator('#tag').click();assert not page.locator('#tag-output img').count()
 page.locator('[data-tab="library"]').click();assert page.locator('#library-list details').count()==16
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Page overflows mobile viewport'
 page.locator('[data-tab="timeline"]').click();page.locator('#timeline-fit').click();assert '360' in page.locator('#timeline-status').inner_text()
 before=page.locator('#timeline-range').inner_text();page.locator('#timeline-in').click();assert page.locator('#timeline-range').inner_text()!=before
 assert page.locator('#timeline-records button').count()<=100
 page.locator('#timeline-search').fill('Registry');assert 'Registry' in page.locator('#timeline-records').inner_text()
 page.screenshot(path=str(HERE/'qa/mobile-timeline.png'),full_page=True)
 if args.python:
  page.select_option('#runtime','python')
  page.wait_for_function("document.getElementById('runtime-status').textContent.includes('Original Python modules') || document.getElementById('runtime-status').textContent.includes('Python could not load')",timeout=180000)
  assert 'Original Python modules' in page.locator('#runtime-status').inner_text(),page.locator('#runtime-status').inner_text()
  page.locator('[data-tab="cards"]').click();page.locator('#reset').click();page.get_by_text('Some poodle carries some parcel.',exact=True).wait_for()
  page.locator('#generalize').click();page.get_by_text('Some dog carries some parcel.',exact=True).wait_for()
  page.locator('[data-tab="questions"]').click();page.select_option('#question','agent|who');page.select_option('#condition','normal');page.locator('#ask').click()
  page.wait_for_function("document.getElementById('answer-output').textContent.includes('SUPPORTED')")
 private_count=None
 if args.private_index:
  page.locator('[data-tab="timeline"]').click();page.locator('#timeline-search').fill('');page.select_option('#timeline-provider','')
  expected=len(json.loads(Path(args.private_index).read_text())['events'])
  page.locator('#timeline-file').set_input_files(args.private_index)
  page.wait_for_function("document.getElementById('timeline-status').textContent.includes('"+format(expected,',')+" dated records loaded')",timeout=60000)
  assert page.locator('#timeline-records button').count()<=100
  private_count=expected
 assert not errors,errors
 report={'mobile_viewport':'390x844','browser':'Chromium','touch':True,'checks':'cards, transformations, role protection, conjugation abstention, save/reload/replay, tags, evidence, injection, catalog and overflow passed','page_errors':errors,'original_python_pyodide_tested':args.python,'private_dated_records_loaded':private_count}
 (HERE/'qa/browser-result.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
 browser.close()
