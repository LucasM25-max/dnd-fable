'use strict';
const assert=require('assert'),H=require('../harness');

/* Phase 5: grid, stat blocks, creatures, initiative, turns, movement and the goblin turns (implementation plan, section 20). */
async function world(){return H.loadData({monsters:true,heroes:true})}
function open(cols,rows){return Fable.grid.create({cols:cols||20,rows:rows||20})}
function fighter(C,id){return Fable.creature.fromSheet(Fable.character.compute(C.characters.get('human-fighter').build),{id:id||'hero'})}
function goblin(C,i){return Fable.creature.fromMonster(C.monsters.get('goblin-minion'),{index:i})}
function fight(C,g,seed){
  const hero=fighter(C),a=goblin(C,0),b=goblin(C,1);
  const s=Fable.combat.create({grid:g||open(),seed:seed||1,creatures:[hero,a,b]});
  Fable.combat.place(s,hero,{c:2,r:10});Fable.combat.place(s,a,{c:12,r:8});Fable.combat.place(s,b,{c:12,r:12});
  return {s,hero,a,b};
}

module.exports=function(t){
  const {suite,test}=t;
  suite('phase 5 grid',()=>{
    test('a square is 5 ft and 15.24 world units, and cells map back to the same square',async()=>{
      await world();const G=Fable.grid;
      assert.strictEqual(G.FEET_PER_CELL,5);assert.ok(Math.abs(G.CELL-15.24)<1e-9);
      const g=G.create({cols:10,rows:10});
      for(const [c,r] of [[0,0],[3,7],[9,9]]){const p=G.center(g,c,r);assert.deepStrictEqual(G.cellAt(g,p.x,p.z),{c,r})}
      assert.strictEqual(G.cellAt(g,1e6,0),null);
    });
    test('diagonals cost 5 ft and distance is Chebyshev',async()=>{
      await world();const G=Fable.grid,g=open();
      assert.strictEqual(G.distanceFt({c:0,r:0},{c:4,r:4}),20);
      const p=G.findPath(g,{c:0,r:0},{c:4,r:4});
      assert.ok(p.found);assert.strictEqual(p.cost,20);assert.strictEqual(p.path.length,5);
    });
    test('difficult terrain costs double and walls block, corners are not cut',async()=>{
      await world();const G=Fable.grid,g=open(8,8);
      G.setCost(g,1,0,2);
      assert.strictEqual(G.findPath(g,{c:0,r:0},{c:2,r:0}).cost,10);
      const w=open(6,6);G.setBlocked(w,1,0,true);G.setBlocked(w,0,1,true);
      assert.ok(!G.findPath(w,{c:0,r:0},{c:1,r:1}).found);
      const w2=open(6,6);G.setBlocked(w2,1,0,true);
      assert.ok(!G.findPath(w2,{c:0,r:0},{c:1,r:1}).path.some(p=>p.c===1&&p.r===0));
      assert.strictEqual(G.findPath(w2,{c:0,r:0},{c:1,r:1}).cost,10);
    });
    test('outside the grid is blocked and reachable respects the budget',async()=>{
      await world();const G=Fable.grid,g=open(20,20);
      assert.ok(G.isBlocked(g,-1,0)&&G.isBlocked(g,0,20));
      const r=G.reachable(g,{c:10,r:10},30);
      assert.strictEqual(r.length,13*13);
      assert.ok(r.every(x=>x.ft<=30));
    });
    test('the forest map becomes a grid with its trees blocked',async()=>{
      const G=(await world(),Fable.grid);
      const g=G.fromMap({x:100,z:100},[{x0:-5,x1:5,z0:-5,z1:5,top:20},{x0:30,x1:40,z0:30,z1:40,top:1}]);
      assert.strictEqual(g.cols,Math.floor(200/G.CELL));
      assert.ok(g.blocked[Math.floor(g.rows/2)*g.cols+Math.floor(g.cols/2)]===1);
      const c=G.cellAt(g,35,35);assert.strictEqual(g.blocked[c.r*g.cols+c.c],0); // a low rock does not block
    });
  });

  suite('phase 5 stat blocks',()=>{
    test('the goblin minion stat block is valid and derives the documented numbers',async()=>{
      const C=await world(),def=C.monsters.get('goblin-minion');
      const r=Fable.statblock.check(def);
      assert.deepStrictEqual(r.errors,[]);
      const d=Fable.statblock.derive(def);
      assert.strictEqual(d.ac.value,12);assert.strictEqual(d.hp.max,7);assert.strictEqual(d.initiative.value,2);
      assert.strictEqual(d.skills.stealth.value,6);assert.strictEqual(d.passivePerception.value,9);
      assert.strictEqual(d.attacks.length,2);
      assert.strictEqual(d.attacks[0].bonus.value,4);assert.strictEqual(d.attacks[0].damage.expression,'1d4+2');
    });
    test('wrong numbers are reported by name',async()=>{
      const C=await world(),def=JSON.parse(JSON.stringify(C.monsters.get('goblin-minion')));
      def.challenge.pb=3;def.senses.passivePerception=12;def.hp.average=9;def.skills.stealth=3;
      const e=Fable.statblock.check(def).errors.join('\n');
      assert.ok(/challenge\.pb is 3/.test(e),e);assert.ok(/passivePerception/.test(e));assert.ok(/hp\.average/.test(e));assert.ok(/skills\.stealth/.test(e));
      assert.throws(()=>Fable.statblock.derive(def),/Monster "goblin-minion"/);
    });
    test('a monster an encounter spawns must have a stat block, and portraits are checked',async()=>{
      const C=await world();
      assert.strictEqual(Fable.statblock.checkPortrait(C.monsters.get('goblin-minion').portrait),null);
      assert.ok(Fable.statblock.checkPortrait({width:4,rows:['ab','..','..','..'],palette:{a:'#ffffff'}}));
      assert.ok(Fable.statblock.checkPortrait({width:4,rows:['abcd','....','....','....'],palette:{a:'#ffffff'}}));
    });
    test('feature actions may be attacks or choices, and a malformed attack is rejected by name',async()=>{
      const C=await world();
      const bad=(patch)=>{const f=JSON.parse(JSON.stringify(C.features.get('goblin-dagger')));f.id='bad-dagger';Object.assign(f.actions[0],patch);return f};
      const errs=f=>{const out=[];C.featureBody.validate(f,m=>out.push(m));return out};
      assert.deepStrictEqual(errs(C.features.get('goblin-dagger')),[]);
      assert.deepStrictEqual(errs(C.features.get('nimble-escape')),[]);
      assert.ok(errs(bad({attack:{bonus:'x',modes:[{mode:'melee'}]}})).some(m=>/attack\.bonus/.test(m)));
      assert.ok(errs(bad({attack:{bonus:4,modes:[{mode:'ranged'}]}})).some(m=>/range/.test(m)));
      assert.ok(errs(bad({hit:{damage:'1d4',type:'piercing'},attack:undefined,effects:undefined})).length>0);
    });
    test('hit points can be rolled instead of fixed when asked',async()=>{
      const C=await world(),def=C.monsters.get('goblin-minion');
      const d=Fable.statblock.derive(def,{hp:'roll',rnd:Fable.rng(3)});
      assert.ok(d.hp.max>=2&&d.hp.max<=12);
      assert.throws(()=>Fable.statblock.derive(def,{hp:'roll'}),/rnd/);
    });
  });

  suite('phase 5 combat',()=>{
    test('heroes and monsters share one creature shape',async()=>{
      const C=await world(),h=fighter(C),g=goblin(C,0);
      for(const k of ['id','name','team','ac','hp','speedFt','initiative','attacks','actions','economy','conditions'])assert.ok(k in h&&k in g,k);
      assert.strictEqual(h.team,'player');assert.strictEqual(g.team,'enemy');
      assert.strictEqual(h.speedFt,30);assert.strictEqual(h.ac.value,19);assert.strictEqual(h.initiative.value,4);
      assert.strictEqual(g.name,'Goblin Minion 1');
    });
    test('initiative: each creature rolls d20 plus its own bonus, sorted, ties are stable and deterministic',async()=>{
      const C=await world();
      const a=fight(C,open(),7),b=fight(C,open(),7);
      Fable.combat.start(a.s);Fable.combat.start(b.s);
      assert.deepStrictEqual(a.s.order,b.s.order);
      const tot=a.s.initiativeRolls.map(r=>r.total);
      assert.deepStrictEqual(tot,tot.slice().sort((x,y)=>y-x));
      a.s.initiativeRolls.forEach(r=>assert.strictEqual(r.total,r.natural+r.bonus));
      assert.strictEqual(a.s.initiativeRolls.find(r=>r.id==='hero').bonus,4);
      assert.strictEqual(a.s.phase,'running');assert.strictEqual(a.s.round,1);
      assert.strictEqual(Fable.combat.active(a.s).id,a.s.order[0]);
    });
    test('a tie goes to the higher modifier, then to the player side',async()=>{
      const C=await world(),g=open(),hero=fighter(C),gob=goblin(C,0);
      hero.initiative.value=2;
      const s=Fable.combat.create({grid:g,seed:1,creatures:[gob,hero]});
      Fable.combat.place(s,gob,{c:1,r:1});Fable.combat.place(s,hero,{c:3,r:3});
      s.rng=()=>0.5; // natural 11 for both
      Fable.combat.start(s);
      assert.strictEqual(s.order[0],'hero');
    });
    test('turns advance, rounds count up, and the action economy refreshes each turn',async()=>{
      const C=await world(),{s}=fight(C,open(),11);
      Fable.combat.start(s);
      const seen=[];Fable.combat.on(s,e=>seen.push(e.type));
      const first=Fable.combat.active(s);
      first.economy.action=true;first.economy.movedFt=15;
      Fable.combat.endTurn(s);Fable.combat.endTurn(s);Fable.combat.endTurn(s);
      assert.strictEqual(s.round,2);assert.strictEqual(Fable.combat.active(s),first);
      assert.strictEqual(first.economy.action,false);assert.strictEqual(first.economy.movedFt,0);
      assert.ok(seen.includes('round')&&seen.includes('turnstart')&&seen.includes('turnend'));
    });
    test('movement: budget, diagonals, occupied squares, denial reasons and nothing changes on a denied plan',async()=>{
      const C=await world(),{s,hero,a}=fight(C,open(),5);
      s.order=['hero',a.id,'goblin-minion-2'];s.phase='running';s.round=1;s.turn=0;hero.economy=Fable.creature.newEconomy(hero);
      const Cb=Fable.combat;
      let p=Cb.planMove(s,hero,{c:8,r:10});
      assert.ok(p.ok);assert.strictEqual(p.costFt,30);assert.strictEqual(p.afterFt,0);
      p=Cb.planMove(s,hero,{c:9,r:10});assert.ok(!p.ok);assert.strictEqual(p.code,'too-far');assert.strictEqual(p.reason,'Too far');assert.strictEqual(p.costFt,35);
      p=Cb.planMove(s,hero,{c:12,r:8});assert.strictEqual(p.code,'occupied');
      p=Cb.planMove(s,hero,{c:2,r:10});assert.strictEqual(p.code,'same');
      p=Cb.planMove(s,hero,{c:-1,r:3});assert.strictEqual(p.code,'blocked');
      p=Cb.planMove(s,a,{c:11,r:8});assert.strictEqual(p.code,'not-active');
      assert.deepStrictEqual(hero.cell,{c:2,r:10});assert.strictEqual(hero.economy.movedFt,0);
      const m=Cb.move(s,hero,{c:5,r:7});
      assert.ok(m.ok);assert.strictEqual(m.costFt,15);assert.deepStrictEqual(hero.cell,{c:5,r:7});
      assert.strictEqual(Fable.creature.movementLeftFt(hero),15);
      assert.ok(Cb.planMove(s,hero,{c:8,r:7}).ok);
      assert.strictEqual(Cb.planMove(s,hero,{c:9,r:7}).code,'too-far');
    });
    test('enemies block the way, allies do not, and a walled off square has no path',async()=>{
      const C=await world(),g=open(7,3),hero=fighter(C),a=goblin(C,0),ally=fighter(C,'ally');
      const s=Fable.combat.create({grid:g,seed:1,creatures:[hero,a,ally]});
      Fable.combat.place(s,hero,{c:0,r:1});Fable.combat.place(s,a,{c:3,r:1});Fable.combat.place(s,ally,{c:1,r:1});
      for(const r of [0,2])Fable.grid.setBlocked(g,3,r,true);
      s.phase='running';s.turn=0;s.order=['hero'];s.round=1;
      assert.strictEqual(Fable.combat.planMove(s,hero,{c:5,r:1}).code,'no-path');
      assert.ok(Fable.combat.planMove(s,hero,{c:2,r:1}).ok);
      a.alive=false;
      assert.ok(Fable.combat.planMove(s,hero,{c:5,r:1}).ok);
    });
    test('Dash adds the speed once per action, and the free interaction then Utilize use the economy',async()=>{
      const C=await world(),{s,hero}=fight(C,open(),2);
      Fable.combat.start(s);
      const cur=Fable.combat.active(s);
      assert.strictEqual(Fable.combat.dash(s,cur).movementFt,cur.speedFt*2);
      assert.ok(!Fable.combat.dash(s,cur).ok);
      assert.strictEqual(Fable.creature.movementLeftFt(cur),cur.speedFt*2);
      const o=Fable.combat.active(s)===hero?s.creatures[1]:hero;
      assert.ok(!Fable.combat.dash(s,o).ok);
      const c2=Fable.creature.newEconomy(cur);cur.economy=c2;
      assert.strictEqual(Fable.combat.interact(s,cur).cost,'free');
      assert.strictEqual(Fable.combat.interact(s,cur).cost,'action');
      assert.ok(!Fable.combat.interact(s,cur).ok);
    });
    test('a fight ends when one side has nobody left standing',async()=>{
      const C=await world(),{s,a,b}=fight(C,open(),3);
      Fable.combat.start(s);
      Fable.creature.setHp(a,0);Fable.creature.setHp(b,0);
      const r=Fable.combat.endTurn(s);
      assert.ok(r.over);assert.strictEqual(s.phase,'over');assert.strictEqual(s.winner,'player');
      assert.ok(!Fable.combat.endTurn(s).ok);
    });
    test('defeated creatures are skipped in the order',async()=>{
      const C=await world(),{s,hero,a,b}=fight(C,open(),9);
      Fable.combat.start(s);
      Fable.creature.setHp(a,0);
      const seen=new Set();
      for(let i=0;i<6;i++){Fable.combat.endTurn(s);seen.add(Fable.combat.active(s).id)}
      assert.ok(!seen.has(a.id));assert.ok(seen.has('hero')&&seen.has(b.id));
    });
  });

  suite('phase 5 goblin turns',()=>{
    test('a goblin advances on the hero as far as its speed allows and stops within reach',async()=>{
      const C=await world(),{s,hero,a}=fight(C,open(),4);
      Fable.combat.start(s);
      let guard=0;while(Fable.combat.active(s)!==a&&guard++<5)Fable.combat.endTurn(s);
      const before=Fable.grid.distanceFt(a.cell,hero.cell);
      const plan=Fable.combatAI.takeTurn(s,a);
      assert.ok(plan.move&&plan.target===hero);
      assert.strictEqual(Fable.grid.distanceFt(a.cell,hero.cell),before-30);
      assert.ok(a.economy.movedFt<=30);
    });
    test('a goblin that gets close ends in reach, and does not move when already there',async()=>{
      const C=await world(),g=open(),hero=fighter(C),a=goblin(C,0);
      const s=Fable.combat.create({grid:g,seed:1,creatures:[hero,a]});
      Fable.combat.place(s,hero,{c:2,r:2});Fable.combat.place(s,a,{c:6,r:2});
      s.phase='running';s.turn=1;s.order=['hero',a.id];s.round=1;a.economy=Fable.creature.newEconomy(a);
      const p=Fable.combatAI.takeTurn(s,a);
      assert.ok(Fable.grid.inReach(a.cell,hero.cell,5));assert.ok(p.move);assert.strictEqual(a.economy.movedFt,15);
      const p2=Fable.combatAI.planTurn(s,a);assert.strictEqual(p2.move,null);assert.strictEqual(p2.note,'already in reach');
    });
    test('goblins never stack on each other, and go around walls',async()=>{
      const C=await world(),g=open(14,9),hero=fighter(C),a=goblin(C,0),b=goblin(C,1);
      for(let r=0;r<8;r++)Fable.grid.setBlocked(g,7,r,true); // a wall with a gap at the bottom row
      const s=Fable.combat.create({grid:g,seed:1,creatures:[hero,a,b]});
      Fable.combat.place(s,hero,{c:1,r:4});Fable.combat.place(s,a,{c:12,r:4});Fable.combat.place(s,b,{c:12,r:5});
      Fable.combat.start(s);
      for(let i=0;i<24&&s.phase==='running';i++){
        const c=Fable.combat.active(s);
        if(c.team==='enemy')Fable.combatAI.takeTurn(s,c);
        Fable.combat.endTurn(s);
        assert.notDeepStrictEqual(a.cell,b.cell);
      }
      assert.ok(Fable.grid.distanceFt(a.cell,hero.cell)<=5||Fable.grid.distanceFt(b.cell,hero.cell)<=5);
    });
    test('the whole tutorial shape plays through ten rounds deterministically with no errors',async()=>{
      const C=await world();
      const run=seed=>{const {s}=fight(C,open(),seed);Fable.combat.start(s);
        for(let i=0;i<30;i++){const c=Fable.combat.active(s);if(c.team==='enemy')Fable.combatAI.takeTurn(s,c);Fable.combat.endTurn(s)}
        return JSON.stringify(s.creatures.map(c=>c.cell))+s.round};
      assert.strictEqual(run(21),run(21));
    });
  });
};
