'use strict';
const assert=require('assert'),H=require('../harness'),path=require('path');

/* Phase 8 integration: what the game wires around the AI engine (worker entry, HUD view models, presentation handlers,
   content validation of the ai blocks). The controller itself needs Three.js and is exercised in the browser. */
function scene(C){
  const g=Fable.grid.create({cols:24,rows:24});
  const hero=Fable.creature.fromSheet(Fable.character.compute(C.characters.get('human-fighter').build),{id:'hero',team:'player'});
  const gob=Fable.creature.fromMonster(C.monsters.get('goblin-minion'),{index:0});
  const s=Fable.combat.create({grid:g,seed:11,creatures:[hero,gob]});
  Fable.combat.place(s,hero,{c:5,r:12});Fable.combat.place(s,gob,{c:14,r:12});
  s.phase='running';s.order=s.creatures.map(c=>c.id);s.round=1;s.turn=1;
  s.creatures.forEach(c=>{c.economy=Fable.creature.newEconomy(c)});
  return {s,hero,gob};
}

async function hudWorld(){
  const C=await H.loadData({monsters:true,heroes:true});
  ['js/hud/models.js','js/hud/models-combat.js','js/hud/icons.js'].forEach(f=>H.runFile(f));
  return C;
}

module.exports=function(t){
  const {suite,test}=t;
  suite('phase 8 integration',()=>{
    test('the worker entry plans from plain data in a clean world and agrees with planning on the page',async()=>{
      const C=await H.loadData({monsters:true,heroes:true});
      const {s,gob}=scene(C);
      const json=JSON.stringify(Fable.combat.serialize(s));
      const inline=JSON.stringify(Fable.ai.plan(s,gob,{}).intents);
      /* a world with no content loaded but what the worker loads itself */
      H.fresh();
      H.runFile('js/rules/ai-worker.js');
      const base=H.dirUrl(path.join(H.ROOT,'js'));
      await Fable.aiWorker.init(H.nodeLoadScript,base,files=>files.forEach(f=>H.runFile('js/'+f+'.js')));
      const out=Fable.aiWorker.handle({id:7,state:JSON.parse(json),actor:gob.id,opts:{}});
      assert.strictEqual(out.id,7);
      assert.ok(!out.error,out.error);
      assert.strictEqual(JSON.stringify(out.plan.intents),inline);
    });
    test('a worker that cannot plan answers with an error instead of throwing',async()=>{
      H.fresh();
      H.runFile('js/rules/ai-worker.js');
      Fable.ai={planFromData(){throw new Error('boom')}};
      const out=Fable.aiWorker.handle({id:1,state:{},actor:'x'});
      assert.strictEqual(out.id,1);assert.strictEqual(out.error,'boom');
    });
    test('the action bar offers Hide and Search, and Pick up when the hero stands on its own thrown weapon',async()=>{
      const C=await hudWorld();
      const {s,hero}=scene(C);
      s.turn=0;hero.economy=Fable.creature.newEconomy(hero);
      let ids=Fable.hudModels.actionBar(s,hero).map(x=>x.id);
      assert.ok(ids.indexOf('action:hide')>=0&&ids.indexOf('action:search')>=0,ids.join(','));
      assert.ok(ids.indexOf('pickup')<0);
      hero.thrown.javelin=1;
      s.ground.push({id:'ground-1',item:'javelin',name:'Javelin',owner:hero.id,cell:{c:hero.cell.c,r:hero.cell.r}});
      const sl=Fable.hudModels.actionBar(s,hero).filter(x=>x.id==='pickup')[0];
      assert.ok(sl&&sl.ok,'pickup slot is usable');
    });
    test('the combat log words hiding, pickups, drops and morale without leaking enemy rolls for a hide',async()=>{
      const C=await hudWorld();
      const {s,gob}=scene(C);
      const L=e=>Fable.hudModels.logEntry(e,s);
      assert.match(L({type:'action',id:gob.id,result:{id:'hide',name:'Hide',creature:{id:gob.id,name:gob.name,team:'enemy'},hide:{success:true},text:'Hidden (Stealth 17 against DC 15)'}}).text,/slips out of sight/);
      assert.ok(!/DC/.test(L({type:'action',id:gob.id,result:{id:'hide',name:'Hide',creature:{id:gob.id,name:gob.name,team:'enemy'},hide:{success:true},text:'Hidden (Stealth 17 against DC 15)'}}).text));
      assert.match(L({type:'morale',id:gob.id,result:'flee',total:7,dc:10}).text,/flees/);
      assert.match(L({type:'morale',id:gob.id,result:'hold',total:12,dc:10,trigger:'bloodied'}).text,/holds its ground/);
      assert.match(L({type:'pickup',id:gob.id,result:{creature:{id:gob.id,name:gob.name,team:'enemy'},items:[{id:'g',item:'dagger',name:'Dagger'}]}}).text,/picks up its dagger/);
      assert.match(L({type:'drop',id:gob.id,item:{name:'Dagger',item:'dagger'}}).text,/lands on the ground/);
      assert.strictEqual(L({type:'recovered',ids:[]}),null);
    });
    test('the attack preview names the cover the target has',async()=>{
      const C=await hudWorld();
      const g=Fable.grid.create({cols:24,rows:24});
      Fable.grid.setBlocked(g,9,13,true);
      const hero=Fable.creature.fromSheet(Fable.character.compute(C.characters.get('human-fighter').build),{id:'hero',team:'player'});
      const gob=Fable.creature.fromMonster(C.monsters.get('goblin-minion'),{index:0});
      const s=Fable.combat.create({grid:g,seed:3,creatures:[hero,gob]});
      Fable.combat.place(s,hero,{c:5,r:12});Fable.combat.place(s,gob,{c:11,r:13});
      s.phase='running';s.order=['hero',gob.id];s.round=1;s.turn=0;s.creatures.forEach(c=>{c.economy=Fable.creature.newEconomy(c)});
      const jav=hero.attacks.filter(a=>a.mode==='thrown'&&a.item==='javelin')[0];
      const card=Fable.hudModels.targetCard(s,hero,gob,jav);
      assert.ok(card.preview&&card.preview.ok,JSON.stringify(card.preview));
      assert.ok(card.preview.roll.cover&&card.preview.roll.cover.bonus>=2,JSON.stringify(card.preview.roll));
    });
    test('the presentation plans every new event, and Nimble Escape can hide',async()=>{
      const C=await H.loadData({monsters:true,heroes:true,presentation:true});
      const who=id=>({id,team:id==='hero'?'player':'enemy',kind:id==='hero'?'hero':'monster',name:id,hpMax:20,x:id==='hero'?0:15,z:0,
        profile:C.presentationProfiles.get(id==='hero'?'human-fighter':'goblin-minion')});
      let seed=7;const rng=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
      const plan=Fable.createPlanner({who,clip:id=>C.animations.get(id),rng});
      ['pickup','morale','recovered'].forEach(type=>assert.ok(plan.handles(type),type));
      const m=plan.event({type:'morale',id:'gob',result:'flee',trigger:'bloodied'});
      assert.ok(m.cues.some(c=>c.type==='hud'&&c.hook==='morale'));
      assert.ok(m.cues.some(c=>c.type==='bark'&&c.situation==='flee'));
      const k=plan.event({type:'pickup',id:'gob',result:{creature:{id:'gob'},items:[]}});
      assert.ok(k.cues.some(c=>c.type==='hud'&&c.hook==='pickup'));
      const h=plan.event({type:'action',id:'gob',result:{id:'nimble-escape',name:'Nimble Escape',choice:'hide',creature:{id:'gob',name:'Goblin',team:'enemy'}}});
      assert.ok(h.cues.some(c=>c.type==='bark'&&c.situation==='hide'),'hides');
      assert.ok(h.cues.some(c=>c.type==='anim'&&c.tag==='status:hidden'));
      const d=plan.event({type:'action',id:'gob',result:{id:'nimble-escape',name:'Nimble Escape',choice:'disengage',creature:{id:'gob',name:'Goblin',team:'enemy'}}});
      assert.ok(d.cues.some(c=>c.type==='bark'&&c.situation==='flee'));
    });
    test('an encounter or monster ai block is validated, and an encounter override reaches the creature',async()=>{
      const C=await H.loadData({monsters:true,heroes:true});
      const def=C.monsters.get('goblin-minion');
      assert.strictEqual(Fable.creature.fromMonster(def,{ai:{tier:'tactician'}}).ai.tier,'tactician');
      assert.strictEqual(Fable.creature.fromMonster(def,{}).ai.tier,'cunning');
      assert.throws(()=>Fable.creature.fromMonster(def,{ai:{tier:'genius'}}),/tier/);
      const bad=JSON.parse(JSON.stringify(def));bad.ai={profile:'skirmisher',tier:'genius'};
      const r=Fable.statblock.validate?Fable.statblock.validate(bad):null;
      if(r)assert.ok(r.errors.some(e=>/tier/.test(e)),JSON.stringify(r));
      assert.throws(()=>C.encounters.register({id:'bad-ai',name:'x',map:'m',enemies:[],ai:{tricks:['nope']}}),/trick/);
    });
  });
};
