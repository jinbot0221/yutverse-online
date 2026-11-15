// Run against a test server; this checks screen coverage and direct 3D piece selection.
const fs=require('node:fs');
fs.mkdirSync('/tmp/yutverse-browser',{recursive:true});
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const {createGame}=await import('../packages/engine/src/index.ts');
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const s=createGame(4);s.phase='move';s.result={name:'도',steps:1,extra:false};s.throws=0;
  s.players[0].pieces[0]={node:'o5',history:['home','o1','o2','o3','o4']};s.players[0].pieces[1]=structuredClone(s.players[0].pieces[0]);
  s.players[1].pieces[0]={node:'o10',history:[]};s.players[2].pieces[0]={node:'c',history:[]};s.players[3].pieces[0]={node:'o20',history:[]};
  for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844],['landscape',844,390]]){
   const context=await browser.newContext({viewport:{width,height}});const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(state=>{localStorage.setItem('yutverse.offline','true');localStorage.setItem('yutverse.game',JSON.stringify(state))},s);
   await p.goto(process.env.YUTVERSE_URL||'http://localhost:5173');await p.locator('.mode-menu').getByRole('button',{name:'싱글플레이',exact:true}).click();await p.locator('.token-label').first().waitFor();await p.waitForTimeout(1500);
   const canvas=await p.locator('canvas').boundingBox();assert.equal(Math.round(canvas.width),width);assert.equal(Math.round(canvas.height),height);
   const layout=await p.evaluate(()=>({scroll:document.documentElement.scrollHeight,h:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,labels:[...document.querySelectorAll('.token-label')].map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent,x:r.x,y:r.y,w:r.width,h:r.height}})}));
   assert.equal(layout.overflow,false);assert.ok(layout.scroll<=height+1);assert.equal(await p.locator('.token-label .stack-count').first().textContent(),'×2');assert.equal(layout.labels.length,15);for(const label of layout.labels){assert.ok(label.x>=0&&label.x+label.w<=width&&label.y>=0&&label.y+label.h<=height,JSON.stringify(label));}
   await p.screenshot({path:`/tmp/yutverse-browser/game-${name}.png`});
   if(name==='desktop'){const token=await p.locator('.token-label.selectable').first().boundingBox();await p.mouse.click(token.x+token.width/2,token.y+token.height+14);await p.getByRole('button',{name:'대각선 지름길로 가기',exact:true}).click();await p.waitForFunction(()=>JSON.parse(localStorage.getItem('yutverse.game')).players[0].pieces[0].node==='a1');
    await p.getByRole('button',{name:'전체화면',exact:true}).click();await p.waitForFunction(()=>!!document.fullscreenElement);await p.getByRole('button',{name:'전체화면 종료',exact:true}).click();
    await p.getByRole('button',{name:'설정',exact:true}).click();await p.getByRole('button',{name:'새 경기 시작 ↗',exact:true}).waitFor();await p.getByRole('button',{name:'설정 닫기',exact:true}).click();
   }
   assert.deepEqual(errors,[]);console.log(`PASS ${name}: viewport coverage, no scrolling, 15 visible labels and stack badge; desktop also checks direct piece selection and fullscreen.`);await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
