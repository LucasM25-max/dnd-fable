'use strict';
const assert=require('assert'),H=require('../harness');

/* Phase 8 rules: cover, light, Hide, Search, Nimble Escape, thrown weapons on the ground, plain data copies. */
async function world(){return H.loadData({monsters:true,heroes:true})}
function open(cols,rows){return Fable.grid.create({cols:cols||20,rows:rows||20})}
function fighter(C,id){return Fable.creature.fromSheet(Fable.character.compute(C.characters.get('human-fighter').build),{id:id||'hero'})}
function goblin(C,i){return Fable.creature.fromMonster(C.monsters.get('goblin-minion'),{index:i})}
function duel(C,g,hc,gc,seed){
  const hero=fighter(C),a=goblin(C,0);
  const s=Fable.combat.create({grid:g||open(),seed:seed||1,creatures:[hero,a]});
  Fable.combat.place(s,hero,hc||{c:2,r:10});Fable.combat.place(s,a,gc||{c:12,r:10});
  return {s,hero,a};
}
/* make c the active creature with a fresh budget, without rolling initiative */
function turnOf(s,c){
  s.phase='running';s.order=s.creatures.map(x=>x.id);s.turn=s.order.indexOf(c.id);s.round=1;
  Fable.creature.startTurn&&Fable.creature.startTurn(c);
}

module.exports=function(t){
  const {suite,test}=t;
  suite('phase 8 cover and light',()=>{
    test('a clear line gives no cover and a wall square in the way gives some',async()=>{
      await world();const G=Fable.grid,g=open();
      assert.strictEqual(G.coverBetween(g,{c:2,r:10},{c:12,r:10}).level,0);
      G.setBlocked(g,7,10,true);
      assert.ok(G.coverBetween(g,{c:2,r:10},{c:12,r:10}).level>=1);
    });
    test('adjacent creatures never have cover and the bonus values follow the SRD',async()=>{
      await world();const G=Fable.grid,g=open();
      G.setBlocked(g,3,9,true);
      assert.strictEqual(G.coverBetween(g,{c:2,r:10},{c:3,r:10}).level,0);
      assert.deepStrictEqual(G.COVER_BONUS,[0,2,5,0]);
    });
    test('a block off to the side of the line gives half cover, never more than the corners allow',async()=>{
      await world();const G=Fable.grid,g=open();
      G.setBlocked(g,7,11,true);
      const c=G.coverBetween(g,{c:2,r:10},{c:12,r:10});
      assert.ok(c.level<=1);
    });
    test('cover raises the AC an attack must beat',async()=>{
      const C=await world(),G=Fable.grid,g=open();
      G.setBlocked(g,7,10,true);G.setBlocked(g,7,9,true);
      const {s,hero,a}=duel(C,g);
      const cv=Fable.combat.coverFor(s,hero,a);
      if(cv.level>=3)return;
      assert.strictEqual(Fable.combat.targetAc(s,hero,a,{cover:cv}),a.ac.value+cv.bonus);
    });
    test('Total Cover cannot be targeted',async()=>{
      const C=await world(),G=Fable.grid,g=open();
      for(let r=0;r<20;r++)G.setBlocked(g,7,r,true);
      const {s,hero,a}=duel(C,g);turnOf(s,hero);
      const atk=hero.attacks.filter(x=>x.mode==='thrown'||x.mode==='ranged')[0];
      if(atk)assert.ok(!Fable.combat.checkTarget(s,hero,atk,a).ok);
    });
    test('Darkvision turns dim light bright and darkness dim, out to its range',async()=>{
      const C=await world(),G=Fable.grid,g=open();
      const {s,hero,a}=duel(C,g);
      G.setLight(g,5,5,2);G.setLight(g,6,5,1);
      assert.strictEqual(Fable.senses.effectiveLight(s,hero,{c:5,r:5}),2);
      assert.strictEqual(Fable.senses.effectiveLight(s,a,{c:5,r:5}),1);
      assert.strictEqual(Fable.senses.effectiveLight(s,a,{c:6,r:5}),0);
    });
  });

  suite('phase 8 hide and search',()=>{
    test('nobody can hide in plain sight, and the reason says why',async()=>{
      const C=await world(),{s,a}=duel(C);
      const h=Fable.senses.hideCheck(s,a);
      assert.ok(!h.ok&&h.reason);
    });
    test('behind Total Cover a creature can hide, the roll is DC 15 and success leaves it Hidden',async()=>{
      const C=await world(),G=Fable.grid,g=open();
      for(let r=0;r<20;r++)G.setBlocked(g,7,r,true);
      const {s,hero,a}=duel(C,g);turnOf(s,a);
      assert.ok(Fable.senses.hideCheck(s,a).ok);
      let ok=0;
      for(let i=0;i<30;i++){
        const x=goblin(C,5);const sc=Fable.combat.create({grid:g,seed:i+1,creatures:[fighter(C),x]});
        Fable.combat.place(sc,sc.creatures[0],{c:2,r:10});Fable.combat.place(sc,x,{c:12,r:10});
        const r=Fable.senses.hide(sc,x);assert.ok(r.ok&&r.dc===15);
        assert.strictEqual(r.success,r.roll.total>=15);
        assert.strictEqual(Fable.status.has(x,'hidden'),r.success);
        if(r.success)ok++;
      }
      assert.ok(ok>15,'a goblin has +6 Stealth with Expertise: it hides most of the time');
    });
    test('a hidden creature cannot be targeted, and attacking reveals it with Advantage on the roll',async()=>{
      const C=await world(),G=Fable.grid,g=open();
      const {s,hero,a}=duel(C,g,{c:2,r:10},{c:3,r:10});
      Fable.status.add(s,a,{id:'hidden',source:{id:'hide',name:'Hide'},data:{stealth:20}});
      turnOf(s,hero);
      const atk=hero.attacks[0];
      assert.ok(!Fable.combat.checkTarget(s,hero,atk,a).ok);
      assert.ok(Fable.combat.checkTarget(s,hero,atk,a,{ignoreHidden:true}).ok);
      turnOf(s,a);
      const ha=a.attacks.filter(x=>x.mode==='melee')[0];
      const r=Fable.combat.attack(s,a,ha.id,hero);
      assert.strictEqual(r.roll.mode,'advantage');
      assert.ok(!Fable.status.has(a,'hidden'));
    });
    test('Search finds a hidden enemy when the Perception total beats its Stealth',async()=>{
      const C=await world(),{s,hero,a}=duel(C,open(),{c:2,r:10},{c:8,r:10});
      Fable.status.add(s,a,{id:'hidden',source:{id:'hide',name:'Hide'},data:{stealth:1}});
      turnOf(s,hero);
      const r=Fable.combat.useAction(s,hero,'search');
      assert.ok(r.ok);assert.deepStrictEqual(r.search.found,[a.id]);
      assert.ok(!Fable.status.has(a,'hidden'));
    });
    test('Search spends the Action and reports when nothing is found',async()=>{
      const C=await world(),{s,hero,a}=duel(C);
      Fable.status.add(s,a,{id:'hidden',source:{id:'hide',name:'Hide'},data:{stealth:99}});
      turnOf(s,hero);
      const r=Fable.combat.useAction(s,hero,'search');
      assert.ok(r.ok&&r.search.found.length===0&&hero.economy.action);
      assert.ok(Fable.status.has(a,'hidden'));
    });
    test('a hidden creature that ends its turn in an enemy\'s sight is found',async()=>{
      const C=await world(),{s,hero,a}=duel(C);
      Fable.status.add(s,a,{id:'hidden',source:{id:'hide',name:'Hide'},data:{stealth:20}});
      Fable.senses.revalidate(s,{});
      assert.ok(!Fable.status.has(a,'hidden'));
    });
    test('Nimble Escape is a Bonus Action that takes Disengage or Hide',async()=>{
      const C=await world(),{s,a}=duel(C);turnOf(s,a);
      assert.ok(!Fable.combat.useAction(s,a,'nimble-escape').ok);
      assert.ok(!Fable.combat.useAction(s,a,'nimble-escape',{choice:'hide'}).ok);
      const r=Fable.combat.useAction(s,a,'nimble-escape',{choice:'disengage'});
      assert.ok(r.ok&&a.economy.bonus&&Fable.status.has(a,'disengaged'));
    });
  });

  suite('phase 8 ground items',()=>{
    function thrower(C){
      const {s,hero,a}=duel(C,open(),{c:2,r:10},{c:8,r:10});
      turnOf(s,a);return {s,hero,a};
    }
    test('a thrown dagger lands beside the target (its own square is taken), hit or miss, and stays counted as thrown',async()=>{
      const C=await world(),{s,hero,a}=thrower(C);
      const atk=a.attacks.filter(x=>x.mode==='thrown')[0];assert.ok(atk);
      const before=a.thrown[atk.item]||0;
      const r=Fable.combat.attack(s,a,atk.id,hero);
      assert.ok(r.ok);assert.strictEqual(s.ground.length,1);
      assert.ok(Fable.grid.chebyshev(s.ground[0].cell,hero.cell)===1);
      assert.ok(!Fable.combat.occupant(s,s.ground[0].cell,null));
      assert.strictEqual(a.thrown[atk.item],before+1);
    });
    test('picking a weapon up is a free object interaction on its square, then the Action',async()=>{
      const C=await world(),{s,a}=thrower(C);
      s.ground.push({id:'g1',item:'dagger',name:'Dagger',owner:a.id,cell:{c:a.cell.c,r:a.cell.r}});
      a.thrown.dagger=1;
      const r=Fable.combat.pickup(s,a);
      assert.ok(r.ok&&r.cost==='object'&&a.thrown.dagger===0&&!s.ground.length);
      assert.ok(!Fable.combat.pickup(s,a).ok);
    });
    test('a creature cannot pick up another creature\'s weapon, nor one that is not under it',async()=>{
      const C=await world(),{s,hero,a}=thrower(C);
      s.ground.push({id:'g1',item:'dagger',name:'Dagger',owner:hero.id,cell:{c:a.cell.c,r:a.cell.r}});
      assert.ok(!Fable.combat.pickupState(s,a).ok);
      s.ground.length=0;s.ground.push({id:'g2',item:'dagger',name:'Dagger',owner:a.id,cell:{c:1,r:1}});
      assert.ok(!Fable.combat.pickupState(s,a).ok);
    });
    test('when the fight ends every thrown weapon goes back to its owner',async()=>{
      const C=await world(),{s,a}=thrower(C);
      a.thrown.dagger=2;
      s.ground.push({id:'g1',item:'dagger',name:'Dagger',owner:a.id,cell:{c:1,r:1}},{id:'g2',item:'dagger',name:'Dagger',owner:a.id,cell:{c:2,r:2}});
      Fable.combat.recoverThrown(s);
      assert.strictEqual(a.thrown.dagger,0);assert.strictEqual(s.ground.length,0);
    });
  });

  suite('phase 8 plain data',()=>{
    test('serialize then deserialize plays the same fight (same dice, same results)',async()=>{
      const C=await world(),{s,hero,a}=duel(C);
      const data=JSON.parse(JSON.stringify(Fable.combat.serialize(s)));
      const s2=Fable.combat.deserialize(data);
      assert.strictEqual(s2.creatures.length,2);
      assert.deepStrictEqual(s2.byId[a.id].cell,a.cell);
      assert.strictEqual(s2.byId[a.id].ac.value,a.ac.value);
      assert.strictEqual(s2.rng.getState(),s.rng.getState());
      assert.strictEqual(s2.grid.cols,s.grid.cols);
    });
    test('a clone can be played without touching the fight or its dice',async()=>{
      const C=await world(),{s,hero,a}=duel(C,open(),{c:2,r:10},{c:3,r:10});
      const st=s.rng.getState(),hp=hero.hp.current;
      const n=Fable.combat.clone(s);
      n.phase='running';n.order=n.creatures.map(x=>x.id);n.turn=1;n.round=1;
      const ca=n.byId[a.id];Fable.creature.startTurn&&Fable.creature.startTurn(ca);
      const atk=ca.attacks.filter(x=>x.mode==='melee')[0];
      for(let i=0;i<5;i++)Fable.combat.attack(n,ca,atk.id,n.byId[hero.id]);
      assert.strictEqual(s.rng.getState(),st);assert.strictEqual(hero.hp.current,hp);
      assert.strictEqual(a.economy.action,false);
    });
  });
};
