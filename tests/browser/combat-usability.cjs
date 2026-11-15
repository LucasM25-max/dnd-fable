'use strict';
/* Optional real-browser regressions. Requires Playwright + three@0.128.0, not application dependencies.
   node tests/browser/combat-usability.cjs
   CHROMIUM_PATH and CHROMIUM_ARGS (a JSON array) can select a system/serverless Chromium.
   TEST_NO_GPU=1 suppresses GPU draws, but still updates real Three.js world/camera matrices, DOM and pointer events.
   That mode tests interaction/layout, not rendering performance. Screenshots are optional: TEST_SCREENSHOTS=/tmp/audit. */
const assert=require('assert'),fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'../..');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(ROOT,'.'+decodeURIComponent(new URL(req.url,'http://test').pathname==='/'?'/index.html':new URL(req.url,'http://test').pathname));
  if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end()}
  fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(err?'Not found':data)});
});
const noGpu=process.env.TEST_NO_GPU==='1',shots=process.env.TEST_SCREENSHOTS;
function overlap(a,b){return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y}
let checks=0;
function ok(message){checks++;console.log('  ok  '+message)}

async function run(){
  await new Promise(resolve=>server.listen(0,'0.0.0.0',resolve));
  let browser;
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,
      args:process.env.CHROMIUM_ARGS?JSON.parse(process.env.CHROMIUM_ARGS):['--no-sandbox','--disable-dev-shm-usage']});
    const context=await browser.newContext({viewport:{width:1440,height:900},hasTouch:true,reducedMotion:'reduce'});
    let three=fs.readFileSync(require.resolve('three/build/three.min.js'),'utf8');
    if(noGpu)three+='\n;(()=>{const Original=THREE.WebGLRenderer;THREE.WebGLRenderer=function(o){const r=new Original(o);r.render=function(s,c){s.updateMatrixWorld(true);c.updateMatrixWorld(true)};return r};THREE.WebGLRenderer.prototype=Original.prototype})();';
    await context.route('https://cdnjs.cloudflare.com/**',r=>r.fulfill({contentType:'text/javascript',body:three}));
    await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    page.setDefaultTimeout(15000);
    await page.goto('http://127.0.0.1:'+server.address().port+'/?seed=7#menu');
    await page.waitForFunction(()=>!!window.Fable?.currentScene?.());
    await page.evaluate(()=>{Fable.hudSettings.set('speed','instant');Fable.hudSettings.set('motion','reduced');Fable.hudSettings.set('mute',true)});
    await page.locator('#tutorial-replay').click();
    await page.keyboard.press('Enter');
    const idle=()=>page.waitForFunction(()=>{const c=Fable.currentScene()?.combat;return c?.active&&c.idle()});
    const line=text=>page.waitForFunction(t=>document.querySelector('.elm-line')?.textContent.includes(t),text);
    const shot=async name=>{if(shots){fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,name+'.png')})}};
    const resize=async size=>{
      await page.setViewportSize(size);
      // Resize events, viewport-relative CSS and the HUD's measured stacks settle on the next frames.
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    };
    await idle();await line('Welcome');

    for(const size of [{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
      await resize(size);
      await page.waitForFunction(()=>{
        const h=document.querySelector('.hb').getBoundingClientRect(),e=document.querySelector('.elm').getBoundingClientRect();
        return e.top>=h.bottom+6;
      });
      const boxes=await page.evaluate(()=>{
        const rect=s=>document.querySelector(s).getBoundingClientRect().toJSON();
        const visible=selector=>[...document.querySelectorAll(selector)].map(e=>({name:e.getAttribute('aria-label'),...e.getBoundingClientRect().toJSON()})).filter(r=>r.width&&r.height);
        return {health:rect('.hb'),dialog:rect('.elm'),controls:visible('.sysb,.hotbar .slotb,.hot-page,.end button'),pins:visible('.hotbar .hslot'),plates:visible('.np:not([hidden])'),compact:Fable.currentScene().combat.hud.compact};
      });
      assert.ok(boxes.compact);assert.ok(!overlap(boxes.health,boxes.dialog));
      boxes.controls.forEach(r=>{assert.ok(r.width>=43.9&&r.height>=43.9,JSON.stringify(r));assert.ok(r.x>=0&&r.x+r.width<=size.width+.5,JSON.stringify(r))});
      assert.ok(boxes.plates.length>0);
      boxes.plates.forEach((r,i)=>{
        assert.ok(r.height>=44);assert.ok(!overlap(r,boxes.health)&&!overlap(r,boxes.dialog));
        boxes.plates.slice(0,i).forEach(p=>assert.ok(!overlap(r,p)));
      });
      assert.strictEqual(boxes.pins.length,5);
      await shot('hud-'+size.width+'x'+size.height);
      ok('reflowed '+size.width+'×'+size.height+' HUD: five visible pins, 44px targets, no health/dialogue overlap');
    }

    await resize({width:390,height:844});
    const menuPreference=await page.evaluate(()=>Fable.hudSettings.get('menu'));
    await page.locator('.am-unfold').click();
    const pair=await page.locator('.mslot').first().evaluate(e=>({slot:e.querySelector('.slotb').getBoundingClientRect().toJSON(),pin:e.querySelector('.pinb').getBoundingClientRect().toJSON()}));
    assert.ok(pair.pin.width>=44&&pair.pin.height>=44);assert.ok(!overlap(pair.slot,pair.pin));
    const pin=page.locator('.mslot .pinb').first();
    const pinned=await pin.getAttribute('aria-pressed');await pin.click();
    assert.notStrictEqual(await page.locator('.mslot .pinb').first().getAttribute('aria-pressed'),pinned);
    await page.locator('.mslot .pinb').first().click();
    await shot('mobile-actions');
    await resize({width:320,height:568});
    const shortDrawer=await page.evaluate(()=>{
      const rect=s=>document.querySelector(s).getBoundingClientRect().toJSON();
      return {menu:rect('.amenu'),health:rect('.hb'),bar:rect('.hotbar'),dialog:getComputedStyle(document.querySelector('.elm')).visibility};
    });
    assert.ok(shortDrawer.menu.height>=144&&shortDrawer.menu.y>shortDrawer.health.y+shortDrawer.health.height);
    assert.ok(!overlap(shortDrawer.menu,shortDrawer.bar));assert.strictEqual(shortDrawer.dialog,'hidden');
    await page.locator('.mslot .slotb').last().scrollIntoViewIfNeeded();
    await shot('short-mobile-actions');await page.locator('.am-fold').click();
    await resize({width:390,height:844});
    assert.strictEqual(await page.evaluate(()=>Fable.hudSettings.get('menu')),menuPreference);
    await page.locator('.hot-page').click();
    assert.strictEqual(await page.locator('.hslot[data-index="5"]').isVisible(),true);
    assert.strictEqual(await page.locator('.hslot[data-index="0"]').isVisible(),false);
    await page.locator('.hot-page').click();
    ok('mobile drawer, touch-size pinning and second hotbar page work without changing the desktop menu preference');

    // Play the actual lesson through the UI. The first strike uses the top of the head, not a ground square.
    const mobilePins=await page.locator('.hslot').evaluateAll(es=>es.map(e=>e.getAttribute('data-id')));
    await resize({width:1440,height:900});
    assert.strictEqual(await page.locator('.hslot').evaluateAll(es=>es.filter(e=>e.offsetWidth>0).length),10);
    assert.strictEqual(await page.locator('.hot-page').isVisible(),false);
    assert.deepStrictEqual(await page.locator('.hslot').evaluateAll(es=>es.map(e=>e.getAttribute('data-id'))),mobilePins);
    ok('desktop restores all ten slots and keeps the custom pins used on mobile');
    await page.locator('.elm .plate').click();await line('glowing Move');
    await page.locator('.hotbar [data-id="move"].slotb').click();await line('glowing square');
    const destination=await page.evaluate(()=>{
      const c=Fable.currentScene().combat,G=Fable.grid,a=c.state.byId['goblin-minion-1'],b=c.state.byId['goblin-minion-2'],cells=[];
      for(let dc=-1;dc<=1;dc++)for(let dr=-1;dr<=1;dr++){
        if(!dc&&!dr)continue;const p={c:a.cell.c+dc,r:a.cell.r+dr};
        if(G.chebyshev(p,b.cell)<=1||Fable.combat.occupant(c.state,p,c.hero))continue;
        const plan=Fable.combat.planMove(c.state,c.hero,p);
        if(plan.ok&&!plan.provokes?.length)cells.push(p);
      }
      cells.sort((a,b)=>G.chebyshev(a,c.hero.cell)-G.chebyshev(b,c.hero.cell));
      const p=cells[0],v=G.center(c.grid,p.c,p.r),q=new THREE.Vector3(v.x,0,v.z).project(Fable.currentScene().camera);
      return {cell:p,x:(q.x+1)*innerWidth/2,y:(1-q.y)*innerHeight/2};
    });
    assert.ok(destination.cell,'a legal tutorial flank square exists');
    await page.mouse.click(destination.x,destination.y);await idle();await line('Click your Longsword');
    await page.locator('.hotbar .slotb[data-id="attack:longsword:melee"]').click();await line('strike it');
    async function modelPoint(id,part){
      return page.evaluate(({id,part})=>{
        const scene=Fable.currentScene(),c=scene.combat,e=c.entries[id];e.root.updateMatrixWorld(true);
        const v=part==='head'?e.rig.joints.head.localToWorld(new THREE.Vector3(0,5.1,0)):e.root.localToWorld(new THREE.Vector3(0,7,0));
        const q=v.clone().project(scene.camera);
        const rc=new THREE.Raycaster();rc.setFromCamera(new THREE.Vector2(q.x,q.y),scene.camera);
        const ground=rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());
        return {x:(q.x+1)*innerWidth/2,y:(1-q.y)*innerHeight/2,ground:ground&&Fable.grid.cellAt(c.grid,ground.x,ground.z),cell:c.state.byId[id].cell};
      },{id,part});
    }
    const head=await modelPoint('goblin-minion-1','head');
    assert.notDeepStrictEqual(head.ground,head.cell,'this upper-head click would miss with ground-plane-only picking');
    await page.mouse.click(head.x,head.y);await idle();await line('End your turn');
    assert.ok(await page.evaluate(()=>Fable.currentScene().combat.hero.economy.action));
    ok('a tutorial head click selects the creature even when its ground projection is a different square');
    await page.locator('.end button').click();await line('Second Wind heals');await idle();
    await page.locator('.hotbar .slotb[data-id="action:second-wind"]').click();await line('wounded goblin');await idle();
    await page.locator('.hotbar .slotb[data-id="attack:longsword:melee"]').click();await line('Click the goblin.');
    const body=await modelPoint('goblin-minion-1','body');await page.mouse.click(body.x,body.y);
    await page.locator('.pb[data-choice="reroll"]').click();await line('One goblin down');await idle();
    await page.locator('.end button').click();await line('last goblin');await idle();
    await page.locator('.np[data-creature="goblin-minion-2"]').click();
    await page.waitForFunction(()=>Fable.currentScene().combat.state.phase==='over');
    ok('body selection, clickable names and the unchanged tutorial gates complete the lesson');

    // A deterministic ordinary fight uses the real roster kit, with no tutorial gating or fixed dice.
    await page.evaluate(()=>{
      localStorage.removeItem('dicebound.hotbar.v1');
      const e=JSON.parse(JSON.stringify(Fable.tutorialEncounter()));delete e.tutorial;e.id='browser-usability';
      Fable.enterWorld(e);
    });
    await page.locator('body').click({position:{x:700,y:500}});await idle();
    const beforeTurn=await page.evaluate(()=>({turn:Fable.currentScene().combat.state.turn,round:Fable.currentScene().combat.state.round,action:Fable.currentScene().combat.hero.economy.action}));
    await page.locator('.ini-focus').last().focus();await page.keyboard.press('Space');
    assert.deepStrictEqual(await page.evaluate(()=>({turn:Fable.currentScene().combat.state.turn,round:Fable.currentScene().combat.state.round,action:Fable.currentScene().combat.hero.economy.action})),beforeTurn);
    assert.ok(await page.evaluate(()=>{
      const c=Fable.currentScene().combat,a=c.state.order[c.state.order.length-1],p=c.entries[a].walker.position(),f=c.focus();
      return Math.hypot(p.x-f.x,p.z-f.z)<.01&&Fable.input.cam.dist<=180;
    }));
    await page.locator('.ini-focus').first().focus();await page.keyboard.press('Enter');
    assert.deepStrictEqual(await page.evaluate(()=>({turn:Fable.currentScene().combat.state.turn,round:Fable.currentScene().combat.state.round,action:Fable.currentScene().combat.hero.economy.action})),beforeTurn);
    ok('Space and Enter activate initiative portraits instead of ending the turn or spending an Action');

    await resize({width:390,height:844});
    await page.locator('.sysb[data-act="frameAll"]').click();
    await page.waitForTimeout(700); // let the camera's documented smoothing converge before projecting click coordinates
    const pinsBefore=await page.locator('.hslot').evaluateAll(es=>es.map(e=>e.getAttribute('data-id')));
    await page.locator('.hotbar .slotb[data-id="attack:javelin:thrown"]').tap();
    const touchTarget=await modelPoint('goblin-minion-1','head');
    await page.touchscreen.tap(touchTarget.x,touchTarget.y);
    assert.strictEqual(await page.evaluate(()=>Fable.currentScene().combat.hero.thrown.javelin||0),0,'the first touch only previews');
    assert.ok(await page.evaluate(()=>Fable.currentScene().combat.debug().previewCell),'touch pointerleave must not erase the preview');
    await page.touchscreen.tap(touchTarget.x,touchTarget.y);
    await page.waitForFunction(()=>Fable.currentScene().combat.hero.thrown.javelin===1);
    if(await page.locator('.pb[data-choice="keep"]').isVisible())await page.locator('.pb[data-choice="keep"]').click();
    await idle();
    const thrown=await page.evaluate(()=>{const c=Fable.currentScene().combat;return {held:c.hero.hands.mainhand,shield:c.hero.build.equipped.offhand,stock:c.hero.stock.javelin,left:c.hero.stock.javelin-c.hero.thrown.javelin,visual:c.hero.sheet.visuals.worn.mainhand.item,actualVisual:Fable.creature.visuals(c.hero).worn.mainhand}});
    assert.strictEqual(thrown.shield,'shield');assert.strictEqual(thrown.stock,4);assert.strictEqual(thrown.left,3);assert.strictEqual(thrown.held,null);assert.strictEqual(thrown.actualVisual,null);
    assert.deepStrictEqual(await page.locator('.hslot').evaluateAll(es=>es.map(e=>e.getAttribute('data-id'))),pinsBefore,'an automatic draw must not reshuffle the hotbar');
    ok('two real touch taps throw a carried javelin directly, preserve the Shield, count stock and keep pins stable');

    // Retreat-distance fixture: move a target to the far side without changing any AI behaviour or weights.
    await page.locator('.ini-focus').first().click();
    await page.evaluate(()=>{
      const c=Fable.currentScene().combat,G=Fable.grid,foe=c.state.byId['goblin-minion-2'];
      const cell=G.nearestFree(c.grid,{c:1,r:1},(col,row)=>!!Fable.combat.occupant(c.state,{c:col,r:row},foe));
      Fable.combat.place(c.state,foe,cell);const p=G.center(c.grid,cell.c,cell.r);c.entries[foe.id].walker.teleport(p.x,p.z);
    });
    await page.locator('.sysb[data-act="frameAll"]').click();
    await page.waitForFunction(()=>{
      const scene=Fable.currentScene(),c=scene.combat,safe=c.hud.cameraSafe();
      return c.state.creatures.filter(k=>k.alive).every(k=>{
        const p=c.entries[k.id].walker.position();
        return [0,k.kind==='hero'?20:15].every(y=>{const q=new THREE.Vector3(p.x,y,p.z).project(scene.camera);return q.z<1&&q.x>=-1+2*safe.left-.03&&q.x<=1-2*safe.right+.03&&q.y>=-1+2*safe.bottom-.03&&q.y<=1-2*safe.top+.03});
      });
    },null,{timeout:12000});
    assert.ok(await page.evaluate(()=>Fable.input.cam.dist>260));
    const plates=await page.locator('.np:not([hidden])').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));
    plates.forEach((r,i)=>plates.slice(0,i).forEach(p=>assert.ok(!overlap(r,p))));
    await shot('frame-retreat');
    ok('frame-all finds distant combatants beyond the old zoom limit and keeps names separated');
    const manual=await page.evaluate(()=>{
      const canvas=Fable.canvas,r=canvas.getBoundingClientRect();
      for(let y=300;y<650;y+=50)for(let x=50;x<innerWidth-30;x+=50)if(document.elementFromPoint(x,y)===canvas)return {x,y,dist:Fable.input.cam.dist};
      return null;
    });
    assert.ok(manual,'there is an unobscured battlefield point for manual zoom');
    await page.mouse.move(manual.x,manual.y);await page.mouse.wheel(0,-120);
    await page.waitForFunction(d=>Fable.input.cam.dist<d-.1,manual.dist);
    const manualDistance=await page.evaluate(()=>Fable.input.cam.dist);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.strictEqual(await page.evaluate(()=>Fable.input.cam.dist),manualDistance,'automatic fitting must not fight manual zoom');
    assert.strictEqual(await page.evaluate(()=>Fable.currentScene().combat.debug().previewCell),null);
    await page.keyboard.press('v');await page.waitForFunction(d=>Fable.input.cam.dist>d+.1,manualDistance);
    ok('manual zoom takes control; V restores frame-all without changing any combat actions');
    assert.deepStrictEqual(errors,[]);ok('no browser runtime errors');
    console.log('\n'+checks+' browser checks passed'+(noGpu?' (GPU draws suppressed; no rendering/performance claim)':''));
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
run().catch(e=>{console.error(e);process.exitCode=1});
