const {chromium}=require('playwright');
const {io}=require('socket.io-client');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const count=Number(process.env.YUTVERSE_LAYOUT_PLAYERS||2);
 const base=process.env.YUTVERSE_URL||'http://localhost:5173',title='ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',sockets=[],errors=[];fs.mkdirSync('/tmp/yutverse-browser',{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const request=(socket,event,data={})=>socket.timeout(5000).emitWithAck(event,data);
 try{
  const accounts=[];
  for(let i=0;i<count;i++){const r=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login:`layout_${Date.now()}_${i}`,password:'layout-test-password',nickname:i?'동료여행자이름이아주긴닉네임임':'가나다라마바사아자차카타파하가나'})});assert.equal(r.status,201);const account=await r.json();accounts.push(account);const socket=io(base,{auth:{token:account.token},transports:['websocket'],forceNew:true,reconnection:false});sockets.push(socket);await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject)})}
  const made=await request(sockets[0],'create',{capacity:count,title});assert.equal(made.ok,true,made.error);const code=made.room.code;for(const socket of sockets.slice(1))assert.equal((await request(socket,'join',{code})).ok,true);for(const socket of sockets)await request(socket,'ready');assert.equal((await request(sockets[0],'start')).ok,true);
  for(const socket of sockets){const own=await request(socket,'sync');assert.equal((await request(socket,'act',{kind:'choose',revision:own.room.revision,id:own.room.state.selection.offers[0]})).ok,true)}
  const context=await browser.newContext({viewport:{width:1440,height:900}}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(a=>{localStorage.setItem('yutverse.token',a.token);localStorage.setItem('yutverse.account',JSON.stringify(a.user))},accounts[0]);await p.goto(base);await p.getByRole('button',{name:'멀티플레이',exact:true}).click();await p.locator('.game-shell:not(.augment-screen)').waitFor();await p.waitForFunction(()=>[...document.querySelectorAll('.token-label')].every(e=>e.style.transform.includes('translate3d')));
  for(const [width,height] of [[320,480],[360,500],[390,600],[360,640],[412,700],[1440,900],[1280,720],[320,740],[360,800],[390,844],[428,926],[768,1024],[568,320],[667,375],[844,390],[1024,768]]){
   await p.setViewportSize({width,height});await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r)))));
   const result=await p.evaluate(()=>{
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    const visible=e=>!!e&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
    const overlaps=(a,b)=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1;
    const nodes={brand:document.querySelector('.game-shell header .brand'),actions:document.querySelector('.header-actions'),tabs:document.querySelector('.mode-tabs'),reset:document.querySelector('.arena-top button'),inventory:document.querySelector('.inventory-toggle'),sidebar:document.querySelector('.layout aside')};
    const boxes=Object.fromEntries(Object.entries(nodes).filter(([,e])=>visible(e)).map(([k,e])=>[k,rect(e)]));const pairs=[['brand','actions'],['tabs','reset'],['tabs','sidebar'],['inventory','reset'],['reset','sidebar']];
    const collisions=pairs.filter(([a,b])=>boxes[a]&&boxes[b]&&overlaps(boxes[a],boxes[b]));
    const buttons=[...document.querySelectorAll('.header-actions button')].filter(visible).map(rect);for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++)if(overlaps(buttons[i],buttons[j]))collisions.push([`header${i}`,`header${j}`]);
    const throwing=document.querySelector('button.throw'),r=throwing.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    const labelBoxes=[...document.querySelectorAll('.token-label')].filter(visible).map(rect);const labelCollisions=[];
    const players=document.querySelector('.players'),portrait=innerWidth<=760&&innerHeight>=innerWidth;if(portrait)for(let i=0;i<labelBoxes.length;i++)for(let j=i+1;j<labelBoxes.length;j++)if(overlaps(labelBoxes[i],labelBoxes[j]))labelCollisions.push([i,j]);const rosterFits=!portrait||players.scrollWidth<=players.clientWidth+1;
    return {labelCollisions,rosterFits,boxes,collisions,buttons,width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,lobby:document.querySelectorAll('.game-shell>.lobby').length,actionable:hit===throwing||throwing.contains(hit)};
   });
   assert.deepEqual(result.labelCollisions,[],'portrait home-piece labels must not overlap');assert.equal(result.rosterFits,true,'portrait player tiles must fit their strip');assert.equal(result.lobby,0,'waiting-room strip must not be mounted over the match');assert.equal(result.scrollWidth,width);assert.ok(result.scrollHeight<=height+1);assert.deepEqual(result.collisions,[],JSON.stringify(result));for(const r of result.buttons)assert.ok(r.x>=0&&r.right<=width&&r.y>=0&&r.bottom<=height,JSON.stringify(r));assert.ok(result.actionable,'throw control must not be covered');
   await p.screenshot({path:`/tmp/yutverse-browser/online-layout-${width}x${height}.png`});
   await p.getByRole('button',{name:'설정',exact:true}).click();await p.getByRole('region',{name:'게임 방 정보'}).waitFor();assert.equal(await p.locator('.match-room-name').textContent(),title);assert.equal(await p.locator('.match-room-info code').textContent(),code);
   const panel=await p.locator('.heading').boundingBox();assert.ok(panel.x>=0&&panel.y>=0&&panel.x+panel.width<=width+1&&panel.y+panel.height<=height+1,JSON.stringify(panel));assert.equal(await p.locator('.match-room-info').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);await p.screenshot({path:`/tmp/yutverse-browser/online-settings-${width}x${height}.png`});await p.getByRole('button',{name:'설정 닫기',exact:true}).click();console.log(`PASS ${width}×${height}: no room-strip or control overlap, usable throw button, bounded settings with full 32-character title and room code.`);
  }
  assert.deepEqual(errors,[]);await context.close();
 }finally{sockets.forEach(s=>s.disconnect());await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
