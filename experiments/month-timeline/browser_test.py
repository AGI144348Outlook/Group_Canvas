"""Hosted touch QA. No private screenshot, transcript text, key or source ID in output."""
import json, os, pathlib
from playwright.sync_api import sync_playwright, expect

ROOT = pathlib.Path(__file__).parent
QA = ROOT / 'qa'
QA.mkdir(exist_ok=True)
URL = 'https://group-canvas-month-line.agi144348.workers.dev/'
checks = []
def passed(name):
    checks.append(name)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    context = browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True, device_scale_factor=1)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda _: errors.append('browser error'))
    page.goto(URL, wait_until='networkidle')
    expect(page.locator('body')).to_have_attribute('data-ready','true')
    expect(page.locator('#source-count')).to_have_text('11 blocks')
    expect(page.locator('#mode')).to_contain_text('Fictional sample')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    passed('390px touch layout and fictional preview')
    page.screenshot(path=str(QA / 'phone-fictional.png'), full_page=True)
    page.locator('#next').tap()
    expect(page.locator('#selected-position')).to_have_text('Block 2 / 11')
    page.locator('#month-list button').first.tap()
    expect(page.locator('#filter-result')).to_contain_text('61 records')
    passed('block navigation and month count filter')
    old_range=page.locator('#range-label').inner_text()
    page.locator('#extend-right').tap()
    assert page.locator('#range-label').inner_text() != old_range
    page.locator('#extend-left').tap()
    expect(page.locator('#source-count')).to_have_text('11 blocks')
    page.locator('#fit').tap()
    expect(page.locator('#range-label')).to_have_text(old_range)
    passed('extend both ends and restore range without inventing sources')
    page.locator('#review-state').select_option('vocabulary')
    page.reload(wait_until='networkidle')
    expect(page.locator('#selected-position')).to_have_text('Block 2 / 11')
    expect(page.locator('#review-state')).to_have_value('vocabulary')
    passed('revision-scoped nonsecret review preference restoration')
    for _ in range(9): page.locator('#next').tap()
    expect(page.locator('#block-notice')).to_contain_text('incomplete')
    expect(page.locator('#filter-result')).to_contain_text('No indexed activity')
    expect(page.locator('#review-state')).to_be_disabled()
    passed('pending source remains unknown rather than zero')
    key=os.getenv('CREATE_ROOM_KEY')
    if key:
        # The response remains within the test process; only safe count summaries escape.
        response=context.request.get(URL+'api/manifest',headers={'x-filing-key':key})
        assert response.status == 200, 'Private manifest access failed'
        data=response.json()
        assert data.get('format')=='echo-gpt-block-months/1'
        page.locator('#operator').fill(key)
        page.locator('#open').tap()
        expect(page.locator('#mode')).to_contain_text('Private GPT archive', timeout=60000)
        expect(page.locator('#source-count')).to_have_text(str(len(data['blocks']))+' blocks')
        expect(page.locator('#operator')).to_have_value('')
        saved=page.evaluate('JSON.stringify({...localStorage})')
        assert key not in saved
        assert all(b['id'] not in saved for b in data['blocks'])
        expect(page.locator('#block-notice')).not_to_contain_text('understood')
        page.locator('#lock').tap()
        expect(page.locator('#mode')).to_contain_text('Fictional sample')
        passed('real private manifest load; no credential or private block ID persisted; close restores sample')
    assert not errors, 'Client runtime error'
    passed('no browser runtime errors')
    browser.close()

(QA/'results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'viewport':'390x844 touch','privateLoadTested':bool(os.getenv('CREATE_ROOM_KEY'))},indent=2))
print(str(len(checks))+' mobile/browser checks passed; private details omitted.')
