'use strict';
const assert=require('assert'),H=require('../harness');
function store(){const d={};return {getItem:k=>k in d?d[k]:null,setItem:(k,v)=>{d[k]=String(v)},removeItem:k=>{delete d[k]},d}}
/* the codex only needs storage and, for absorb, a roster-shaped object */
async function world(){await H.loadData({});const s=store();globalThis.localStorage=s;H.runFile('js/character/codex.js');return s}
const roster=packs=>({characters:()=>Object.keys(packs),build:id=>({inventory:packs[id]})});

module.exports=function(t){
  const {suite,test}=t;
  suite('codex',()=>{
    test('a new player has met nothing and found nothing',async()=>{
      await world();
      assert.strictEqual(Fable.codex.metCount(),0);assert.strictEqual(Fable.codex.hasMet('goblin-minion'),false);
      assert.strictEqual(Fable.codex.monster('goblin-minion'),null);assert.deepStrictEqual(Fable.codex.foundIds(),[]);
    });
    test('a fight counts each kind of monster once, however many stand in it',async()=>{
      await world();
      Fable.codex.noteFight(['goblin-minion','goblin-minion','goblin-warrior']);
      assert.deepStrictEqual(Fable.codex.monster('goblin-minion'),{fights:1,defeated:0});
      assert.deepStrictEqual(Fable.codex.monster('goblin-warrior'),{fights:1,defeated:0});
      Fable.codex.noteFight(['goblin-minion']);
      assert.strictEqual(Fable.codex.monster('goblin-minion').fights,2);assert.strictEqual(Fable.codex.metCount(),2);
    });
    test('a defeat is counted, and one for a monster never listed still marks it as met',async()=>{
      await world();
      Fable.codex.noteFight(['goblin-minion']);Fable.codex.noteDefeat('goblin-minion');Fable.codex.noteDefeat('goblin-minion');
      assert.strictEqual(Fable.codex.monster('goblin-minion').defeated,2);
      Fable.codex.noteDefeat('goblin-warrior');
      assert.strictEqual(Fable.codex.hasMet('goblin-warrior'),true);
    });
    test('junk ids are ignored',async()=>{
      await world();
      Fable.codex.noteFight([null,'',undefined,42]);Fable.codex.noteDefeat(null);Fable.codex.noteItems([null,'',7]);
      assert.strictEqual(Fable.codex.metCount(),0);assert.deepStrictEqual(Fable.codex.foundIds(),[]);
    });
    test('what is met and found survives a reload',async()=>{
      await world();
      Fable.codex.noteFight(['goblin-minion']);Fable.codex.noteDefeat('goblin-minion');Fable.codex.noteItems(['longsword','dagger']);
      Fable.codex._forget();
      assert.deepStrictEqual(Fable.codex.monster('goblin-minion'),{fights:1,defeated:1});
      assert.deepStrictEqual(Fable.codex.foundIds(),['longsword','dagger']);
    });
    test('damaged or foreign storage is ignored rather than trusted',async()=>{
      const s=await world();
      s.d['dicebound.codex.v1']='{not json';Fable.codex._forget();
      assert.strictEqual(Fable.codex.metCount(),0);
      s.d['dicebound.codex.v1']=JSON.stringify({v:1,monsters:{a:{fights:-3,defeated:'x'},b:7,c:{fights:2,defeated:1.5}},items:['x','x',3,'y']});Fable.codex._forget();
      assert.deepStrictEqual(Fable.codex.monster('a'),{fights:1,defeated:0},'a bad count becomes the least that is true');
      assert.strictEqual(Fable.codex.hasMet('b'),false);
      assert.deepStrictEqual(Fable.codex.monster('c'),{fights:2,defeated:0});
      assert.deepStrictEqual(Fable.codex.foundIds(),['x','y']);
      s.d['dicebound.codex.v1']=JSON.stringify({v:2,monsters:{a:{fights:1,defeated:1}}});Fable.codex._forget();
      assert.strictEqual(Fable.codex.metCount(),0,'a version it does not know is ignored');
    });
    test('blocked storage still works for the visit',async()=>{
      await world();
      Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('blocked')}});
      Fable.codex._forget();
      Fable.codex.noteFight(['goblin-minion']);Fable.codex.noteItems(['dagger']);
      assert.strictEqual(Fable.codex.hasMet('goblin-minion'),true);assert.strictEqual(Fable.codex.hasFound('dagger'),true);
      delete globalThis.localStorage;
    });
    test('absorb notes every item in every pack, once, and keeps what was sold',async()=>{
      await world();
      assert.strictEqual(Fable.codex.absorb(roster({a:[{item:'longsword',qty:1},{item:'dagger',qty:2}],b:[{item:'dagger',qty:1},{item:'shield',qty:0}]})),true);
      assert.deepStrictEqual(Fable.codex.foundIds().sort(),['dagger','longsword'],'an empty stack is not found');
      assert.strictEqual(Fable.codex.absorb(roster({a:[{item:'longsword',qty:1}]})),false,'nothing new');
      assert.strictEqual(Fable.codex.hasFound('dagger'),true,'a sold item is still in the Collection');
      assert.strictEqual(Fable.codex.absorb({characters(){throw new Error('x')}}),false,'a broken roster does not throw');
    });
    test('reset forgets everything',async()=>{
      const s=await world();
      Fable.codex.noteFight(['goblin-minion']);Fable.codex.noteItems(['dagger']);Fable.codex.reset();
      assert.strictEqual(Fable.codex.metCount(),0);assert.deepStrictEqual(Fable.codex.foundIds(),[]);assert.ok(!('dicebound.codex.v1' in s.d));
    });
  });
};
