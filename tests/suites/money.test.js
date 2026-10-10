'use strict';
const assert=require('assert'),H=require('../harness');
function setup(){H.fresh();H.loadRules();return Fable.money}

module.exports=function({suite,test}){
  suite('money',()=>{
    test('coin values follow the SRD table',()=>{
      const M=setup();
      assert.deepStrictEqual(M.COINS.map(c=>[c.id,c.cp]),[['cp',1],['sp',10],['ep',50],['gp',100],['pp',1000]]);
    });
    test('toCp converts costs exactly',()=>{
      const M=setup();
      assert.strictEqual(M.toCp({gp:15}),1500);
      assert.strictEqual(M.toCp({sp:5}),50);
      assert.strictEqual(M.toCp({cp:5}),5);
      assert.strictEqual(M.toCp({gp:1,sp:5,cp:3}),153);
      assert.strictEqual(M.toCp({ep:1}),50);
      assert.strictEqual(M.toCp({pp:1}),1000);
      assert.strictEqual(M.toCp({gp:0}),0);
    });
    test('toCp rejects anything that is not a coin object',()=>{
      const M=setup();
      [null,undefined,5,'5 gp',[],{},{gp:-1},{gp:1.5},{gp:'1'},{xp:3},{gp:NaN},{gp:Infinity}].forEach(v=>assert.throws(()=>M.toCp(v),/Money:/,JSON.stringify(v)));
    });
    test('checkCost explains the problem and isCost agrees',()=>{
      const M=setup();
      assert.strictEqual(M.checkCost({gp:2}),null);
      assert.match(M.checkCost({zp:2}),/unknown coin "zp"/);
      assert.strictEqual(M.isCost({gp:2}),true);
      assert.strictEqual(M.isCost({gp:-2}),false);
    });
    test('fromCp splits into gold, silver and copper',()=>{
      const M=setup();
      assert.deepStrictEqual(M.fromCp(153),{gp:1,sp:5,cp:3});
      assert.deepStrictEqual(M.fromCp(0),{gp:0,sp:0,cp:0});
      assert.deepStrictEqual(M.fromCp(99),{gp:0,sp:9,cp:9});
      assert.deepStrictEqual(M.fromCp(150000),{gp:1500,sp:0,cp:0});
      assert.throws(()=>M.fromCp(-1),/Money:/);
      assert.throws(()=>M.fromCp(1.5),/Money:/);
    });
    test('fromCp and toCp round trip',()=>{
      const M=setup();
      for(let cp=0;cp<5000;cp+=7)assert.strictEqual(M.toCp(M.fromCp(cp)),cp);
    });
    test('format shows readable prices',()=>{
      const M=setup();
      assert.strictEqual(M.format(1500),'15 gp');
      assert.strictEqual(M.format(50),'5 sp');
      assert.strictEqual(M.format(153),'1 gp 5 sp 3 cp');
      assert.strictEqual(M.format(150000),'1,500 gp');
      assert.strictEqual(M.format(0),'0 gp');
    });
    test('coin weight is fifty coins to the pound',()=>{
      const M=setup();
      assert.strictEqual(M.coinWeight(50),1);
      assert.strictEqual(M.coinWeight(0),0);
      assert.throws(()=>M.coinWeight(-1),/Money:/);
    });
  });
};
