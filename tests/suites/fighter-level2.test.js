'use strict';
const assert=require('assert'),H=require('../harness');

/* Fighter level 2 (Action Surge, Tactical Mind) and levelling up (implementation plan, section 7 and Phase 10). */
async function world(){return H.loadData({monsters:true,heroes:true})}
function open(){return Fable.grid.create({cols:20,rows:20})}
function build(C,level,extra){
  const b=JSON.parse(JSON.stringify(C.characters.get('human-fighter').build));
  b.classLevels[0].level=level;if(level>1)b.classLevels[0].hp='average';
  return Object.assign(b,extra||{});
}
function hero(C,level,extra){
  const b=build(C,level,extra);
  return Fable.creature.fromSheet(Fable.character.compute(b),{id:'hero',build:b});
}
function goblin(C,i){return Fable.creature.fromMonster(C.monsters.get('goblin-minion'),{index:i})}
function duel(C,level,extra,gc){
  const h=hero(C,level,extra),a=goblin(C,0);
  const s=Fable.combat.create({grid:open(),seed:1,creatures:[h,a]});
  Fable.combat.place(s,h,{c:5,r:5});Fable.combat.place(s,a,gc||{c:6,r:5});
  s.phase='running';s.order=['hero',a.id];s.turn=0;s.round=1;
  h.economy=Fable.creature.newEconomy(h);
  return {s,h,a};
}
function rig(s,list){let i=0;s.rng=()=>{const v=list[Math.min(i,list.length-1)];i++;return v}}
const d20=v=>(v-0.5)/20;
const fr=(v,sides)=>(v-0.5)/sides;
function store(){const m={};return {getItem:k=>k in m?m[k]:null,setItem:(k,v)=>{m[k]=String(v)},removeItem:k=>{delete m[k]}}}

module.exports=function(t){
  const {suite,test}=t;

  suite('fighter level 2: Action Surge',()=>{
    test('a level 1 fighter has no Action Surge; a level 2 fighter has one use that comes back on a short or long rest',async()=>{
      const C=await world();
      const s1=Fable.character.compute(build(C,1)),s2=Fable.character.compute(build(C,2));
      assert.ok(!s1.actions.some(a=>a.id==='action-surge'));
      assert.ok(s2.actions.some(a=>a.id==='action-surge'&&a.cost==='free'));
      assert.strictEqual(s2.resources['action-surge-uses'].max,1);
      assert.deepStrictEqual(s2.resources['action-surge-uses'].recharge,{short:'all',long:'all'});
      assert.strictEqual(Fable.content.valueAtLevel(Fable.content.features.get('action-surge').resources[0].max,{fighter:17}),2);
      const spent=Fable.character.rest.apply(Object.assign(build(C,2),{resources:{'action-surge-uses':0}}),'short');
      assert.strictEqual(spent.build.resources['action-surge-uses'],1);
    });
    test('it cannot be used before the Action is spent, and costs nothing from the economy',async()=>{
      const C=await world(),{s,h}=duel(C,2);
      const st=Fable.combat.actionState(s,h,'action-surge');
      assert.ok(!st.ok&&/Action first/.test(st.reason),st.reason);
      assert.strictEqual(h.resources['action-surge-uses'].current,1);
    });
    test('after an attack it hands the Action back: a second Attack action, the pool spent, and nothing else spent',async()=>{
      const C=await world(),{s,h,a}=duel(C,2);
      a.ac.value=40;rig(s,[d20(2)]);
      assert.ok(Fable.combat.attack(s,h,'longsword:melee',a).ok);
      assert.ok(!Fable.combat.attack(s,h,'longsword:melee',a).ok,'the Action is spent');
      h.economy.bonus=true;
      const r=Fable.combat.useAction(s,h,'action-surge');
      assert.ok(r.ok&&r.surge,JSON.stringify(r));
      assert.strictEqual(h.resources['action-surge-uses'].current,0);
      assert.strictEqual(h.economy.action,false);assert.strictEqual(h.economy.attacksUsed,0);assert.strictEqual(h.economy.bonus,true,'the Bonus Action stays spent');
      rig(s,[d20(2)]);
      const again=Fable.combat.attack(s,h,'longsword:melee',a);
      assert.ok(again.ok,'a whole new Attack action');
      assert.ok(!Fable.combat.attack(s,h,'longsword:melee',a).ok,'and that one is spent as well');
    });
    test('only once on a turn, and only while a use is left',async()=>{
      const C=await world();
      let {s,h}=duel(C,2,{resources:{'action-surge-uses':1}});
      h.economy.action=true;
      assert.ok(Fable.combat.useAction(s,h,'action-surge').ok);
      h.economy.action=true;
      const again=Fable.combat.actionState(s,h,'action-surge');
      assert.ok(!again.ok);
      ({s,h}=duel(C,2,{resources:{'action-surge-uses':0}}));
      h.economy.action=true;
      const none=Fable.combat.actionState(s,h,'action-surge');
      assert.ok(!none.ok&&/No uses/.test(none.reason),none.reason);
    });
    test('the extra action can be a second Dash, which doubles the speed again; a plain turn still allows one',async()=>{
      const C=await world(),{s,h}=duel(C,2);
      assert.ok(Fable.combat.useAction(s,h,'dash').ok);
      assert.ok(!Fable.combat.actionState(s,h,'dash').ok);
      assert.ok(Fable.combat.useAction(s,h,'action-surge').ok);
      assert.ok(Fable.combat.useAction(s,h,'dash').ok);
      assert.strictEqual(h.economy.dashes,2);
      assert.strictEqual(Fable.creature.movementMaxFt(h),h.economy.speedFt*3);
    });
    test('a new turn starts with no surge taken, so the next turn cannot be refused for the last one',async()=>{
      const C=await world(),{h}=duel(C,2);
      h.economy.surges=1;
      assert.strictEqual(Fable.creature.newEconomy(h).surges,0);
    });
    test('it is offered as a free action in the HUD slots, with its uses',async()=>{
      const C=await world();Fable.hudModels||H.runFile('js/hud/models.js');H.runFile('js/hud/models-combat.js');
      const {s,h}=duel(C,2);
      h.economy.action=true;
      const slot=Fable.hudModels.actionBar(s,h).filter(x=>x.id==='action:action-surge')[0];
      assert.ok(slot&&slot.ok&&slot.cost==='free'&&slot.uses.current===1&&slot.uses.max===1);
      assert.strictEqual(slot.group,'ability');
    });
  });

  suite('fighter level 2: Tactical Mind',()=>{
    function searcher(C,dcOver){
      const o=duel(C,2,null,{c:9,r:5});
      o.s.order=['hero',o.a.id];
      const bonus=Fable.senses.perceptionBonus(o.h);
      return {...o,bonus,total:10+bonus};
    }
    test('a failed Search offers 1d10 to a fighter who has Second Wind left, and nobody else',async()=>{
      const C=await world();
      const o=searcher(C);
      Fable.status.add(o.s,o.a,{id:'hidden',source:{id:'hide',name:'Hide'},data:{stealth:o.total+4}});
      rig(o.s,[d20(10)]);
      const r=Fable.combat.useAction(o.s,o.h,'search');
      assert.ok(r.ok&&r.search.found.length===0);
      assert.ok(r.search.tacticalMind&&r.search.tacticalMind.dice==='1d10'&&r.search.tacticalMind.dc===o.total+4);
      const l1=duel(C,1,null,{c:9,r:5});
      Fable.status.add(l1.s,l1.a,{id:'hidden',source:{id:'hide',name:'Hide'},data:{stealth:99}});
      assert.ok(!Fable.combat.useAction(l1.s,l1.h,'search').search.tacticalMind,'level 1 has no Tactical Mind');
    });
    test('adding the d10 that turns the failure into a success finds the creature and spends one Second Wind use',async()=>{
      const C=await world(),o=searcher(C);
      Fable.status.add(o.s,o.a,{id:'hidden',source:{id:'hide',name:'Hide'},data:{stealth:o.total+4}});
      rig(o.s,[d20(10)]);
      const r=Fable.combat.useAction(o.s,o.h,'search');
      const events=[];Fable.combat.on(o.s,e=>events.push(e));
      rig(o.s,[fr(6,10)]);
      const tm=Fable.senses.useTacticalMind(o.s,o.h,r);
      assert.ok(tm.ok&&tm.success&&tm.spent&&tm.die===6&&tm.total===o.total+6,JSON.stringify(tm));
      assert.deepStrictEqual(tm.found,[o.a.id]);
      assert.ok(!Fable.status.has(o.a,'hidden'));
      assert.strictEqual(o.h.resources['second-wind-uses'].current,1);
      assert.ok(events.some(e=>e.type==='tactical-mind'&&e.result.success));
      assert.ok(!Fable.senses.useTacticalMind(o.s,o.h,r).ok,'one push per failed check');
    });
    test('a d10 that still falls short changes nothing and the Second Wind use is kept',async()=>{
      const C=await world(),o=searcher(C);
      Fable.status.add(o.s,o.a,{id:'hidden',source:{id:'hide',name:'Hide'},data:{stealth:o.total+11}});
      rig(o.s,[d20(10)]);
      const r=Fable.combat.useAction(o.s,o.h,'search');
      rig(o.s,[fr(3,10)]);
      const tm=Fable.senses.useTacticalMind(o.s,o.h,r);
      assert.ok(tm.ok&&!tm.success&&!tm.spent);
      assert.ok(Fable.status.has(o.a,'hidden'));
      assert.strictEqual(o.h.resources['second-wind-uses'].current,2);
    });
    test('with no Second Wind use left there is no offer and no push',async()=>{
      const C=await world(),h=hero(C,2,{resources:{'second-wind-uses':0}}),a=goblin(C,0);
      const s=Fable.combat.create({grid:open(),seed:1,creatures:[h,a]});
      Fable.combat.place(s,h,{c:5,r:5});Fable.combat.place(s,a,{c:9,r:5});
      s.phase='running';s.order=['hero',a.id];s.turn=0;s.round=1;h.economy=Fable.creature.newEconomy(h);
      Fable.status.add(s,a,{id:'hidden',source:{id:'hide',name:'Hide'},data:{stealth:99}});
      const r=Fable.combat.useAction(s,h,'search');
      assert.ok(!r.search.tacticalMind);
    });
    test('a failed Hide can be pushed the same way, and a success becomes Hidden with the new total',async()=>{
      const C=await world(),G=Fable.grid,g=open();
      for(let r=0;r<20;r++)G.setBlocked(g,7,r,true);
      const h=hero(C,2),a=goblin(C,0);
      const s=Fable.combat.create({grid:g,seed:1,creatures:[h,a]});
      Fable.combat.place(s,h,{c:6,r:5});Fable.combat.place(s,a,{c:12,r:5});
      s.phase='running';s.order=['hero',a.id];s.turn=0;s.round=1;h.economy=Fable.creature.newEconomy(h);
      const bonus=Fable.senses.stealthBonus(h);
      rig(s,[d20(15-bonus-5)]);
      const r=Fable.combat.useAction(s,h,'hide');
      assert.ok(r.ok&&!r.hide.success,JSON.stringify(r.hide));
      assert.ok(r.hide.tacticalMind&&r.hide.tacticalMind.dc===15);
      rig(s,[fr(7,10)]);
      const tm=Fable.senses.useTacticalMind(s,h,r);
      assert.ok(tm.success&&tm.spent&&tm.total===15-5+7);
      assert.ok(Fable.status.has(h,'hidden'));
    });
  });

  suite('levelling up',()=>{
    test('the level comes from the XP, and the next level is ready only when the XP is there',async()=>{
      const C=await world(),T=Fable.character.levelup;
      let st=T.status(build(C,1,{xp:299}));
      assert.ok(!st.ready&&st.xpToGo===1&&st.level===1);
      st=T.status(build(C,1,{xp:300}));
      assert.ok(st.ready&&st.nextLevel===2&&st.earnedLevel===2);
    });
    test('a level the class has no rules for yet is not offered, and says so',async()=>{
      const C=await world(),T=Fable.character.levelup;
      const st=T.status(build(C,2,{xp:900}));
      assert.ok(!st.ready&&st.blocked&&/later update/.test(st.reason),st.reason);
      assert.strictEqual(T.preview(build(C,2,{xp:900})),null);
      assert.ok(!T.apply(build(C,2,{xp:900})).ok);
    });
    test('the preview shows the hit points, the proficiency bonus and the two new Fighter features',async()=>{
      const C=await world(),T=Fable.character.levelup,b=build(C,1,{xp:300}),p=T.preview(b);
      assert.strictEqual(p.fromLevel,1);assert.strictEqual(p.toLevel,2);
      assert.strictEqual(p.hp.from,12);assert.strictEqual(p.hp.to,20);assert.strictEqual(p.hp.gain,8);
      assert.strictEqual(p.hp.average,6);assert.strictEqual(p.hp.conMod,2);
      assert.deepStrictEqual(p.features.map(f=>f.name),['Action Surge','Tactical Mind']);
      assert.ok(p.features[0].action&&p.features[0].uses.max===1);
      assert.ok(p.features[1].passive);
      assert.deepStrictEqual(p.resources.map(r=>r.id),['action-surge-uses']);
      assert.strictEqual(p.proficiency.from,2);
    });
    test('applying the level returns a new build and never changes the one it was given',async()=>{
      const C=await world(),T=Fable.character.levelup,b=build(C,1,{xp:300}),before=JSON.stringify(b);
      const r=T.apply(b);
      assert.ok(r.ok);assert.strictEqual(JSON.stringify(b),before);
      assert.strictEqual(r.build.classLevels[0].level,2);assert.strictEqual(r.build.classLevels[0].hp,'average');
      const sh=Fable.character.compute(r.build);
      assert.strictEqual(sh.level,2);assert.strictEqual(sh.summary.hp,20);
      assert.deepStrictEqual(sh.issues.filter(i=>i.severity==='error'),[]);
      assert.ok(sh.actions.some(a=>a.id==='action-surge'));
      assert.ok(!T.status(r.build).ready,'level 3 needs XP and rules');
    });
    test('a level 2 hero starts a fight with full hit points, Action Surge and Second Wind',async()=>{
      const C=await world(),r=Fable.character.levelup.apply(build(C,1,{xp:300})),h=Fable.creature.fromSheet(Fable.character.compute(r.build),{id:'hero',build:r.build});
      assert.strictEqual(h.hp.max,20);assert.strictEqual(h.hp.current,20);
      assert.strictEqual(h.resources['action-surge-uses'].current,1);assert.strictEqual(h.resources['second-wind-uses'].current,2);
    });
    test('the roster saves the level and loads it back, rejects a level the rules do not have, and restart clears it',async()=>{
      const C=await world();H.runFile('js/character/roster.js');
      globalThis.localStorage=store();
      const R=Fable.character.roster,id='human-fighter';
      R.restart(id);R.grant(id,{xp:350});
      assert.ok(R.levelStatus(id).ready);
      const r=R.levelUp(id);
      assert.ok(r.ok&&r.sheet.level===2);
      assert.ok(!R.levelUp(id).ok,'no level 3 yet');
      const saved=JSON.parse(globalThis.localStorage.getItem('dicebound.progress.v1'));
      assert.strictEqual(saved.heroes[id].classLevels[0].level,2);
      /* a fresh page: the roster forgets its memory but the store stays */
      H.runFile('js/character/roster.js');
      assert.strictEqual(Fable.character.roster.build(id).classLevels[0].level,2);
      assert.strictEqual(Fable.character.roster.sheet(id).summary.hp,20);
      const bad=JSON.parse(globalThis.localStorage.getItem('dicebound.progress.v1'));
      bad.heroes[id].classLevels[0].level=9;
      globalThis.localStorage.setItem('dicebound.progress.v1',JSON.stringify(bad));
      H.runFile('js/character/roster.js');
      assert.strictEqual(Fable.character.roster.build(id).classLevels[0].level,1,'level 9 has no rules, so the shipped level stands');
      Fable.character.roster.restart(id);
      assert.strictEqual(Fable.character.roster.build(id).classLevels[0].level,1);
      delete globalThis.localStorage;
    });
  });
};
