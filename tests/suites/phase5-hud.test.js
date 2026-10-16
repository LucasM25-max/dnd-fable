'use strict';
const assert=require('assert'),H=require('../harness');

/* Phase 5: what the HUD shows is derived from the combat state by pure view models (implementation plan, section 13). */
async function world(){
  const C=await H.loadData({monsters:true,heroes:true});
  H.runFile('js/hud/models.js');
  return C;
}
function fight(C,seed){
  const hero=Fable.creature.fromSheet(Fable.character.compute(C.characters.get('human-fighter').build),{id:'hero'});
  const a=Fable.creature.fromMonster(C.monsters.get('goblin-minion'),{index:0,id:'goblin-minion-1'});
  const s=Fable.combat.create({grid:Fable.grid.create({cols:20,rows:20}),seed:seed||3,creatures:[hero,a]});
  Fable.combat.place(s,hero,{c:2,r:2});Fable.combat.place(s,a,{c:9,r:2});
  return {s,hero,a};
}

module.exports=function(t){
  const {suite,test}=t;
  suite('phase 5 hud models',()=>{
    test('health: numbers, AC breakdown, bloodied and temporary hit points',async()=>{
      const C=await world(),{hero}=fight(C);
      const h=Fable.hudModels.health(hero);
      assert.strictEqual(h.ac,19);assert.strictEqual(h.cur,12);assert.strictEqual(h.max,12);assert.strictEqual(h.pct,100);assert.ok(!h.bloodied);
      assert.strictEqual(h.acTip,'Armor Class 19\nChain Mail 16\nShield 2\nDefense 1');
      assert.strictEqual(h.subtitle,'Human Fighter 1');assert.strictEqual(h.inspiration,hero.inspiration);hero.inspiration=true;assert.ok(Fable.hudModels.health(hero).inspiration);
      Fable.creature.setHp(hero,6);
      assert.ok(Fable.hudModels.health(hero).bloodied);
      Fable.creature.setHp(hero,7);assert.ok(!Fable.hudModels.health(hero).bloodied);
      hero.hp.temp=4;hero.hp.current=12;
      const t4=Fable.hudModels.health(hero);
      assert.strictEqual(t4.temp,4);assert.ok(t4.pct<100&&t4.tempPct===100);
      Fable.creature.setHp(hero,0);assert.ok(Fable.hudModels.health(hero).down);
      Fable.creature.addCondition(hero,{id:'prone',name:'Prone'});
      assert.deepStrictEqual(Fable.hudModels.health(hero).conditions,[{id:'prone',name:'Prone'}]);
    });
    test('ribbon: turn order, active chip, hero sliver, enemy has none',async()=>{
      const C=await world(),{s,a}=fight(C);
      Fable.combat.start(s);
      const r=Fable.hudModels.ribbon(s);
      assert.strictEqual(r.round,1);assert.strictEqual(r.chips.length,2);
      assert.deepStrictEqual(r.chips.map(c=>c.id),s.order);
      assert.strictEqual(r.chips.filter(c=>c.active).length,1);assert.ok(r.chips[0].active);
      const hero=r.chips.find(c=>c.id==='hero'),gob=r.chips.find(c=>c.id===a.id);
      assert.strictEqual(hero.hpPct,100);assert.strictEqual(gob.hpPct,null);
      assert.ok(/initiative \d+, ally/.test(hero.label));assert.ok(/enemy/.test(gob.label));
      Fable.creature.setHp(a,3);assert.ok(Fable.hudModels.ribbon(s).chips.find(c=>c.id===a.id).bloodied);
      Fable.creature.setHp(a,0);assert.ok(Fable.hudModels.ribbon(s).chips.find(c=>c.id===a.id).defeated);
    });
    test('economy: markers, movement segments from the right, Dash adds gold segments, preview pulses what a move spends',async()=>{
      const C=await world(),{s,hero}=fight(C,5);
      s.phase='running';s.order=['hero'];s.turn=0;s.round=1;hero.economy=Fable.creature.newEconomy(hero);
      let e=Fable.hudModels.economy(hero);
      assert.strictEqual(e.movement.text,'30 / 30 ft');assert.strictEqual(e.movement.segments.length,6);
      assert.ok(e.movement.segments.every(x=>x.state==='full'&&!x.preview));
      hero.economy.movedFt=15;hero.economy.action=true;
      e=Fable.hudModels.economy(hero);
      assert.deepStrictEqual(e.movement.segments.map(x=>x.state),['full','full','full','spent','spent','spent']);
      assert.ok(e.action.used&&!e.bonus.used&&!e.reaction.used);
      e=Fable.hudModels.economy(hero,{costFt:10,ok:true});
      assert.deepStrictEqual(e.movement.segments.map(x=>x.preview),[false,true,true,false,false,false]);
      hero.economy.dashes=1;
      e=Fable.hudModels.economy(hero);
      assert.strictEqual(e.movement.segments.length,12);assert.strictEqual(e.movement.text,'45 / 60 ft');
      assert.ok(e.movement.segments[8].dash&&!e.movement.segments[2].dash);
      hero.economy.movedFt=12;
      e=Fable.hudModels.economy(hero);
      assert.strictEqual(e.movement.segments[9].state,'part');assert.strictEqual(e.movement.segments[9].part,60);
    });
    test('move label follows the denied move wording',async()=>{
      const C=await world(),{s,hero}=fight(C,5);
      s.phase='running';s.order=['hero'];s.turn=0;s.round=1;hero.economy=Fable.creature.newEconomy(hero);
      const L=cell=>Fable.hudModels.moveLabel(Fable.combat.planMove(s,hero,cell));
      assert.deepStrictEqual(L({c:5,r:2}),{tone:'ok',main:'15',unit:'ft',sub:'15 ft left'});
      assert.deepStrictEqual(L({c:10,r:3}),{tone:'deny',main:'40',unit:'ft',sub:'10 ft short'});
      assert.strictEqual(L({c:9,r:2}).main,'Occupied');
      assert.strictEqual(L({c:-1,r:2}).main,'Blocked');
      assert.strictEqual(L({c:2,r:2}),null);
      Fable.grid.setBlocked(s.grid,4,1,true);Fable.grid.setBlocked(s.grid,4,2,true);Fable.grid.setBlocked(s.grid,4,3,true);
      for(let r=0;r<20;r++)Fable.grid.setBlocked(s.grid,4,r,true);
      assert.strictEqual(L({c:6,r:2}).main,'No path');
    });
    test('reachable: every square within the budget, none occupied, none beyond',async()=>{
      const C=await world(),{s,hero,a}=fight(C,5);
      s.phase='running';s.order=['hero'];s.turn=0;s.round=1;hero.economy=Fable.creature.newEconomy(hero);
      const r=Fable.combat.reachable(s,hero);
      assert.ok(r.length>0&&r.every(q=>q.ft>0&&q.ft<=30));
      assert.ok(!r.some(q=>q.c===2&&q.r===2));
      Fable.combat.place(s,a,{c:4,r:2});
      assert.ok(!Fable.combat.reachable(s,hero).some(q=>q.c===4&&q.r===2));
      hero.economy.movedFt=30;assert.deepStrictEqual(Fable.combat.reachable(s,hero),[]);
    });
    test('portraits render to SVG and a bad one falls back instead of throwing',async()=>{
      const C=await world();
      const svg=Fable.hudModels.portraitSvg(C.monsters.get('goblin-minion').portrait);
      assert.ok(/^<svg viewBox="0 0 12 12"/.test(svg)&&/<rect/.test(svg));
      assert.ok(/^<svg/.test(Fable.hudModels.portraitSvg(null)));
      assert.ok(/^<svg/.test(Fable.hudModels.portraitSvg({width:2,rows:[],palette:{}})));
      assert.ok(Fable.hudModels.portraitSvg(C.characters.get('human-fighter').portrait).includes('#a8322b'));
    });
    test('text is escaped',async()=>{
      await world();
      assert.strictEqual(Fable.hudModels.escape('<b>"x"&</b>'),'&lt;b&gt;&quot;x&quot;&amp;&lt;/b&gt;');
    });
  });
};
