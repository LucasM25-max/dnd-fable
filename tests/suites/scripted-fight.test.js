'use strict';
const assert=require('assert'),H=require('../harness');

/* The tutorial's scripted pieces of the rules layer: a forced initiative order and fixed dice plans. Both only take effect when the
   tutorial asks for them; an ordinary fight never passes them. */
async function setup(seed,resources){
  const C=await H.loadData({monsters:true,heroes:true});
  let build=C.characters.get('human-fighter').build;
  if(resources)build=Object.assign({},build,{resources:Object.assign({},build.resources,resources)});
  const hero=Fable.creature.fromSheet(Fable.character.compute(build),{id:'hero',build});
  const a=Fable.creature.fromMonster(C.monsters.get('goblin-minion'),{index:0,id:'goblin-minion-1'});
  const b=Fable.creature.fromMonster(C.monsters.get('goblin-minion'),{index:1,id:'goblin-minion-2'});
  const s=Fable.combat.create({grid:Fable.grid.create({cols:20,rows:20}),seed:seed,creatures:[hero,a,b]});
  Fable.combat.place(s,hero,{c:5,r:5});Fable.combat.place(s,a,{c:6,r:5});Fable.combat.place(s,b,{c:6,r:6});
  return {s,hero,a,b};
}
module.exports=function(t){
  const {suite,test}=t;
  suite('scripted fight (tutorial rules hooks)',()=>{
    test('start({order}) hands out the rolled totals in the fixed order, whatever the seed',async()=>{
      for(const seed of [1,2,3,7,11,99]){
        const {s}=await setup(seed);
        Fable.combat.start(s,{order:['hero','goblin-minion-1','goblin-minion-2']});
        assert.deepStrictEqual(s.order,['hero','goblin-minion-1','goblin-minion-2'],'seed '+seed);
        const tot=s.initiativeRolls.map(r=>r.total);
        assert.deepStrictEqual(tot.slice().sort((x,y)=>y-x),tot,'totals stay in descending order');
        assert.ok(s.initiativeRolls.every(r=>r.forced));
        assert.strictEqual(Fable.combat.active(s).id,'hero');
      }
    });
    test('an order that misses or repeats a creature is refused',async()=>{
      const {s}=await setup(1);
      assert.throws(()=>Fable.combat.start(s,{order:['hero','goblin-minion-1']}),/every creature once/);
      const {s:s2}=await setup(1);
      assert.throws(()=>Fable.combat.start(s2,{order:['hero','hero','goblin-minion-1']}),/every creature once/);
    });
    test('without opts.order the start is unchanged and seeded',async()=>{
      const a=await setup(5),b=await setup(5);
      Fable.combat.start(a.s);Fable.combat.start(b.s);
      assert.deepStrictEqual(a.s.order,b.s.order);
      assert.ok(a.s.initiativeRolls.every(r=>!r.forced));
    });
    test('scriptedRng hands out the faces as the dice would roll them, then falls back',()=>{
      const r=Fable.combat.scriptedRng([[17,20],[1,8],[8,8]],()=>.5);
      assert.strictEqual(Fable.dice.roll('1d20',r).total,17);
      assert.strictEqual(Fable.dice.roll('1d8',r).total,1);
      assert.strictEqual(Fable.dice.roll('1d8',r).total,8);
      assert.strictEqual(Fable.dice.roll('1d20',r).total,11,'the fallback takes over');
    });
    test('a fixed plan sets the d20 and the damage of the next attack, and the rules still decide hit and damage',async()=>{
      const {s,hero,a}=await setup(4);
      Fable.combat.start(s,{order:['hero','goblin-minion-1','goblin-minion-2']});
      s.fixed=[{d20:3,damage:{sides:8,faces:[8]}},{d20:15,damage:{sides:8,faces:[5,2]}}];
      let b=Fable.combat.beginAttack(s,hero,'longsword:melee',a);
      assert.ok(b.ok,b.reason);assert.strictEqual(b.pending.roll.natural,3);
      let r=Fable.combat.completeAttack(s,b.pending,{});
      assert.strictEqual(r.hit,false,'3 plus the bonus is under AC 12');
      assert.strictEqual(r.damage,null);
      assert.strictEqual(s.fixed.length,1);
      /* the next turn: pretend the economy is fresh */
      hero.economy.action=false;hero.economy.attackAction=false;hero.economy.attacksUsed=0;
      b=Fable.combat.beginAttack(s,hero,'longsword:melee',a);
      assert.strictEqual(b.pending.roll.natural,15);
      r=Fable.combat.completeAttack(s,b.pending,{});
      assert.strictEqual(r.hit,true);
      assert.ok(r.damage.total>=5,'at least the 5 faced die plus modifier, or the Savage Attacker higher');
      assert.strictEqual(s.fixed.length,0);
    });
    test('a fixed reroll face replaces the d20 when Heroic Inspiration is spent',async()=>{
      const {s,hero,a}=await setup(4,{'heroic-inspiration':1});
      Fable.combat.start(s,{order:['hero','goblin-minion-1','goblin-minion-2']});
      s.fixed=[{d20:2,reroll:16,damage:{sides:8,faces:[4]}}];
      const b=Fable.combat.beginAttack(s,hero,'longsword:melee',a);
      assert.ok(b.pending.canReroll);
      const rr=Fable.combat.applyReroll(s,b.pending);
      assert.ok(rr.ok);assert.strictEqual(b.pending.roll.natural,16);
      assert.strictEqual(b.pending.roll.rerolled.from,2);
    });
    test('a list of d20 faces fixes both dice of a roll that has Disadvantage',async()=>{
      const {s,hero,a}=await setup(4);
      Fable.combat.start(s,{order:['hero','goblin-minion-1','goblin-minion-2']});
      Fable.combat.endTurn(s);
      Fable.status.add(s,a,{id:'sapped',name:'Sapped',kind:'condition',duration:{type:'turns',turns:1}});
      s.fixed=[{d20:[18,17],damage:{sides:4,faces:[3]}}];
      const r=Fable.combat.attack(s,a,'dagger:melee',hero,{noReroll:true});
      assert.deepStrictEqual(r.roll.rolls,[18,17]);
    });
    test('reactions never consume a fixed plan',async()=>{
      const {s,hero,a}=await setup(4);
      Fable.combat.start(s);
      s.fixed=[{d20:20}];
      const b=Fable.combat.beginAttack(s,hero,'longsword:melee',a,{reaction:true});
      if(b.ok)assert.strictEqual(s.fixed.length,1);
    });
  });
};
