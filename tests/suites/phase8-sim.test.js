'use strict';
const assert=require('assert');

/* The headless simulator as a regression test (plan 16.10). The fights use fixed seeds, so the numbers are repeatable; the bands are wide
   enough that a small tuning change does not trip them and narrow enough that a broken AI (goblins that run forever, or that never hit) does.
   Agreed bands for the tutorial (level 1 Fighter against two Goblin Minions, Cunning tier):
     the goblins' one aim is to kill the hero as fast as they can: they attack on nearly every turn, never run and almost never hide, so a
     fight lasts about 3 to 8 rounds;
     a hero that walks up, fights and uses Second Wind wins 80% to 100% of fights and loses 10% to 60% of its hit points on average;
     a hero that never heals still wins 50% to 90%; a hero that kites with javelins wins 80% or more;
     fewer than 5% of fights stall (no winner after 40 rounds). */
module.exports=function(t){
  const {suite,test}=t;
  suite('phase 8 simulator',()=>{
    test('a hero that fights in melee with Second Wind stays inside the agreed bands',async()=>{
      const S=require('../sim.js');
      const r=await S.batch({fights:40,policy:'windy'});
      assert.ok(r.winRate>=0.80&&r.winRate<=1,'win rate '+r.winRate);
      assert.ok(r.hpLostFrac>=0.10&&r.hpLostFrac<=0.60,'hit points lost '+r.hpLostFrac);
      assert.ok(r.timeoutRate<0.05,'stalls '+r.timeoutRate);
      assert.ok(r.avgRounds>=2&&r.avgRounds<=8,'rounds '+r.avgRounds);
      assert.ok(r.extra.passive/r.extra.goblinTurns<0.15,'goblin turns without an attack '+JSON.stringify(r.extra));
      assert.strictEqual(r.extra.fleeTurns,0,'the goblins never run');
      assert.ok(r.extra.hidden<0.3,'hides per fight '+r.extra.hidden);
    });
    test('a hero that kites with javelins wins most fights and the goblins still fight back',async()=>{
      const S=require('../sim.js');
      const r=await S.batch({fights:40,policy:'kite'});
      assert.ok(r.winRate>=0.80,'win rate '+r.winRate);
      assert.ok(r.avgHpLost>0.3,'hit points lost '+r.avgHpLost);
      assert.ok(r.timeoutRate<0.05,'stalls '+r.timeoutRate);
    });
    test('a hero that never heals still wins about half the fights: the goblins are a real threat',async()=>{
      const S=require('../sim.js');
      const r=await S.batch({fights:40,policy:'nearest'});
      assert.ok(r.winRate>=0.50&&r.winRate<=0.90,'win rate '+r.winRate);
      assert.ok(r.heroDownRate>0.1,'the hero is sometimes put down '+r.heroDownRate);
    });
    test('the same seeds give the same fights (the whole simulator is deterministic)',async()=>{
      const S=require('../sim.js');
      const a=await S.runFight({seed:1004,policy:'nearest'}),b=await S.runFight({seed:1004,policy:'nearest'});
      assert.deepStrictEqual(a,b);
    });
    test('the Instinct tier is easier to beat than Cunning, and Mastermind is not easier than Cunning',async()=>{
      const S=require('../sim.js');
      const inst=await S.batch({fights:30,policy:'nearest',tier:'instinct'});
      const cun=await S.batch({fights:30,policy:'nearest',tier:'cunning'});
      assert.ok(inst.timeoutRate<0.1);
      assert.ok(inst.winRate>=cun.winRate-0.1,'instinct '+inst.winRate+' cunning '+cun.winRate);
    });
  });
};
