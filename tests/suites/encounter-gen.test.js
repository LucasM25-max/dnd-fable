'use strict';
const assert=require('assert'),H=require('../harness');

/* The ordinary-play encounter generator (gameplay vision, section 3). */
const MAP={id:'forest-clearing',name:'Forest Clearing',environments:['forest','grassland'],enemySpawns:[{id:'path-ambush',x:50,z:130,w:48,d:36}]};
const gob=(o)=>Object.assign({id:'goblin-minion',name:'Goblin Minion',challenge:{xp:25},hp:{average:7},environments:['forest','grassland','hill','underdark'],family:'goblinoid',role:'skirmisher'},o||{});
async function setup(){
  await H.loadData({});
  H.runFile('js/rules/encounter-gen.js');
  return Fable.encounterGen;
}
module.exports=function(t){
  const {suite,test}=t;
  suite('encounter generator',()=>{
    test('the budgets are the 2024 XP budgets of the party and difficulty',async()=>{
      const G=await setup();
      assert.strictEqual(G.budget([1],'low'),50);assert.strictEqual(G.budget([1],'moderate'),75);assert.strictEqual(G.budget([1],'high'),100);
      assert.strictEqual(G.budget([1,1],'high'),200);
    });
    test('with the one goblin and one map every difficulty is valid: two goblins on the forest clearing',async()=>{
      const G=await setup();
      ['low','moderate','high'].forEach(d=>{
        const r=G.generate({levels:[1],difficulty:d,seed:3,maps:[MAP],monsters:[gob()]});
        assert.ok(r.ok,d);
        const e=r.encounter;
        assert.strictEqual(e.map,'forest-clearing');assert.strictEqual(e.generated,true);assert.strictEqual(e.difficulty,d);
        assert.strictEqual(e.dialogue,undefined,'an ordinary fight has no Elminster');
        assert.deepStrictEqual(e.enemies.map(g=>[g.monster,g.count,g.spawnZone]),[['goblin-minion',2,'path-ambush']]);
        assert.strictEqual(r.meta.fallback,false);
        assert.ok(r.meta.spent<=r.meta.budget);
        assert.strictEqual(r.meta.unused,r.meta.budget-r.meta.spent);
      });
    });
    test('the same inputs always give the same encounter; the seed only breaks ties',async()=>{
      const G=await setup(),b=()=>({levels:[3],difficulty:'moderate',seed:42,maps:[MAP],monsters:[gob(),gob({id:'wolf',name:'Wolf',challenge:{xp:50},family:'beast',role:'brute',environments:['forest']})]});
      assert.deepStrictEqual(JSON.stringify(G.generate(b())),JSON.stringify(G.generate(b())));
    });
    test('it never goes over budget, never over two per player character, and spends what it can',async()=>{
      const G=await setup();
      const mons=[gob(),gob({id:'wolf',name:'Wolf',challenge:{xp:50},family:'beast',role:'brute',environments:['forest']}),gob({id:'ogre',name:'Ogre',challenge:{xp:450},family:'giant',role:'brute',environments:['forest','grassland']})];
      for(const lv of [[1],[2],[4],[1,1],[3,3]])for(const d of ['low','moderate','high'])for(let seed=1;seed<6;seed++){
        const r=G.generate({levels:lv,difficulty:d,seed,maps:[MAP],monsters:mons});
        assert.ok(r.ok);
        const n=r.encounter.enemies.reduce((a,g)=>a+g.count,0);
        if(!r.meta.fallback){
          assert.ok(r.meta.spent<=r.meta.budget,lv+d);
          assert.ok(n<=2*lv.length);
        }
      }
    });
    test('a monster tagged for another environment is left out; an untagged one fits anywhere',async()=>{
      const G=await setup();
      const desert=gob({id:'scorpion',name:'Scorpion',environments:['desert'],challenge:{xp:25}});
      const r=G.generate({levels:[1],difficulty:'low',seed:1,maps:[MAP],monsters:[desert,gob()]});
      assert.ok(r.encounter.enemies.every(g=>g.monster==='goblin-minion'));
      const untagged=gob({id:'rat',name:'Rat',environments:undefined,challenge:{xp:25}});
      const r2=G.generate({levels:[1],difficulty:'low',seed:1,maps:[MAP],monsters:[untagged]});
      assert.ok(r2.ok&&r2.encounter.enemies[0].monster==='rat');
    });
    test('a recent encounter is avoided when there is another one as good',async()=>{
      const G=await setup();
      const m2=Object.assign({},MAP,{id:'old-road',name:'Old Road',environments:['forest']});
      const mons=[gob()];
      const first=G.generate({levels:[1],difficulty:'low',seed:1,maps:[MAP,m2],monsters:mons});
      const key=first.meta.key,seen=new Set();
      for(let seed=1;seed<10;seed++){
        const r=G.generate({levels:[1],difficulty:'low',seed,maps:[MAP,m2],monsters:mons,recent:[key]});
        seen.add(r.encounter.map);
        assert.notStrictEqual(r.meta.key,key,'seed '+seed);
      }
      assert.ok(seen.size>=1);
    });
    test('a map whose spawn zone is too small for the group is not chosen',async()=>{
      const G=await setup();
      const tiny=Object.assign({},MAP,{id:'tiny',enemySpawns:[{id:'z',x:0,z:0,w:16,d:16}]});
      const r=G.generate({levels:[1],difficulty:'low',seed:1,maps:[tiny,MAP],monsters:[gob()]});
      assert.strictEqual(r.encounter.map,'forest-clearing');
    });
    test('groups share a zone on a grid without overlapping, and the zone is counted in total creatures',async()=>{
      const G=await setup();
      const e=G.generate({levels:[1,1,1,1],difficulty:'high',seed:3,maps:[MAP],monsters:[gob(),gob({id:'goblin-b',name:'Goblin B'})]}).encounter;
      const z=MAP.enemySpawns[0],cols=Math.floor(z.w/15),rows=Math.floor(z.d/15),slots=new Set();let n=0;
      e.enemies.forEach(g=>{assert.strictEqual(g.formation.type,'grid');for(let i=0;i<g.count;i++){slots.add(g.formation.start+i);n++}});
      assert.strictEqual(slots.size,n);assert.ok(n<=cols*rows);
    });
    test('a zone that is one cell deep holds one row of creatures',async()=>{
      const G=await setup();
      const thin=Object.assign({},MAP,{id:'thin',enemySpawns:[{id:'z',x:0,z:0,w:48,d:16}]});
      const r=G.generate({levels:[1,1,1,1],difficulty:'high',seed:2,maps:[thin],monsters:[gob()]});
      assert.ok(r.encounter.enemies.reduce((a,g)=>a+g.count,0)<=3);
    });
    test('the AI tier comes from the difficulty table and par follows the group hit points',async()=>{
      const G=await setup();
      ['low','moderate','high'].forEach(d=>{
        const r=G.generate({levels:[1],difficulty:d,seed:1,maps:[MAP],monsters:[gob()]});
        assert.strictEqual(r.encounter.ai.tier,G.AI_BY_DIFFICULTY[d]);
      });
      const r=G.generate({levels:[1],difficulty:'moderate',seed:1,maps:[MAP],monsters:[gob()]}).encounter;
      const hp=r.enemies.reduce((a,g)=>a+g.count*7,0);
      assert.strictEqual(r.rewards.par.rounds,Math.max(2,Math.ceil(hp/6)+1));
    });
    test('when nothing fits the budget it falls back to the cheapest single creature and says so',async()=>{
      const G=await setup();
      const r=G.generate({levels:[1],difficulty:'low',seed:1,maps:[MAP],monsters:[gob({challenge:{xp:700}})]});
      assert.ok(r.ok);assert.strictEqual(r.meta.fallback,true);
      assert.deepStrictEqual(r.encounter.enemies.map(g=>g.count),[1]);
    });
    test('bad input is refused with a reason',async()=>{
      const G=await setup();
      assert.strictEqual(G.generate({levels:[1],difficulty:'deadly',seed:1,maps:[MAP],monsters:[gob()]}).ok,false);
      assert.strictEqual(G.generate({levels:[0],difficulty:'low',seed:1,maps:[MAP],monsters:[gob()]}).ok,false);
      assert.strictEqual(G.generate({levels:[1],difficulty:'low',seed:1,maps:[],monsters:[gob()]}).ok,false);
      assert.strictEqual(G.generate({levels:[1],difficulty:'low',seed:1,maps:[MAP],monsters:[]}).ok,false);
    });
    test('the encounter it builds is one the registry accepts and the rewards code can price',async()=>{
      const G=await setup();
      const e=G.generate({levels:[1],difficulty:'moderate',seed:9,maps:[MAP],monsters:[gob()]}).encounter;
      Fable.content.monsters.register({id:'goblin-minion',name:'Goblin Minion',challenge:{xp:25},factory(){}});
      Fable.content.encounters.register(Object.assign({},e,{enabled:false}));
      const est=Fable.rewards.estimate(e,[1]);
      assert.strictEqual(est.xp,50);assert.ok(est.gold>0);
    });
  });
};
