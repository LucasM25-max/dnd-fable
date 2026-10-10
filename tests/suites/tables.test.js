'use strict';
const assert=require('assert'),H=require('../harness');

/* The Ability Modifiers table from SRD 5.2.1 p. 6, as [score range, modifier]. */
const MOD_TABLE=[[[1,1],-5],[[2,3],-4],[[4,5],-3],[[6,7],-2],[[8,9],-1],[[10,11],0],[[12,13],1],[[14,15],2],[[16,17],3],[[18,19],4],
  [[20,21],5],[[22,23],6],[[24,25],7],[[26,27],8],[[28,29],9],[[30,30],10]];

module.exports=function({suite,test}){
  suite('tables',()=>{
    test('abilityModifier matches the SRD table for every score from 1 to 30',async()=>{
      await H.loadData();
      let n=0;
      MOD_TABLE.forEach(([[lo,hi],mod])=>{for(let s=lo;s<=hi;s++){n++;assert.strictEqual(Fable.tables.abilityModifier(s),mod,'score '+s)}});
      assert.strictEqual(n,30);
    });
    test('abilityModifier rejects bad scores',async()=>{
      await H.loadData();
      [0,31,-1,10.5,'10',NaN,null,undefined].forEach(v=>assert.throws(()=>Fable.tables.abilityModifier(v),/Tables:/,String(v)));
    });
    test('levels run 1 to 20 with the SRD XP thresholds',async()=>{
      await H.loadData();
      const T=Fable.tables;
      assert.strictEqual(T.levels().length,20);
      assert.strictEqual(T.maxLevel(),20);
      const xp=[0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000];
      xp.forEach((x,i)=>assert.strictEqual(T.xpForLevel(i+1),x,'level '+(i+1)));
      assert.throws(()=>T.xpForLevel(0),/Tables:/);
      assert.throws(()=>T.xpForLevel(21),/Tables:/);
      assert.throws(()=>T.xpForLevel(1.5),/Tables:/);
    });
    test('levelForXp uses the threshold as soon as it is reached',async()=>{
      await H.loadData();
      const T=Fable.tables;
      [[0,1],[50,1],[299,1],[300,2],[899,2],[900,3],[2699,3],[2700,4],[6500,5],[354999,19],[355000,20],[9999999,20]].forEach(([x,l])=>assert.strictEqual(T.levelForXp(x),l,'xp '+x));
      [-1,1.5,'5',NaN].forEach(v=>assert.throws(()=>T.levelForXp(v),/Tables:/));
    });
    test('xpProgress drives the XP bar (the tutorial gives 50 of the 300 XP for level 2)',async()=>{
      await H.loadData();
      const p=Fable.tables.xpProgress(50);
      assert.deepStrictEqual([p.level,p.levelStartXp,p.nextLevelXp,p.intoLevel,p.neededForNext],[1,0,300,50,250]);
      assert.ok(Math.abs(p.fraction-50/300)<1e-12);
      const q=Fable.tables.xpProgress(600);
      assert.deepStrictEqual([q.level,q.intoLevel,q.neededForNext],[2,300,300]);
      assert.strictEqual(q.fraction,0.5);
      const top=Fable.tables.xpProgress(400000);
      assert.deepStrictEqual([top.level,top.nextLevelXp,top.neededForNext,top.fraction],[20,null,null,1]);
    });
    test('proficiencyBonus follows the SRD bands for levels and Challenge Ratings',async()=>{
      await H.loadData();
      const T=Fable.tables;
      [[0,2],[0.125,2],[0.5,2],[1,2],[4,2],[5,3],[8,3],[9,4],[12,4],[13,5],[16,5],[17,6],[20,6],[21,7],[24,7],[25,8],[28,8],[29,9],[30,9]]
        .forEach(([x,b])=>assert.strictEqual(T.proficiencyBonus(x),b,'level or CR '+x));
      [-1,31,NaN,'4'].forEach(v=>assert.throws(()=>T.proficiencyBonus(v),/Tables:/));
    });
    test('the level table and the proficiency bands agree for every level',async()=>{
      await H.loadData();
      Fable.tables.levels().forEach(l=>assert.strictEqual(Fable.tables.proficiencyBonus(l.level),l.proficiencyBonus,'level '+l.level));
    });
    test('the proficiency bands cover 0 to 30 with no gaps or overlaps',async()=>{
      const C=await H.loadData();
      const bands=C.proficiencyBands.list();
      assert.strictEqual(bands[0].min,0);
      assert.strictEqual(bands[bands.length-1].max,30);
      for(let i=1;i<bands.length;i++)assert.strictEqual(bands[i].min,bands[i-1].max+1);
    });
    test('lookups say so when the tables are not loaded',()=>{
      H.fresh();H.loadRules();H.loadRegistry();
      assert.throws(()=>Fable.tables.levelForXp(5),/not loaded/);
    });
  });
};
