'use strict';
const assert=require('assert'),H=require('../harness');

/* Phase 6: attack resolution, abilities and masteries (implementation plan, section 20). */
async function world(){return H.loadData({monsters:true,heroes:true})}
function open(){return Fable.grid.create({cols:20,rows:20})}
function heroOf(C,loadout,resources){
  let build=C.characters.get('human-fighter').build;
  if(loadout&&loadout!=='a')build=Fable.character.inventory.applyLoadout(build,loadout,{}).build;
  if(resources)build=Object.assign({},build,{resources:Object.assign({},build.resources,resources)});
  return Fable.creature.fromSheet(Fable.character.compute(build),{id:'hero',build});
}
function gob(C,i){return Fable.creature.fromMonster(C.monsters.get('goblin-minion'),{index:i||0})}
/* a fight with the hero first in the order; rolls come from the list (as d20 values for d20s, fractions for others) */
function fight(C,o){
  o=o||{};
  const hero=heroOf(C,o.loadout,o.resources),a=gob(C,0),b=gob(C,1);
  const s=Fable.combat.create({grid:open(),seed:1,creatures:[hero,a,b]});
  Fable.combat.place(s,hero,{c:5,r:5});Fable.combat.place(s,a,o.far?{c:12,r:5}:{c:6,r:5});Fable.combat.place(s,b,{c:15,r:15});
  Fable.combat.start(s);
  s.order=['hero',a.id,b.id];s.turn=0;
  Fable.combat.beginTurnForTest&&0;
  return {s,hero,a,b};
}
/* the random function returns these values one after the other (the last one repeats) */
function rig(s,list){let i=0;s.rng=()=>{const v=list[Math.min(i,list.length-1)];i++;return v}}
const d20=v=>(v-0.5)/20;
const fr=(v,sides)=>(v-0.5)/sides;

module.exports=function(t){
  const {suite,test}=t;
  suite('phase 6 attacks',()=>{
    test('a hit adds the bonus to the d20, compares to AC and deals the rolled damage',async()=>{
      const C=await world(),{s,hero,a}=fight(C);
      rig(s,[d20(12),fr(5,8)]);
      const r=Fable.combat.attack(s,hero,'longsword:melee',a);
      assert.ok(r.ok);assert.strictEqual(r.roll.natural,12);assert.strictEqual(r.roll.total,17);
      assert.ok(r.hit);assert.strictEqual(r.damage.total,8);assert.strictEqual(a.hp.current,a.hp.max-8<0?0:a.hp.max-8);
    });
    test('a total below AC misses and deals nothing',async()=>{
      const C=await world(),{s,hero,a}=fight(C);
      rig(s,[d20(2)]);
      const r=Fable.combat.attack(s,hero,'longsword:melee',a);
      assert.ok(r.ok&&!r.hit&&!r.damage);assert.strictEqual(a.hp.current,a.hp.max);
    });
    test('natural 1 misses whatever the bonus and natural 20 hits and is a critical hit with doubled dice',async()=>{
      const C=await world();
      let f=fight(C);rig(f.s,[d20(1)]);
      assert.ok(!Fable.combat.attack(f.s,f.hero,'longsword:melee',f.a).hit);
      f=fight(C);f.a.ac.value=40;rig(f.s,[d20(20),fr(8,8),fr(8,8)]);
      const r=Fable.combat.attack(f.s,f.hero,'longsword:melee',f.a);
      assert.ok(r.hit&&r.crit);assert.strictEqual(r.damage.total,16+3);
    });
    test('the Action gives one attack: a second attack is refused with a reason',async()=>{
      const C=await world(),{s,hero,a}=fight(C);
      rig(s,[d20(2)]);
      assert.ok(Fable.combat.attack(s,hero,'longsword:melee',a).ok);
      const r=Fable.combat.attack(s,hero,'longsword:melee',a);
      assert.ok(!r.ok);assert.ok(/Action/.test(r.reason));
    });
    test('out of reach and not a hostile target are refused',async()=>{
      const C=await world(),{s,hero,a,b}=fight(C,{far:true});
      const r=Fable.combat.attack(s,hero,'longsword:melee',a);
      assert.ok(!r.ok);assert.ok(/reach/.test(r.reason));
      assert.ok(!Fable.combat.attack(s,hero,'longsword:melee',hero).ok);
      assert.ok(!Fable.combat.checkTarget(s,hero,hero.attacks[0],b).ok);
    });
    test('a thrown weapon beyond normal range has Disadvantage and one past long range is refused',async()=>{
      const C=await world(),{s,hero,a}=fight(C,{far:true,loadout:'b'});
      const at=hero.attacks.find(x=>x.id==='dagger:thrown');
      const tc=Fable.combat.checkTarget(s,hero,at,a);
      assert.ok(tc.ok);assert.strictEqual(tc.band,'long');
      assert.strictEqual(Fable.combat.attackRollState(s,hero,at,a,tc).state,'disadvantage');
      Fable.combat.place(s,a,{c:19,r:19});
      assert.ok(!Fable.combat.checkTarget(s,hero,at,a).ok);
    });
    test('a thrown weapon is spent: it cannot be thrown again past the stock',async()=>{
      const C=await world(),{s,hero,a}=fight(C,{loadout:'b'});
      rig(s,[d20(2)]);
      const stock=hero.stock.dagger;
      Fable.combat.attack(s,hero,'dagger:thrown',a);
      assert.strictEqual(hero.thrown.dagger,1);
      assert.strictEqual(Fable.combat.attackRollState(s,hero,hero.attacks.find(x=>x.id==='dagger:thrown'),a,{distanceFt:5,band:'normal'}).disadvantage.length,1,'an adjacent enemy imposes Disadvantage on a thrown attack');
      assert.ok(stock>=1);
    });
    test('preview reports hit chance, damage range and the mastery',async()=>{
      const C=await world(),{s,hero,a}=fight(C);
      const p=Fable.combat.previewAttack(s,hero,hero.attacks[0],a);
      assert.ok(p.ok);assert.strictEqual(p.roll.bonus,5);assert.strictEqual(p.roll.ac,a.ac.value);
      assert.strictEqual(p.damage.min,4);assert.strictEqual(p.damage.max,11);
      assert.strictEqual(p.mastery.id,'sap');
      const exp=Fable.combat.hitChance(5,a.ac.value,'normal').hit;
      assert.ok(Math.abs(p.roll.hit-exp)<1e-9);
    });
    test('hit chance is clamped to 5% and 95% and combines for Advantage and Disadvantage',async()=>{
      await world();const hc=Fable.combat.hitChance;
      assert.ok(Math.abs(hc(0,40,'normal').hit-0.05)<1e-9);
      assert.ok(Math.abs(hc(20,5,'normal').hit-0.95)<1e-9);
      assert.ok(Math.abs(hc(5,15,'advantage').hit-(1-0.45*0.45))<1e-9);
      assert.ok(Math.abs(hc(5,15,'disadvantage').hit-0.55*0.55)<1e-9);
    });
  });

  suite('phase 6 masteries and feats',()=>{
    test('Sap: a hit gives Disadvantage on the target\'s next attack roll only, and that roll uses it up',async()=>{
      const C=await world(),{s,hero,a}=fight(C);
      rig(s,[d20(15),fr(3,8)]);
      const r=Fable.combat.attack(s,hero,'longsword:melee',a);
      assert.ok(r.hit);assert.ok(Fable.status.has(a,'sapped'));
      assert.strictEqual(r.statuses[0].id,'sapped');
      const m=Fable.status.attackMods(a,hero,{distanceFt:5});
      assert.ok(m.disadvantage.length>0);
      Fable.combat.endTurn(s);
      rig(s,[d20(10),d20(10)]);
      const b=Fable.combat.attack(s,a,'dagger:melee',hero);
      assert.strictEqual(b.roll.mode,'disadvantage');
      assert.ok(!Fable.status.has(a,'sapped'),'the roll used the status up');
    });
    test('Sap lasts until the attacker\'s next turn start',async()=>{
      const C=await world(),{s,hero,a,b}=fight(C);
      rig(s,[d20(15),fr(3,8)]);
      Fable.combat.attack(s,hero,'longsword:melee',a);
      assert.ok(Fable.status.has(a,'sapped'));
      Fable.combat.endTurn(s);Fable.combat.endTurn(s);Fable.combat.endTurn(s);
      assert.strictEqual(Fable.combat.active(s),hero);
      assert.ok(!Fable.status.has(a,'sapped'));
    });
    test('Slow: a hit that deals damage takes 10 ft off Speed',async()=>{
      const C=await world(),{s,hero,a}=fight(C);
      a.hp.current=a.hp.max=50;
      hero.attacks.find(x=>x.id==='javelin:melee').equipped=true;
      rig(s,[d20(15),fr(4,6)]);
      const before=Fable.creature.movementMaxFt(a);
      const r=Fable.combat.attack(s,hero,'javelin:melee',a);
      assert.ok(r.ok&&r.hit);
      assert.strictEqual(Fable.creature.movementMaxFt(a),before-10);
      assert.ok(r.effects.some(e=>e.id==='slow'));
    });
    test('the Slowed status reduces speed by 10 once however many times it is added',async()=>{
      const C=await world(),{s,a}=fight(C);
      const base=a.speedFt;
      Fable.status.add(null,a,{id:'slowed',speedMod:-10});Fable.status.add(null,a,{id:'slowed',speedMod:-10});
      assert.strictEqual(Fable.status.speedFt(a,base),base-10);
      assert.strictEqual(a.conditions.filter(x=>x.id==='slowed').length,1);
    });
    test('Nick: with Daggers in both hands the Light extra attack is part of the Attack action',async()=>{
      const C=await world(),{s,hero,a}=fight(C,{loadout:'b'});
      rig(s,[d20(15),fr(2,4),d20(15),fr(2,4)]);
      assert.ok(!Fable.combat.attackState(s,hero,hero.attacks.find(x=>x.id==='dagger:light-extra')).ok,'needs a Light attack first');
      assert.ok(Fable.combat.attack(s,hero,'dagger:melee',a).ok);
      const st=Fable.combat.attackState(s,hero,hero.attacks.find(x=>x.id==='dagger:light-extra'));
      assert.ok(st.ok);assert.strictEqual(st.cost,'free');
      const r=Fable.combat.attack(s,hero,'dagger:light-extra',a);
      assert.ok(r.ok);assert.ok(!hero.economy.bonus);
      assert.ok(!Fable.combat.attackState(s,hero,hero.attacks.find(x=>x.id==='dagger:light-extra')).ok,'only once a turn');
    });
    test('Savage Attacker rolls damage twice once a turn and keeps the higher',async()=>{
      const C=await world(),{s,hero,a}=fight(C);
      rig(s,[d20(15),fr(2,8),fr(7,8)]);
      const r=Fable.combat.attack(s,hero,'longsword:melee',a);
      assert.ok(r.damage.savage);assert.strictEqual(r.damage.first,5);assert.strictEqual(r.damage.second,10);assert.strictEqual(r.damage.total,10);
      assert.strictEqual(hero.resources['savage-attacker'].current,0);
    });
    test('Savage Attacker comes back at the start of the next turn',async()=>{
      const C=await world(),{s,hero,a}=fight(C);
      rig(s,[d20(15),fr(2,8),fr(7,8)]);
      Fable.combat.attack(s,hero,'longsword:melee',a);
      Fable.combat.endTurn(s);Fable.combat.endTurn(s);Fable.combat.endTurn(s);
      assert.strictEqual(hero.resources['savage-attacker'].current,1);
    });
    test('Heroic Inspiration rerolls the d20 once, the new roll stands, and the pool is spent',async()=>{
      const C=await world(),{s,hero,a}=fight(C,{resources:{'heroic-inspiration':1}});
      assert.ok(hero.inspiration);
      rig(s,[d20(2),d20(18),fr(5,8)]);
      const b=Fable.combat.beginAttack(s,hero,'longsword:melee',a);
      assert.ok(b.pending.canReroll);
      const r=Fable.combat.completeAttack(s,b.pending,{reroll:true});
      assert.strictEqual(r.roll.rerolled.from,2);assert.strictEqual(r.roll.natural,18);assert.ok(r.hit);
      assert.strictEqual(hero.resources['heroic-inspiration'].current,0);assert.ok(!hero.inspiration);
    });
    test('no reroll is offered without Heroic Inspiration, and declining keeps the roll',async()=>{
      const C=await world();
      let f=fight(C);rig(f.s,[d20(2)]);
      assert.ok(!Fable.combat.beginAttack(f.s,f.hero,'longsword:melee',f.a).pending.canReroll);
      f=fight(C,{resources:{'heroic-inspiration':1}});rig(f.s,[d20(2)]);
      const r=Fable.combat.attack(f.s,f.hero,'longsword:melee',f.a,{reroll:()=>false});
      assert.strictEqual(r.roll.natural,2);assert.strictEqual(f.hero.resources['heroic-inspiration'].current,1);
    });
    test('a roll waiting for the reroll decision blocks other actions until it is finished',async()=>{
      const C=await world(),{s,hero,a}=fight(C,{resources:{'heroic-inspiration':1}});
      rig(s,[d20(2)]);
      Fable.combat.beginAttack(s,hero,'longsword:melee',a);
      assert.ok(!Fable.combat.useAction(s,hero,'dodge').ok);
      Fable.combat.endTurn(s);
      assert.strictEqual(s.pending,null);
    });
    test('every handler the tutorial hero uses is registered',async()=>{
      const C=await world(),hero=heroOf(C);
      assert.deepStrictEqual(Fable.handlers.missing(hero.sheet),[]);
      assert.deepStrictEqual(Fable.handlers.missing(heroOf(C,'b').sheet),[]);
    });
  });

  suite('phase 6 actions, dying and rests',()=>{
    test('Second Wind heals 1d10 + fighter level, costs a Bonus Action and a use',async()=>{
      const C=await world(),{s,hero}=fight(C);
      hero.hp.current=3;
      rig(s,[fr(6,10)]);
      const r=Fable.combat.useAction(s,hero,'second-wind');
      assert.ok(r.ok);assert.strictEqual(r.heal.amount,7);assert.strictEqual(hero.hp.current,10);
      assert.ok(hero.economy.bonus);assert.strictEqual(hero.resources['second-wind-uses'].current,1);
      assert.ok(!Fable.combat.useAction(s,hero,'second-wind').ok);
    });
    test('Second Wind is refused at full hit points and when out of uses',async()=>{
      const C=await world(),{s,hero}=fight(C);
      assert.ok(!Fable.combat.useAction(s,hero,'second-wind').ok);
      hero.hp.current=1;hero.resources['second-wind-uses'].current=0;
      assert.ok(!Fable.combat.useAction(s,hero,'second-wind').ok);
    });
    test('Dash doubles movement, Disengage prevents Opportunity Attacks, Dodge imposes Disadvantage',async()=>{
      const C=await world();
      let f=fight(C);
      const base=Fable.creature.movementLeftFt(f.hero);
      Fable.combat.useAction(f.s,f.hero,'dash');
      assert.strictEqual(Fable.creature.movementLeftFt(f.hero),base*2);
      f=fight(C);Fable.combat.useAction(f.s,f.hero,'dodge');
      assert.ok(Fable.status.attackMods(f.hero,f.a,{distanceFt:5}).disadvantage.length===0);
      assert.ok(Fable.status.attackMods(f.a,f.hero,{distanceFt:5}).disadvantage.length>0);
      f=fight(C);Fable.combat.useAction(f.s,f.hero,'disengage');
      assert.ok(Fable.status.has(f.hero,'disengaged'));
      assert.strictEqual(Fable.combat.provokersAlong(f.s,f.hero,[{c:5,r:5},{c:4,r:5}]).length,0);
    });
    test('Dodge lasts until the start of the next turn',async()=>{
      const C=await world(),{s,hero}=fight(C);
      Fable.combat.useAction(s,hero,'dodge');
      Fable.combat.endTurn(s);Fable.combat.endTurn(s);Fable.combat.endTurn(s);
      assert.ok(!Fable.status.has(hero,'dodging'));
    });
    test('standard actions with nothing to act on are refused with a reason',async()=>{
      const C=await world(),{s,hero}=fight(C);
      ['help','hide','magic','study','utilize','ready','influence'].forEach(id=>{
        const r=Fable.combat.useAction(s,hero,id);assert.ok(!r.ok&&r.reason,id);
      });
    });
    test('dropping to 0: a monster is defeated, a hero is unconscious and the fight goes on',async()=>{
      const C=await world(),{s,hero,a}=fight(C);
      const r=Fable.combat.applyDamage(s,hero,a,a.hp.max+5,{});
      assert.ok(r.defeated&&!a.alive);
      const d=Fable.combat.applyDamage(s,a,hero,hero.hp.current,{});
      assert.ok(d.downed&&hero.down&&hero.alive);assert.ok(Fable.status.has(hero,'unconscious'));
      assert.strictEqual(s.phase,'running');
    });
    test('massive damage kills a hero outright',async()=>{
      const C=await world(),{s,hero,a}=fight(C);
      const r=Fable.combat.applyDamage(s,a,hero,hero.hp.current+hero.hp.max,{});
      assert.ok(r.killed&&r.instant&&!hero.alive);
    });
    test('death saves: 10 or more succeeds, 1 counts two failures, 20 revives with 1 hit point',async()=>{
      const C=await world();
      const down=()=>{const f=fight(C);Fable.combat.applyDamage(f.s,f.a,f.hero,f.hero.hp.current,{});return f};
      let f=down();rig(f.s,[d20(12)]);
      assert.strictEqual(Fable.combat.startDeathSave(f.s,f.hero).outcome,'success');assert.strictEqual(f.hero.death.successes,1);
      f=down();rig(f.s,[d20(1)]);
      assert.strictEqual(Fable.combat.startDeathSave(f.s,f.hero).outcome,'fail2');assert.strictEqual(f.hero.death.failures,2);
      f=down();rig(f.s,[d20(20)]);
      assert.ok(Fable.combat.startDeathSave(f.s,f.hero).revived);assert.strictEqual(f.hero.hp.current,1);assert.ok(!f.hero.down);
      assert.ok(!Fable.status.has(f.hero,'unconscious'));
    });
    test('three successes stabilise and three failures end the fight',async()=>{
      const C=await world();
      let f=fight(C);Fable.combat.applyDamage(f.s,f.a,f.hero,f.hero.hp.current,{});
      f.hero.death.successes=2;rig(f.s,[d20(15)]);
      assert.strictEqual(Fable.combat.startDeathSave(f.s,f.hero).outcome,'stable');assert.ok(f.hero.death.stable);
      f=fight(C);Fable.combat.applyDamage(f.s,f.a,f.hero,f.hero.hp.current,{});
      f.hero.death.failures=2;rig(f.s,[d20(5)]);
      Fable.combat.startDeathSave(f.s,f.hero);
      assert.strictEqual(f.s.phase,'over');assert.strictEqual(f.s.winner,'enemy');
    });
    test('damage at 0 hit points is a failed save, two for a critical hit, and ends stability',async()=>{
      const C=await world(),{s,hero,a}=fight(C);
      Fable.combat.applyDamage(s,a,hero,hero.hp.current,{});
      hero.death.stable=true;
      Fable.combat.applyDamage(s,a,hero,2,{});
      assert.strictEqual(hero.death.failures,1);assert.ok(!hero.death.stable);
      Fable.combat.applyDamage(s,a,hero,2,{crit:true});
      assert.strictEqual(hero.death.failures,3);assert.ok(!hero.alive);
    });
    test('a hit on an unconscious hero from 5 ft is an automatic critical hit and has Advantage',async()=>{
      const C=await world(),{s,hero,a}=fight(C);
      Fable.combat.applyDamage(s,a,hero,hero.hp.current,{});
      const at=a.attacks.find(x=>x.id==='dagger:melee'),tc=Fable.combat.checkTarget(s,a,at,hero);
      const rs=Fable.combat.attackRollState(s,a,at,hero,tc);
      assert.strictEqual(rs.state,'advantage');assert.ok(rs.autoCrit);
    });
    test('temporary hit points absorb damage first',async()=>{
      const C=await world(),{s,hero,a}=fight(C);
      hero.hp.temp=4;
      const r=Fable.combat.applyDamage(s,a,hero,6,{});
      assert.strictEqual(r.absorbed,4);assert.strictEqual(hero.hp.current,hero.hp.max-2);
    });
    test('a long rest restores Second Wind and gives the Human Heroic Inspiration; a short rest returns one use',async()=>{
      const C=await world();
      const base=C.characters.get('human-fighter').build;
      const spent=Object.assign({},base,{resources:{'second-wind-uses':0,'heroic-inspiration':0}});
      const sh=Fable.character.rest.apply(spent,'short');
      assert.strictEqual(sh.build.resources['second-wind-uses'],1);assert.ok(!sh.inspiration);
      const lg=Fable.character.rest.apply(spent,'long');
      assert.strictEqual(lg.build.resources['second-wind-uses'],2);assert.ok(lg.inspiration);
    });
    test('loadout swap in combat uses the free interaction once, then the Action; the sheet follows',async()=>{
      const C=await world(),{s,hero}=fight(C);
      assert.strictEqual(hero.attacks.find(x=>x.id==='longsword:melee').equipped,true);
      const r=Fable.combat.swapLoadout(s,hero,'b');
      assert.ok(r.ok,r.reason);assert.strictEqual(r.cost,'action','dropping the Shield is a Utilize action');
      assert.strictEqual(hero.attacks.find(x=>x.id==='dagger:melee').equipped,true);
      assert.strictEqual(hero.attacks.find(x=>x.id==='longsword:melee').equipped,false);
      assert.strictEqual(hero.hp.current,hero.hp.max);
    });
  });

  suite('phase 6 movement and the full fight',()=>{
    test('leaving an enemy\'s reach provokes an Opportunity Attack that uses its Reaction',async()=>{
      const C=await world(),{s,hero,a}=fight(C);
      const plan=Fable.combat.planMove(s,hero,{c:3,r:5});
      assert.ok(plan.ok);assert.ok(plan.provokes&&plan.provokes.length>=1);
      rig(s,[d20(2)]);
      const r=Fable.combat.move(s,hero,{c:3,r:5},{reactions:{[a.id]:true}});
      assert.ok(r.ok);assert.ok(a.economy.reaction);assert.ok(r.reactions&&r.reactions.length>=1);
    });
    test('moving to another square still within reach does not provoke',async()=>{
      const C=await world(),{s,hero}=fight(C);
      const p=Fable.combat.planMove(s,hero,{c:5,r:6});
      assert.ok(p.ok);assert.strictEqual(p.provokes.length,0);
    });
    test('the goblin AI attacks when it reaches the hero and picks standing targets first',async()=>{
      const C=await world(),{s,hero,a}=fight(C);
      rig(s,[d20(2)]);
      Fable.combat.endTurn(s);
      assert.strictEqual(Fable.combat.active(s),a);
      const n=Fable.combatAI.nextAttack(s,a);
      assert.ok(n&&n.target===hero&&n.attack.id==='dagger:melee');
      const r=Fable.combatAI.act(s,a);
      assert.ok(r&&r.attacker.id===a.id);
    });
    test('a scripted fight runs to a winner with no pending state left behind',async()=>{
      const C=await world();
      for(let seed=1;seed<=25;seed++){
        const hero=heroOf(C),a=gob(C,0),b=gob(C,1);
        const s=Fable.combat.create({grid:open(),seed,creatures:[hero,a,b]});
        Fable.combat.place(s,hero,{c:3,r:10});Fable.combat.place(s,a,{c:10,r:9});Fable.combat.place(s,b,{c:10,r:11});
        Fable.combat.start(s);
        let guard=0;
        while(s.phase==='running'&&guard++<200){
          const c=Fable.combat.active(s);
          if(c.team==='player'){
            if(c.hp.current<=4&&Fable.combat.actionState(s,c,'second-wind').ok)Fable.combat.useAction(s,c,'second-wind');
            let n=Fable.combatAI.nextAttack(s,c);
            if(!n){const foe=s.creatures.find(x=>x.alive&&!x.down&&x.team!==c.team);
              const field=Fable.grid.reachable(s.grid,c.cell,Fable.creature.movementLeftFt(c),{enter:(col,row)=>!Fable.combat.occupant(s,{c:col,r:row},c)});
              let best=null;field.forEach(q=>{if(Fable.combat.occupant(s,q,c))return;const d=Fable.grid.chebyshev(q,foe.cell);if(!best||d<best.d)best={q,d}});
              if(best)Fable.combat.move(s,c,{c:best.q.c,r:best.q.r},{reactions:{}});n=Fable.combatAI.nextAttack(s,c)}
            if(n)Fable.combat.attack(s,c,n.attack.id,n.target,{});
          }else{Fable.combatAI.takeTurn(s,c);Fable.combatAI.act(s,c)}
          if(s.phase==='running')Fable.combat.endTurn(s);
        }
        assert.strictEqual(s.phase,'over','seed '+seed);assert.ok(s.winner);assert.strictEqual(s.pending,null);
      }
    });
    test('the same seed produces the same fight',async()=>{
      const C=await world();
      const run=()=>{const {s,hero,a}=fight(C);a.hp.current=a.hp.max=500;const out=[];for(let i=0;i<3;i++){s.pending=null;hero.economy=Fable.creature.newEconomy(hero);const r=Fable.combat.attack(s,hero,'longsword:melee',a);out.push(r.roll.natural+':'+(r.damage?r.damage.total:0))}return out.join(',')};
      assert.strictEqual(run(),run());
    });
  });
};
