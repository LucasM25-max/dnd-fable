'use strict';
const assert=require('assert'),H=require('../harness');

/* The Goblin Warrior (2024 Monster Manual): its stat block, the advantage damage rider on its attacks, how the encounter generator
   uses it, and what the presentation layer needs to draw it. */
async function world(){return H.loadData({monsters:true,heroes:true,presentation:true})}
function setup(C,id){
  const h=Fable.creature.fromSheet(Fable.character.compute(C.characters.get('human-fighter').build),{id:'hero',build:C.characters.get('human-fighter').build});
  const w=Fable.creature.fromMonster(C.monsters.get('goblin-warrior'),{id:id||'goblin-warrior-1'});
  const s=Fable.combat.create({grid:Fable.grid.create({cols:20,rows:20}),seed:1,creatures:[h,w]});
  Fable.combat.place(s,h,{c:5,r:5});Fable.combat.place(s,w,{c:6,r:5});
  s.phase='running';s.order=[w.id,'hero'];s.turn=0;s.round=1;
  w.economy=Fable.creature.newEconomy(w);
  return {s,h,w};
}
function rig(s,list){let i=0;s.rng=()=>{const v=list[Math.min(i,list.length-1)];i++;return v}}
const d20=v=>(v-0.5)/20;

module.exports=function(t){
  const {suite,test}=t;
  suite('goblin warrior',()=>{
    test('the stat block is the 2024 Monster Manual one',async()=>{
      const C=await world(),d=C.monsters.get('goblin-warrior');
      assert.ok(d);
      assert.strictEqual(d.ac.value,15);assert.strictEqual(d.hp.average,10);assert.strictEqual(d.hp.dice,'3d6');
      assert.strictEqual(d.challenge.xp,50);assert.strictEqual(d.challenge.cr,'1/4');
      assert.strictEqual(d.abilities.dex,15);assert.strictEqual(d.abilities.str,8);
      assert.strictEqual(d.speed.walk,30);
      assert.deepStrictEqual(Fable.statblock.check(d).errors,[]);
      const w=Fable.creature.fromMonster(d,{id:'w1'});
      const sc=w.attacks.find(a=>a.id==='scimitar:melee'),bow=w.attacks.find(a=>a.id==='shortbow:ranged');
      assert.ok(sc&&bow);
      assert.strictEqual(sc.bonus.value,4);assert.strictEqual(sc.damage.expression,'1d6+2');assert.strictEqual(sc.damage.advantage.expression,'1d4');
      assert.strictEqual(bow.bonus.value,4);assert.strictEqual(bow.mode,'ranged');assert.deepStrictEqual([bow.range.normal,bow.range.long],[80,320]);
      assert.strictEqual(bow.damage.type,'piercing');
      assert.ok(JSON.stringify(d.bonusActions).indexOf('nimble-escape')>=0);
    });
    test('the extra 1d4 is rolled only when the attack roll had Advantage, and doubles on a critical hit',async()=>{
      const C=await world();
      const sc=Fable.creature.fromMonster(C.monsters.get('goblin-warrior'),{id:'x'}).attacks.find(a=>a.id==='scimitar:melee');
      assert.strictEqual(Fable.combat.damageExpression(sc,false),'1d6+2');
      assert.strictEqual(Fable.combat.damageExpression(sc,true),'1d6+2+1d4');
      const plain=Fable.dice.stats(Fable.combat.damageExpression(sc,false)),adv=Fable.dice.stats(Fable.combat.damageExpression(sc,true));
      assert.strictEqual(plain.average,5.5);assert.strictEqual(adv.average,8);
      assert.strictEqual(Fable.dice.stats(Fable.combat.damageExpression(sc,true),{crit:true}).max,2*(6+4)+2);
    });
    test('in a fight the rider is added with Advantage and not otherwise',async()=>{
      const C=await world();
      let {s,h,w}=setup(C);
      h.hp.current=h.hp.max=200;
      rig(s,[d20(15),.999,.999,.999]);
      const r=Fable.combat.attack(s,w,'scimitar:melee',h);
      assert.ok(r.ok&&r.hit,JSON.stringify(r));
      assert.strictEqual(r.roll.mode,'normal');
      assert.strictEqual(r.damage.expression||r.expression,'1d6+2');
      /* a prone target gives melee Advantage */
      ({s,h,w}=setup(C));h.hp.current=h.hp.max=200;
      Fable.status.add(s,h,{id:'prone'});
      rig(s,[d20(15),d20(15),.999,.999,.999]);
      const r2=Fable.combat.attack(s,w,'scimitar:melee',h);
      assert.ok(r2.ok&&r2.hit,JSON.stringify(r2));
      assert.strictEqual(r2.roll.mode,'advantage');
      assert.strictEqual(r2.damage.expression||r2.expression,'1d6+2+1d4');
    });
    test('the preview shows the rider only when the roll would have Advantage',async()=>{
      const C=await world();
      let {s,h,w}=setup(C);
      const sc=w.attacks.find(a=>a.id==='scimitar:melee');
      assert.strictEqual(Fable.combat.previewAttack(s,w,sc,h).damage.expression,'1d6+2');
      Fable.status.add(s,h,{id:'prone'});
      assert.strictEqual(Fable.combat.previewAttack(s,w,sc,h).damage.expression,'1d6+2+1d4');
    });
    test('the generator can field warriors, alone or with minions, and stays inside the budget',async()=>{
      const C=await world();
      H.runFile('js/rules/encounter-gen.js');
      const MAP={id:'forest-clearing',name:'Forest Clearing',environments:['forest','grassland'],enemySpawns:[{id:'path-ambush',x:50,z:130,w:48,d:36}]};
      const seen={};
      ['low','moderate','high'].forEach(d=>{for(let seed=1;seed<=40;seed++){
        const r=Fable.encounterGen.generate({levels:[1],difficulty:d,seed,maps:[MAP],monsters:C.monsters.list()});
        assert.ok(r.ok,d+seed);assert.ok(r.meta.spent<=r.meta.budget);
        r.encounter.enemies.forEach(g=>{seen[g.monster]=(seen[g.monster]||0)+g.count;assert.ok(C.monsters.get(g.monster))});
      }});
      assert.ok(seen['goblin-warrior']>0,'warriors appear: '+JSON.stringify(seen));
      assert.ok(seen['goblin-minion']>0,'minions still appear: '+JSON.stringify(seen));
    });
    test('the presentation covers every attack and the weapons are drawn from its equipment',async()=>{
      const C=await world(),d=C.monsters.get('goblin-warrior');
      const p=C.presentationProfiles.get('goblin-warrior');
      assert.ok(p&&p.blocks&&p.attacks['item:scimitar']&&p.attacks['item:shortbow']);
      assert.strictEqual(p.attacks['item:shortbow'].wield,'shortbow');
      assert.ok(Fable.anim.eventTime(C.animations.get(p.attacks['item:shortbow'].clip),'release')>0);
      assert.ok(C.barks.list().some(b=>b.profile==='goblin-warrior'));
      ['js/engine/gear-models.js','js/engine/equipment.js'].forEach(f=>H.runFile(f));
      const v=Fable.equipmentVisualsFor(d);
      assert.strictEqual(v.worn.mainhand.item,'scimitar');assert.strictEqual(v.worn.offhand.item,'shield');
      assert.deepStrictEqual(v.stowed.map(x=>x.item),['shortbow']);
      assert.strictEqual(v.worn.offhand.palette.rim,0x4a4f58,'the warrior shield has its own colours');
      const w=Fable.equipmentVisualsFor(d,{mainhand:'shortbow'});
      assert.strictEqual(w.worn.mainhand.item,'shortbow');assert.deepStrictEqual(w.stowed.map(x=>x.item),['scimitar']);
    });
    test('the planner takes the weapon in hand first and lets a warrior use its shield',async()=>{
      const C=await world();
      const {s,h,w}=setup(C);
      const info=id=>{const c=id==='hero'?h:w;return {id,team:c.team,kind:c.kind,name:c.name,defId:c.defId,hpMax:c.hp.max,hpNow:c.hp.current,x:0,z:0,profile:C.presentationProfiles.get(c.kind==='hero'?'human-fighter':'goblin-warrior')}};
      const P=Fable.createPlanner({who:info,clip:id=>C.animations.get(id),rng:()=>.1});
      const bow=w.attacks.find(a=>a.id==='shortbow:ranged');
      const tl=P.attack({attacker:{id:w.id},target:{id:h.id},attack:{id:bow.id,mode:'ranged',item:'shortbow',damageType:'piercing'},hit:false,crit:false,roll:{natural:3},damage:null});
      const cue=tl.cues.find(c=>c.name==='wield');
      assert.ok(cue&&cue.item==='shortbow'&&cue.essential);
    });
  });
};
