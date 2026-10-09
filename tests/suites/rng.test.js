'use strict';
const assert=require('assert'),H=require('../harness');
/* The original implementation, copied from js/engine/block-batch.js before it moved. Map generation depends on it. */
const legacy=function(a){a|=0;return function(){var t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}};

module.exports=function({suite,test}){
  suite('rng',()=>{
    test('matches the original sequence exactly (maps stay identical)',()=>{
      H.fresh();H.loadRules();
      [0,1,7,20261007,-5,123456789].forEach(seed=>{
        const a=Fable.rng(seed),b=legacy(seed);
        for(let i=0;i<5000;i++)assert.strictEqual(a(),b());
      });
    });
    test('values stay in [0,1)',()=>{
      H.fresh();H.loadRules();
      const r=Fable.rng(99);
      for(let i=0;i<20000;i++){const v=r();assert.ok(v>=0&&v<1)}
    });
    test('state can be saved and restored',()=>{
      H.fresh();H.loadRules();
      const r=Fable.rng(42);
      for(let i=0;i<123;i++)r();
      const s=r.getState(),expected=[];
      for(let i=0;i<50;i++)expected.push(r());
      const r2=Fable.rng(1);r2.setState(s);
      expected.forEach(v=>assert.strictEqual(r2(),v));
    });
    test('state restore stays exact after many draws',()=>{
      H.fresh();H.loadRules();
      const r=Fable.rng(5),twin=legacy(5);
      for(let i=0;i<200000;i++){r();twin()}
      const r2=Fable.rng(0);r2.setState(r.getState());
      for(let i=0;i<100;i++)assert.strictEqual(r2(),twin());
    });
    test('hash is stable and spreads strings',()=>{
      H.fresh();H.loadRules();
      assert.strictEqual(Fable.rng.hash('a'),Fable.rng.hash('a'));
      assert.notStrictEqual(Fable.rng.hash('a'),Fable.rng.hash('b'));
      assert.strictEqual(Fable.rng.hash(''),0x811C9DC5|0);
      assert.strictEqual(Fable.rng.hash('hello'),1335831723); /* FNV-1a 32 bit of "hello" is 0x4f9f2cab */
    });
  });
};
