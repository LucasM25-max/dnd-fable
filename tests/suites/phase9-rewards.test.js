'use strict';
const assert=require('assert'),H=require('../harness');

/* Phase 9: rewards, the shop, potions in combat, victory animations (implementation plan, section 17). */
const en=(id,xp,status)=>({id,name:id,defId:'x',xp,status:status||'defeated',treasure:[]});
const hero=(hp,max)=>({hp,hpMax:max});
function run(C,xpList,extra){
  const enemies=xpList.map((x,i)=>en('g'+i,x));
  return Fable.rewards.compute(Object.assign({win:true,encounter:{rewards:{xp:'auto',gold:'auto',bonuses:false}},enemies,hero:hero(10,10),rounds:3,levels:[1],xpBefore:0,rng:()=>0},extra||{}));
}

module.exports=function({suite,test}){
  suite('phase 9 rewards',()=>{
    test('the plan examples: tutorial, three goblins, a boss',async()=>{
      const C=await H.loadData();
      let r=run(C,[25,25]);
      assert.strictEqual(r.xp,50);assert.strictEqual(r.tier.id,'low');assert.strictEqual(r.gold,50);assert.strictEqual(r.cp,5000);
      r=run(C,[25,25,25]);
      assert.strictEqual(r.xp,75);assert.strictEqual(r.tier.id,'moderate');assert.strictEqual(r.gold,83);
      r=run(C,[200]);
      assert.strictEqual(r.tier.id,'deadly');assert.strictEqual(r.gold,300);
    });
    test('a defeat pays nothing',async()=>{
      await H.loadData();
      const r=run(null,[25,25],{win:false});
      assert.strictEqual(r.xp,0);assert.strictEqual(r.gold,0);assert.strictEqual(r.cp,0);assert.deepStrictEqual(r.items,[]);
    });
    test('gold rounds half up in whole numbers',async()=>{
      await H.loadData();
      const eco=Fable.rewards.economy(),mod={multiplier:1.1};
      assert.strictEqual(Fable.rewards.gold(eco,75,mod,0),83);
      assert.strictEqual(Fable.rewards.gold(eco,0,mod,0),0);
      assert.strictEqual(Fable.rewards.gold(eco,50,{multiplier:1},10),55);
    });
    test('bonuses are earned or missed by the facts and add up',async()=>{
      await H.loadData();
      const enc={rewards:{xp:'auto',gold:'auto',bonuses:true,par:{rounds:4}}};
      const base={win:true,encounter:enc,enemies:[en('a',25),en('b',25)],levels:[1],xpBefore:0,rng:()=>0};
      let r=Fable.rewards.compute(Object.assign({hero:hero(10,10),rounds:3,consumablesUsed:0},base));
      assert.strictEqual(r.bonuses.length,3);assert.strictEqual(r.bonusPercent,25);assert.strictEqual(r.gold,63);
      r=Fable.rewards.compute(Object.assign({hero:hero(4,10),rounds:9,consumablesUsed:1},base));
      assert.strictEqual(r.bonusPercent,0);assert.strictEqual(r.gold,50);
    });
    test('shares and coin pieces always sum exactly',async()=>{
      await H.loadData();
      [[[25,25,25],8300],[[25,25,25],1],[[0,0],7],[[50,25],12345]].forEach(([xps,cp])=>{
        const sh=Fable.rewards.shares(xps.map((x,i)=>en('e'+i,x)),cp);
        assert.strictEqual(sh.reduce((n,x)=>n+x.cp,0),cp);
        sh.forEach(x=>assert.ok(Number.isInteger(x.cp)&&x.cp>=0));
      });
      [1,2,50,5000,123456].forEach(cp=>assert.strictEqual(Fable.rewards.pieces(cp).reduce((n,v)=>n+v,0),cp));
      assert.deepStrictEqual(Fable.rewards.pieces(0),[]);
    });
    test('a story reward is paid as written and the XP bar crosses levels',async()=>{
      await H.loadData();
      const r=Fable.rewards.compute({win:true,encounter:{rewards:{xp:400,gold:7}},enemies:[en('a',25)],hero:hero(5,5),rounds:1,levels:[1],xpBefore:250,rng:()=>0});
      assert.strictEqual(r.xp,400);assert.strictEqual(r.gold,7);
      assert.strictEqual(r.progress.levelsGained,r.progress.after.level-r.progress.before.level);
      assert.ok(r.progress.levelsGained>=1);assert.strictEqual(r.progress.before.level,1);
    });
    test('an economy kind validates its tiers and the standard row is valid',async()=>{
      const C=await H.loadData();
      assert.ok(C.economies.has('standard'));
      assert.deepStrictEqual(C.validate().errors,[]);
    });
  });

  suite('phase 9 shop and victory animations',()=>{
    test('the Potion of Healing is first in the armory at 50 gp',async()=>{
      const C=await H.loadData({heroes:true,shops:true});
      const b=C.characters.get('human-fighter').build,cat=Fable.character.shop.catalog('armory',b);
      assert.strictEqual(cat[0].item,'potion-of-healing');assert.strictEqual(cat[0].priceCp,5000);
    });
    test('buying needs the gold, equipped items cannot be sold, only stock can be bought',async()=>{
      const C=await H.loadData({heroes:true,shops:true});
      const S=Fable.character.shop,I=Fable.character.inventory;
      let b=C.characters.get('human-fighter').build;
      b=I.spend(b,I.purseCp(b)).build;
      assert.ok(!S.buy(b,'armory','potion-of-healing',1).ok);
      b=I.gain(b,10000).build;
      const r=S.buy(b,'armory','potion-of-healing',2);
      assert.ok(r.ok);assert.strictEqual(I.purseCp(r.build),0);
      assert.ok(!S.buy(b,'armory','longsword',1).ok);
      const held=Object.values(b.equipped).filter(Boolean)[0];
      assert.ok(!S.sell(b,'armory',held,1).ok);
      const sold=S.sell(r.build,'armory','potion-of-healing',1);
      assert.ok(sold.ok);assert.strictEqual(I.purseCp(sold.build),2500);
    });
    test('victory animations: exactly one default, a paid one costs gold',async()=>{
      const C=await H.loadData({presentation:true,shops:true});
      const v=C.victoryAnimations.list();
      assert.strictEqual(v.filter(x=>x.default).length,1);
      assert.ok(v.some(x=>x.cost));
      assert.ok(!v.filter(x=>x.default)[0].cost);
    });
    test('the Potion of Healing is a Bonus Action item that heals and is used up',async()=>{
      const C=await H.loadData({monsters:true,heroes:true});
      let build=C.characters.get('human-fighter').build;
      build=Fable.character.inventory.add(build,'potion-of-healing',1).build;
      const h=Fable.creature.fromSheet(Fable.character.compute(build),{id:'hero',build});
      const g=Fable.creature.fromMonster(C.monsters.get('goblin-minion'),{index:0});
      const s=Fable.combat.create({grid:Fable.grid.create({cols:20,rows:20}),seed:1,creatures:[h,g]});
      Fable.combat.place(s,h,{c:5,r:5});Fable.combat.place(s,g,{c:15,r:15});Fable.combat.start(s);
      s.order=['hero',g.id];s.turn=0;
      h.hp.current=1;
      const r=Fable.combat.useAction(s,h,'use-potion-of-healing');
      assert.ok(r.ok,JSON.stringify(r));
      assert.ok(h.hp.current>=5&&h.hp.current<=Math.min(h.hp.max,1+10));
      assert.strictEqual(h.itemsUsed['potion-of-healing'],1);
      assert.ok(!Fable.combat.useAction(s,h,'use-potion-of-healing').ok);
    });
  });

  suite('phase 9 presentation',()=>{
    test('a halted animator stops its idle and resumes',()=>{
      H.fresh();H.loadRules();['js/presentation/ease.js','js/presentation/anim.js'].forEach(f=>H.runFile(f));
      const o=()=>({position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0,order:'XYZ'},scale:{x:1,y:1,z:1}});
      const j={root:o(),hips:o(),torso:o(),head:o(),armL:o(),armR:o(),legL:o(),legR:o()};
      const a=Fable.anim.createAnimator({joints:j,idle:{},footDrop:8},{lookup:{get:()=>null}});
      a.halt();assert.ok(a.halted());
      a.update(1);a.apply();const p=JSON.stringify(j.head.rotation);a.update(1);a.apply();
      assert.strictEqual(JSON.stringify(j.head.rotation),p);
      a.resume();assert.ok(!a.halted());
    });
  });
};
