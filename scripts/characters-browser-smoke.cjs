const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const base=process.env.YUTVERSE_URL||'http://localhost:5173',errors=[];fs.mkdirSync('/tmp/yutverse-browser',{recursive:true});
 try{
  for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
   const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base);await page.getByRole('dialog',{name:'게임 시작 전 말 선택'}).waitFor();assert.equal(await page.locator('.character-option').count(),5);assert.equal(await page.locator('canvas').count(),0);assert.equal(await page.evaluate(()=>localStorage.getItem('yutverse.game')),null);
   await page.getByRole('button',{name:/엘프 궁수 바람의 화살/}).click();assert.equal(await page.getByRole('button',{name:/엘프 궁수 바람의 화살/}).getAttribute('aria-pressed'),'true');await page.getByRole('combobox',{name:'시작 인원',exact:true}).selectOption('2');
   await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));await new Promise(r=>{const i=new Image();i.onload=r;i.src='/characters/heroes.png'})});
   await page.screenshot({path:`/tmp/yutverse-browser/hero-selection-${name}.png`,fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.getByRole('button',{name:'이 영웅으로 시작하기 ↗',exact:true}).click();await page.getByRole('dialog',{name:'증강 선택'}).waitFor();const s=await page.evaluate(()=>JSON.parse(localStorage.getItem('yutverse.game')));assert.equal(s.players.length,2);assert.equal(s.players[0].character,'archer');assert.notEqual(s.players[1].character,'archer');
   await page.locator('.augment-picker .card').first().click();await page.getByRole('button',{name:'윷 던지기 ↗',exact:true}).waitFor();await page.locator('.token-label[data-character="archer"]').first().waitFor();assert.equal(await page.locator('.token-label[data-character="archer"]').count(),4);
   // The atlas must be served successfully, including after a production reload.
   const response=await page.request.get(base+'/characters/heroes.png');assert.equal(response.status(),200);assert.match(response.headers()['content-type'],/image\/png/);
   await page.waitForFunction(()=>[...document.querySelectorAll('.token-label')].every(e=>e.style.transform.includes('translate3d')));await page.screenshot({path:`/tmp/yutverse-browser/hero-board-${name}.png`});
   await page.reload();await page.locator('.token-label[data-character="archer"]').first().waitFor();assert.equal(await page.getByRole('dialog',{name:'게임 시작 전 말 선택'}).count(),0);
   await page.getByRole('button',{name:'설정',exact:true}).click();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'새 경기 시작 ↗',exact:true}).click();await page.getByRole('button',{name:/마법사 별빛 현자/}).click();await page.getByRole('button',{name:'진행 중인 경기로 돌아가기',exact:true}).click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('yutverse.game')).players[0].character),'archer');
   await context.close();console.log(`PASS ${name}: five-hero selection before play, chosen four pieces, distinct AI, local atlas, reload and cancel without replacing the match.`);
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
