'use strict';
const assert=require('assert'),H=require('../harness');

/* Phase 8 enemy AI: the scenario tests of plan section 16.8 (small hand built positions with the decisions they must lead to), plus
   determinism, tiers, information, the explain trace and plain-data planning. */
async function world(){return H.loadData({monsters:true,heroes:true})}
function open(cols,rows){return Fable.grid.create({cols:cols||24,rows:rows||24})}
function fighter(C,id){return Fable.creature.fromSheet(Fable.character.compute(C.characters.get('human-fighter').build),{id:id||'hero'})}
function goblin(C,i,eng){const g=Fable.creature.fromMonster(C.monsters.get('goblin-minion'),{index:i});if(eng!==undefined)g.ai=Object.assign({},g.ai,{engagement:eng});return g}
/* hero and goblins on a grid; every creature is placed and the fight is running with the goblin at `turn` active */
function scene(C,o){
  const g=o.grid||open();
  (o.blocked||[]).forEach(([c,r])=>Fable.grid.setBlocked(g,c,r,true));
  const hero=fighter(C);
  const gobs=(o.goblins||[{c:14,r:12}]).map((p,i)=>goblin(C,i,o.engagement));
  const s=Fable.combat.create({grid:g,seed:o.seed||5,creatures:[hero].concat(gobs)});
  Fable.combat.place(s,hero,o.hero||{c:3,r:12});
  gobs.forEach((x,i)=>Fable.combat.place(s,x,(o.goblins||[{c:14,r:12}])[i]));
  s.phase='running';s.order=s.creatures.map(c=>c.id);s.round=o.round||1;s.turn=1;
  s.creatures.forEach(c=>{c.economy=Fable.creature.newEconomy(c)});
  return {s,hero,gobs,g};
}
/* a hero with nothing to throw (so nothing outranges the goblins' daggers) */
function disarmRanged(h){h.thrown.javelin=4;h.thrown.dagger=2}
const attackSteps=p=>p.intents.filter(i=>i.t==='attack');
const stepText=p=>p.trace.chosen.steps.join(' > ');

module.exports=function(t){
  const {suite,test}=t;

  suite('phase 8 ai scenarios (plan 16.8)',()=>{
    test('throw from cover: it steps to a square with cover and throws from there, at normal range, without Disadvantage',async()=>{
      const C=await world();
      /* the hero is held in place with nothing to throw back, so the only question is where the goblin throws from */
      const {s,hero,gobs}=scene(C,{hero:{c:10,r:12},goblins:[{c:16,r:12}],blocked:[[13,11],[13,12],[13,13],[14,8],[14,16]],engagement:2});
      disarmRanged(hero);Fable.status.add(s,hero,{id:'grappled',source:{id:'grapple',name:'Grapple'}});
      const p=Fable.ai.plan(s,gobs[0],{});
      const atk=attackSteps(p)[0];
      assert.ok(atk,'it attacks: '+stepText(p));
      assert.strictEqual(atk.attack,'dagger:thrown');
      assert.strictEqual(atk.band,'normal');
      assert.notStrictEqual(atk.state,'disadvantage');
      /* it ends its turn in cover (it may throw on its way there) */
      const last=p.intents.filter(i=>i.t==='move').pop()||{to:gobs[0].cell};
      const end=last.to;
      assert.ok(atk.cover>=1||Fable.grid.coverBetween(s.grid,hero.cell,end).level>=1,'in cover: '+stepText(p));
    });

    test('hit and run: from a few squares away it closes, stabs, takes Nimble Escape (Disengage) and leaves the hero\'s reach',async()=>{
      const C=await world();
      const {s,hero,gobs}=scene(C,{hero:{c:10,r:12},goblins:[{c:13,r:12}],engagement:3});
      disarmRanged(hero);Fable.status.add(s,hero,{id:'slowed',source:{id:'mastery.slow',name:'Slow'}});
      const p=Fable.ai.plan(s,gobs[0],{});
      /* from range it can throw and run, or close and stab and run; either way it attacks and ends beyond a Slowed hero's reach */
      assert.ok(attackSteps(p).length>=1,stepText(p));
      const end=p.intents.filter(i=>i.t==='move').pop().to;
      assert.ok(Fable.grid.distanceFt(end,hero.cell)>25,stepText(p));
    });

    test('hit and run is found when adjacent: attack, Disengage as a Bonus Action, move away',async()=>{
      const C=await world();
      const {s,hero,gobs}=scene(C,{hero:{c:10,r:12},goblins:[{c:11,r:12}],engagement:3});
      disarmRanged(hero);Fable.status.add(s,hero,{id:'slowed',source:{id:'mastery.slow',name:'Slow'}});
      const p=Fable.ai.plan(s,gobs[0],{});
      const kinds=p.intents.map(i=>i.t==='attack'?'attack':i.id==='nimble-escape'?'nimble:'+i.choice:i.t);
      const a=kinds.indexOf('attack'),n=kinds.indexOf('nimble:disengage'),m=kinds.lastIndexOf('move');
      assert.ok(a>=0&&n>a&&m>n,kinds.join(' > '));
      const end=p.intents[m].to;
      assert.ok(Fable.grid.distanceFt(end,hero.cell)>25,'out of a Slowed hero\'s reach (20 ft of movement and 5 ft of reach)');
    });

    test('it does not waste attacks into Disadvantage: against a Dodging hero at long range it does something else',async()=>{
      const C=await world();
      const {s,hero,gobs}=scene(C,{hero:{c:3,r:12},goblins:[{c:20,r:12}],engagement:1});
      Fable.status.add(s,hero,{id:'dodging',source:{id:'dodge',name:'Dodge'}});
      const p=Fable.ai.plan(s,gobs[0],{});
      attackSteps(p).forEach(a=>{
        const o=Fable.aiCore.optionAt({s:s,cache:{},sig:()=>'',opponentsOf:()=>[hero]},gobs[0],Fable.combat.findAttack(gobs[0],a.attack),hero,a.from);
        assert.ok(!o||o.state!=='disadvantage','attacks only without Disadvantage: '+JSON.stringify(a));
      });
    });

    test('focus fire: the second goblin goes for the target the first one chose',async()=>{
      const C=await world();
      const {s,hero,gobs}=scene(C,{hero:{c:8,r:12},goblins:[{c:13,r:10},{c:13,r:14}],engagement:3});
      const hero2=fighter(C,'hero-2');hero2.name='Mira';
      s.creatures.push(hero2);s.byId[hero2.id]=hero2;Fable.combat.place(s,hero2,{c:8,r:16});
      s.order.push(hero2.id);hero2.economy=Fable.creature.newEconomy(hero2);
      hero.hp.current=5;
      const first=Fable.ai.plan(s,gobs[0],{});
      Fable.ai.commit(s,gobs[0],first);
      assert.ok(s.aiTeam.enemy&&s.aiTeam.enemy.focus,'the first plan sets a focus target');
      const target=s.aiTeam.enemy.focus;
      const second=Fable.ai.plan(s,gobs[1],{});
      const at=attackSteps(second)[0];
      assert.ok(at&&at.target===target,'second goblin attacks '+target+': '+stepText(second));
    });

    test('recover daggers: out of weapons and safe, it picks its daggers up',async()=>{
      const C=await world();
      const {s,gobs}=scene(C,{hero:{c:3,r:20},goblins:[{c:17,r:6}],engagement:1});
      const g=gobs[0];g.thrown.dagger=3;
      s.ground.push({id:'g1',item:'dagger',name:'Dagger',owner:g.id,cell:{c:15,r:6}},{id:'g2',item:'dagger',name:'Dagger',owner:g.id,cell:{c:15,r:7}},{id:'g3',item:'dagger',name:'Dagger',owner:g.id,cell:{c:15,r:7}});
      const p=Fable.ai.plan(s,g,{});
      assert.ok(p.intents.some(i=>i.t==='pickup'),stepText(p));
      assert.ok(p.trace.chosen.tricks.indexOf('recover-daggers')>=0);
    });

    test('recover daggers is not done under the hero\'s nose when it can fall back',async()=>{
      const C=await world();
      const {s,gobs}=scene(C,{hero:{c:8,r:6},goblins:[{c:17,r:6}],engagement:1});
      const g=gobs[0];g.thrown.dagger=3;
      s.ground.push({id:'g1',item:'dagger',name:'Dagger',owner:g.id,cell:{c:9,r:6}});
      const p=Fable.ai.plan(s,g,{});
      const moves=p.intents.filter(i=>i.t==='move');
      moves.forEach(m=>assert.ok(Fable.grid.chebyshev(m.to,{c:8,r:6})>1,'does not walk up to the hero for a dagger: '+stepText(p)));
    });

    test('morale: Bloodied with an ally down it checks, and the outcome is repeatable and sometimes a retreat',async()=>{
      const C=await world();
      const outcomes={};
      for(let seed=1;seed<=60;seed++){
        const {s,gobs}=scene(C,{hero:{c:10,r:12},goblins:[{c:14,r:12},{c:14,r:14}],seed:seed,round:2});
        gobs[1].alive=false;gobs[1].down=true;gobs[1].hp.current=0;
        gobs[0].hp.current=3;
        const p=Fable.ai.plan(s,gobs[0],{});
        const again=Fable.ai.plan(s,gobs[0],{});
        assert.deepStrictEqual(p.morale,again.morale,'same seed, same check');
        assert.ok(p.morale.length>=1&&p.morale[0].type==='morale');
        outcomes[p.morale[0].result]=(outcomes[p.morale[0].result]||0)+1;
        if(p.flee){
          assert.ok(!attackSteps(p).some(a=>a.attack==='dagger:melee'),'a fleeing goblin does not stab: '+stepText(p));
        }
      }
      assert.ok(outcomes.flee>0&&outcomes.hold>0,JSON.stringify(outcomes));
    });

    test('morale: a fleeing goblin runs for cover or away and may Hide, and the event carries the check for the barks',async()=>{
      const C=await world();
      let found=null;
      for(let seed=1;seed<=80&&!found;seed++){
        const {s,hero,gobs}=scene(C,{hero:{c:10,r:12},goblins:[{c:12,r:12}],seed:seed,round:2,blocked:[[16,12],[16,11],[16,13]]});
        gobs[0].hp.current=2;
        const p=Fable.ai.plan(s,gobs[0],{});
        if(p.flee)found={p,s,hero,g:gobs[0]};
      }
      assert.ok(found,'some seed makes it flee');
      const ev=found.p.morale[0];
      assert.ok(ev.trigger==='bloodied'&&ev.dc===10&&typeof ev.roll==='number'&&ev.result==='flee');
      const end=found.p.intents.filter(i=>i.t==='move').pop();
      if(end)assert.ok(Fable.grid.distanceFt(end.to,found.hero.cell)>=Fable.grid.distanceFt(found.g.cell,found.hero.cell),'it moves away: '+stepText(found.p));
    });

    test('respect Sap: a Sapped goblin does not stab at Disadvantage when another option is better',async()=>{
      const C=await world();
      const {s,gobs}=scene(C,{hero:{c:10,r:12},goblins:[{c:11,r:12}],engagement:1});
      Fable.status.add(s,gobs[0],{id:'sapped',source:{id:'mastery.sap',name:'Sap'}});
      const p=Fable.ai.plan(s,gobs[0],{});
      attackSteps(p).forEach(a=>{assert.notStrictEqual(a.state,'disadvantage','not at Disadvantage: '+stepText(p))});
    });

    test('respect Slow: a Slowed goblin plans moves that fit its 20 ft of movement, and a Slowed hero is a smaller threat',async()=>{
      const C=await world();
      const a=scene(C,{hero:{c:10,r:12},goblins:[{c:16,r:12}],engagement:2});
      Fable.status.add(a.s,a.gobs[0],{id:'slowed',source:{id:'mastery.slow',name:'Slow'}});
      assert.strictEqual(Fable.creature.movementLeftFt(a.gobs[0]),20);
      const p=Fable.ai.plan(a.s,a.gobs[0],{});
      const ft=p.trace.chosen.steps.length?p.intents.filter(i=>i.t==='move').reduce((m,i)=>m+i.ft,0):0;
      assert.ok(ft<=20,'moves '+ft+' ft');
      const b=scene(C,{hero:{c:10,r:12},goblins:[{c:16,r:12}],engagement:2});
      const c2=scene(C,{hero:{c:10,r:12},goblins:[{c:16,r:12}],engagement:2});
      Fable.status.add(c2.s,c2.hero,{id:'slowed',source:{id:'mastery.slow',name:'Slow'}});
      const pb=Fable.ai.plan(b.s,b.gobs[0],{}),pc=Fable.ai.plan(c2.s,c2.gobs[0],{});
      assert.ok(pc.trace.chosen.reply.expected<=pb.trace.chosen.reply.expected+1e-9||pc.trace.chosen.score>=pb.trace.chosen.score-1e-9,'a Slowed hero is no more dangerous');
    });

    test('avoid pointless risk: with a throw available it does not walk into the hero\'s reach for a poor melee attack',async()=>{
      const C=await world();
      const {s,hero,gobs}=scene(C,{hero:{c:10,r:12},goblins:[{c:16,r:12}],engagement:1});
      const p=Fable.ai.plan(s,gobs[0],{});
      p.intents.filter(i=>i.t==='move').forEach(m=>assert.ok(Fable.grid.chebyshev(m.to,hero.cell)>1,'never ends adjacent: '+stepText(p)));
      assert.ok(!attackSteps(p).some(a=>a.attack==='dagger:melee'),stepText(p));
    });
  });

  suite('phase 8 ai engine',()=>{
    test('the same position always gives the same plan (deterministic, no clock)',async()=>{
      const C=await world();
      const a=scene(C,{}),b=scene(C,{});
      const p1=Fable.ai.plan(a.s,a.gobs[0],{}),p2=Fable.ai.plan(b.s,b.gobs[0],{});
      assert.deepStrictEqual(p1.intents,p2.intents);
      assert.deepStrictEqual(p1.trace.chosen,p2.trace.chosen);
      assert.strictEqual(p1.trace.nodes,p2.trace.nodes);
    });
    test('planning changes nothing in the fight and does not move the dice',async()=>{
      const C=await world();
      const {s,hero,gobs}=scene(C,{});
      const state=s.rng.getState(),cell=JSON.stringify(gobs[0].cell),hp=hero.hp.current;
      Fable.ai.plan(s,gobs[0],{});
      assert.strictEqual(s.rng.getState(),state);assert.strictEqual(JSON.stringify(gobs[0].cell),cell);assert.strictEqual(hero.hp.current,hp);
      assert.strictEqual(gobs[0].economy.action,false);
    });
    test('a plan from serialized data equals the plan from the live fight (this is what the Web Worker runs)',async()=>{
      const C=await world();
      const {s,gobs}=scene(C,{engagement:2});
      const live=Fable.ai.plan(s,gobs[0],{});
      const data=JSON.parse(JSON.stringify({state:Fable.combat.serialize(s)}));
      /* the profile travels on the creature */
      const viaData=Fable.ai.planFromData(data.state,gobs[0].id,{});
      assert.deepStrictEqual(viaData.intents,live.intents);
    });
    test('plans are plain data that survive JSON',async()=>{
      const C=await world();
      const {s,gobs}=scene(C,{});
      const p=Fable.ai.plan(s,gobs[0],{});
      assert.deepStrictEqual(JSON.parse(JSON.stringify(p)),p);
    });
    test('tiers: Instinct searches far less and has no tricks, Mastermind searches the most',async()=>{
      const C=await world();
      const nodes={};
      ['instinct','cunning','tactician','mastermind'].forEach(tier=>{
        const {s,gobs}=scene(C,{goblins:[{c:14,r:12},{c:14,r:15}]});
        const p=Fable.ai.plan(s,gobs[0],{tier});
        nodes[tier]=p.trace.nodes;assert.strictEqual(p.tier,tier);
        if(tier==='instinct'){
          assert.deepStrictEqual(p.trace.tricks,[]);
          assert.ok(!p.intents.some(i=>i.id==='nimble-escape'||i.id==='hide'||i.id==='disengage'));
        }
      });
      assert.ok(nodes.instinct<nodes.cunning&&nodes.cunning<=nodes.tactician&&nodes.tactician<=nodes.mastermind,JSON.stringify(nodes));
    });
    test('the explain trace lists the chosen plan, its score by term and the runners up',async()=>{
      const C=await world();
      const {s,gobs}=scene(C,{engagement:3});
      const p=Fable.ai.plan(s,gobs[0],{});
      const tr=p.trace;
      assert.ok(tr.chosen&&tr.chosen.rank===1&&tr.alternatives.length>=1&&typeof tr.chosen.score==='number');
      assert.ok(tr.chosen.terms&&typeof tr.chosen.terms==='object');
      const sum=Object.keys(tr.chosen.terms).reduce((m,k)=>m+tr.chosen.terms[k],0);
      assert.ok(Math.abs(sum-tr.chosen.score)<0.06,'the terms add up to the score');
      assert.ok(tr.chosen.score>=tr.alternatives[0].score-1e-6);
      const text=Fable.ai.explain(tr);
      assert.ok(text.indexOf('Goblin Minion 1')>=0&&text.indexOf('#1')>=0);
    });
    test('fair information: the same health bar gives the same plan whatever the exact hit points',async()=>{
      const C=await world();
      const a=scene(C,{engagement:3}),b=scene(C,{engagement:3});
      a.hero.hp.current=12;b.hero.hp.current=11;
      const pa=Fable.ai.plan(a.s,a.gobs[0],{}),pb=Fable.ai.plan(b.s,b.gobs[0],{});
      assert.deepStrictEqual(pa.intents,pb.intents);
    });
    test('hidden creatures are not targeted and a goblin that cannot see anyone does not attack',async()=>{
      const C=await world();
      const {s,hero,gobs}=scene(C,{hero:{c:10,r:12},goblins:[{c:12,r:12}]});
      Fable.status.add(s,hero,{id:'hidden',source:{id:'hide',name:'Hide'},data:{stealth:25}});
      const p=Fable.ai.plan(s,gobs[0],{});
      assert.strictEqual(attackSteps(p).length,0,stepText(p));
    });
    test('takeTurn plays a whole turn through the normal rules and leaves the turn to end',async()=>{
      const C=await world();
      const {s,hero,gobs}=scene(C,{hero:{c:6,r:12},goblins:[{c:12,r:12}],engagement:3});
      const r=Fable.ai.takeTurn(s,gobs[0],{reactions:{hero:true}});
      assert.ok(r.plans.length>=1&&r.steps.length>=1);
      assert.ok(gobs[0].economy.action||gobs[0].economy.movedFt>0||gobs[0].economy.bonus);
      assert.strictEqual(s.phase,'running');
    });
    test('profiles resolve: monster fields over the content profile, the encounter over both, and a typo fails loudly',async()=>{
      const C=await world();
      const p=Fable.ai.resolveProfile({profile:'skirmisher',tier:'tactician',weights:{risk:2}},{id:'x'},{tricks:['focus-fire']});
      assert.strictEqual(p.tier,'tactician');assert.strictEqual(p.weights.risk,2);assert.strictEqual(p.weights.damage,1.0);
      assert.deepStrictEqual(p.tricks,['focus-fire']);
      assert.throws(()=>Fable.ai.resolveProfile({profile:'nope'},{id:'x'}),/does not exist/);
      assert.throws(()=>C.aiProfiles.register({id:'bad',name:'Bad',source:'original',tier:'cunning',weights:{damage:1,kill:1,risk:1,cover:1,retreatRoutes:1,resources:1,luck:3},riskAversion:.5,morale:{fleeBelowHp:.5,fleeIfAlone:true,fleeIfAllyDefeated:'check'},tricks:[]}),/luck/);
    });
  });
};
