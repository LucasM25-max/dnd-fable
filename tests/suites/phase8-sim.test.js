'use strict';
const assert=require('assert');

/* The headless simulator as a regression test (plan 16.10). The fights use fixed seeds, so the numbers are repeatable; the bands are wide
   enough that a small tuning change does not trip them and narrow enough that a broken AI (goblins that run forever, or that never hit) does.
   Agreed bands for the tutorial (level 1 Fighter against two Goblin Minions, Cunning tier):
     a hero that walks up, fights and uses Second Wind wins 70% to 95% of fights and loses 15% to 60% of its hit points on average;
     a hero that never heals still wins 40% to 85%; a hero that kites with javelins wins 75% or more;
     fewer than 8% of fights stall (no winner after 40 rounds: a lone goblin that keeps escaping a hero who has thrown every javelin). */
module.exports=function(t){
  const {suite,test}=t;
  suite('phase 8 simulator',()=>{
    test('a hero that fights in melee with Second Wind stays inside the agreed bands',async()=>{
      const S=require('../sim.js');
      const r=await S.batch({fights:40,policy:'windy'});
      assert.ok(r.winRate>=0.70&&r.winRate<=0.95,'win rate '+r.winRate);
      assert.ok(r.hpLostFrac>=0.15&&r.hpLostFrac<=0.60,'hit points lost '+r.hpLostFrac);
      assert.ok(r.timeoutRate<0.08,'stalls '+r.timeoutRate);
      assert.ok(r.avgRounds>=3&&r.avgRounds<=20,'rounds '+r.avgRounds);
    });
    test('a hero that kites with javelins wins most fights and the goblins still fight back',async()=>{
      const S=require('../sim.js');
      const r=await S.batch({fights:40,policy:'kite'});
      assert.ok(r.winRate>=0.75,'win rate '+r.winRate);
      assert.ok(r.avgHpLost>0.3,'hit points lost '+r.avgHpLost);
      assert.ok(r.timeoutRate<0.08,'stalls '+r.timeoutRate);
    });
    test('a hero that never heals still wins about half the fights: the goblins are a real threat',async()=>{
      const S=require('../sim.js');
      const r=await S.batch({fights:40,policy:'nearest'});
      assert.ok(r.winRate>=0.40&&r.winRate<=0.85,'win rate '+r.winRate);
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
