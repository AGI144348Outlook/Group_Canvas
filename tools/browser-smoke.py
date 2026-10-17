"""Real Chromium UI test, with port-free requests routed to the real Node handlers."""
import asyncio,json, pathlib
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parent.parent
async def main():
 proc=await asyncio.create_subprocess_exec('node','tools/browser-bridge.js',cwd=ROOT,stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.PIPE)
 lock=asyncio.Lock()
 async def request(url,method='GET',headers=None,body=None):
  async with lock:
   proc.stdin.write((json.dumps(dict(url=url,method=method,headers=headers or {},body=body))+'\n').encode());await proc.stdin.drain()
   result=json.loads(await proc.stdout.readline())
   assert 'error' not in result,result
   return result
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  context=await browser.new_context(viewport={'width':1440,'height':1000})
  errors=[]
  async def route(r):
   u=r.request.url
   if '/api/' in u:
    result=await request(u,r.request.method,await r.request.all_headers(),r.request.post_data)
    await r.fulfill(status=result['status'],headers=result['headers'],body=result['body']);return
   from urllib.parse import urlparse
   path=urlparse(u).path
   file=ROOT/'public'/('index.html' if path=='/' else path.lstrip('/'))
   if file.is_file():await r.fulfill(path=file)
   else:await r.fulfill(status=404,body='Not found')
  await context.route('**/*',route)
  page=await context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto('http://canvas.test/')
  await page.screenshot(path='/workspace/Group_Canvas-welcome.png',full_page=True)
  await page.locator('#create').click()
  await page.locator('.widget').nth(1).wait_for()
  await page.get_by_role('button',name='Make a game').click()
  await page.locator('.quiz-question').wait_for()
  await page.locator('.quiz-choice').nth(1).click()
  assert 'Keep exploring' in await page.locator('.quiz-feedback').inner_text()
  await page.locator('.quiz-choice').first.click()
  assert 'That connects' in await page.locator('.quiz-feedback').inner_text()
  await page.locator('#prompt').fill('A shared idea worth keeping')
  await page.locator('.send').click()
  await page.get_by_text('A shared idea worth keeping',exact=True).last.wait_for()
  await page.locator('.widget[data-kind=note]').last.wait_for()
  first=page.locator('.widget').first
  before=await first.evaluate('(n)=>({left:n.style.left,top:n.style.top,id:n.dataset.id})')
  box=await first.locator('.widget-head').bounding_box()
  await page.mouse.move(box['x']+60,box['y']+18);await page.mouse.down();await page.mouse.move(box['x']+140,box['y']+78,steps=5);await page.mouse.up()
  await page.wait_for_timeout(300)
  after=await first.evaluate('(n)=>({left:n.style.left,top:n.style.top,id:n.dataset.id})')
  assert after['left']!=before['left'],(before,after)
  await first.get_by_title('Collapse or expand').click();await page.wait_for_timeout(200)
  assert await first.evaluate('(n)=>n.style.height')=='40px'
  await page.reload();await page.locator('.widget[data-kind=quiz]').wait_for()
  restored=page.locator(f'.widget[data-id="{after["id"]}"]')
  assert await restored.evaluate('(n)=>n.style.left')==after['left']
  assert await restored.evaluate('(n)=>n.style.height')=='40px'
  await page.locator('#share').click();await page.locator('#makeInvite').click();await page.locator('#inviteResult').wait_for(state='visible')
  rid=await page.locator('#roomId').input_value();code=await page.locator('#inviteCode').input_value()
  await page.locator('#shareDialog [data-close]').click()
  second=await browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
  await second.route('**/*',route);friend=await second.new_page();friend.on('pageerror',lambda e:errors.append(str(e)))
  await friend.goto('http://canvas.test/');await friend.locator('#name').fill('A cherished friend');await friend.locator('#joinRoom').fill(rid);await friend.locator('#joinCode').fill(code);await friend.locator('#join').click();await friend.locator('.quiz-question').wait_for()
  assert await friend.locator('#share').is_disabled()
  await page.screenshot(path='/workspace/Group_Canvas-prototype.png',full_page=True)
  await friend.screenshot(path='/workspace/Group_Canvas-mobile.png',full_page=True)
  assert not errors,errors
  print(json.dumps({'browser':'Chromium','checks':['room creation','persistent seeded widgets','offline AI quiz creation','wrong/right quiz feedback','AI note creation','drag persistence','collapse persistence','reload restoration','invitation redemption','mobile layout','non-owner UI restrictions'],'page_errors':errors,'screenshots':['Group_Canvas-prototype.png','Group_Canvas-mobile.png']}))
  await browser.close()
 proc.terminate();await proc.wait()
asyncio.run(main())
