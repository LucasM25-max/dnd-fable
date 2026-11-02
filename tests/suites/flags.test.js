'use strict';
const assert=require('assert'),H=require('../harness');
function store(){const d={};return {getItem:k=>k in d?d[k]:null,setItem:(k,v)=>{d[k]=String(v)},removeItem:k=>{delete d[k]},d}}
module.exports=function(t){
  const {suite,test}=t;
  suite('player flags',()=>{
    test('a new player has not done the tutorial and plays Moderate',async()=>{
      await H.loadData({});globalThis.localStorage=store();H.runFile('js/character/flags.js');
      assert.strictEqual(Fable.flags.tutorialDone(),false);assert.strictEqual(Fable.flags.difficulty(),'moderate');assert.deepStrictEqual(Fable.flags.recent(),[]);
    });
    test('what is set survives a reload (a fresh read of storage)',async()=>{
      await H.loadData({});globalThis.localStorage=store();H.runFile('js/character/flags.js');
      Fable.flags.setTutorialDone(true);Fable.flags.setDifficulty('high');Fable.flags.pushRecent('a|b');
      Fable.flags._forget();
      assert.strictEqual(Fable.flags.tutorialDone(),true);assert.strictEqual(Fable.flags.difficulty(),'high');assert.deepStrictEqual(Fable.flags.recent(),['a|b']);
    });
    test('an unknown difficulty is refused, history is capped, junk in storage is ignored',async()=>{
      await H.loadData({});const s=store();globalThis.localStorage=s;H.runFile('js/character/flags.js');
      assert.strictEqual(Fable.flags.setDifficulty('deadly'),false);
      for(let i=0;i<20;i++)Fable.flags.pushRecent('k'+i);
      assert.strictEqual(Fable.flags.recent().length,6);assert.strictEqual(Fable.flags.recent()[5],'k19');
      s.d['dicebound.flags.v1']='{not json';Fable.flags._forget();
      assert.strictEqual(Fable.flags.tutorialDone(),false);
    });
    test('blocked storage still works for the visit',async()=>{
      await H.loadData({});
      Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('blocked')}});
      H.runFile('js/character/flags.js');
      Fable.flags.setTutorialDone(true);assert.strictEqual(Fable.flags.tutorialDone(),true);
      delete globalThis.localStorage;
    });
    test('reset brings the tutorial back',async()=>{
      await H.loadData({});globalThis.localStorage=store();H.runFile('js/character/flags.js');
      Fable.flags.setTutorialDone(true);Fable.flags.reset();assert.strictEqual(Fable.flags.tutorialDone(),false);
    });
  });
};
