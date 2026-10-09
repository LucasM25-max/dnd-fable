'use strict';
const assert=require('assert'),H=require('../harness');
function setup(){H.fresh();H.loadRules();return Fable.formula}

module.exports=function({suite,test}){
  suite('formula',()=>{
    test('arithmetic, precedence, parentheses, unary signs',()=>{
      const F=setup();
      assert.strictEqual(F.evaluate('1+2*3'),7);
      assert.strictEqual(F.evaluate('(1+2)*3'),9);
      assert.strictEqual(F.evaluate('10-4-3'),3);
      assert.strictEqual(F.evaluate('8/4/2'),1);
      assert.strictEqual(F.evaluate('-3+5'),2);
      assert.strictEqual(F.evaluate('- -3'),3);
      assert.strictEqual(F.evaluate('+4'),4);
      assert.strictEqual(F.evaluate('  2 *  ( 3 + 4 ) '),14);
      assert.strictEqual(F.evaluate('1.5*2'),3);
      assert.strictEqual(F.evaluate('.5+.5'),1);
      assert.strictEqual(F.evaluate(7),7);
    });
    test('functions',()=>{
      const F=setup();
      assert.strictEqual(F.evaluate('floor((15-10)/2)'),2);
      assert.strictEqual(F.evaluate('floor((8-10)/2)'),-1);
      assert.strictEqual(F.evaluate('ceil(1.2)'),2);
      assert.strictEqual(F.evaluate('round(2.5)'),3);
      assert.strictEqual(F.evaluate('abs(-4)'),4);
      assert.strictEqual(F.evaluate('min(3,1,2)'),1);
      assert.strictEqual(F.evaluate('max(3, 1+5, 2)'),6);
      assert.throws(()=>F.evaluate('sqrt(4)'),/unknown function "sqrt"/);
      assert.throws(()=>F.evaluate('floor(1,2)'),/floor\(\) takes 1 argument/);
      assert.throws(()=>F.evaluate('floor'),/expected "\("/);
      assert.throws(()=>F.evaluate('max()'),/max\(\) takes at least 1 argument, got 0/);
    });
    test('references read the scope',()=>{
      const F=setup();
      const scope={abilities:{str:{score:17,mod:3},dex:{mod:2}},class:{fighter:{level:1},'blood-hunter':{level:4}},flag:true};
      assert.strictEqual(F.evaluate('10+@abilities.dex.mod',scope),12);
      assert.strictEqual(F.evaluate('@abilities.str.mod*2',scope),6);
      assert.strictEqual(F.evaluate('@class.fighter.level',scope),1);
      assert.strictEqual(F.evaluate('@class["blood-hunter"].level+1',scope),5);
      assert.strictEqual(F.evaluate("@['class']['fighter'].level",scope),1);
      assert.strictEqual(F.evaluate('@flag+1',scope),2);
    });
    test('unknown references fail loudly with the path',()=>{
      const F=setup();
      assert.throws(()=>F.evaluate('@abilities.wis.mod',{abilities:{str:{mod:1}}}),/unknown reference @abilities\.wis\.mod \(nothing at "abilities\.wis"\)/);
      assert.throws(()=>F.evaluate('@x',{}),/unknown reference @x/);
      assert.throws(()=>F.evaluate('@x',null),/unknown reference @x/);
      assert.throws(()=>F.evaluate('@x',{x:'text'}),/@x is not a finite number/);
      assert.throws(()=>F.evaluate('@x',{x:NaN}),/not a finite number/);
      assert.throws(()=>F.evaluate('@x.y',{x:5}),/unknown reference @x\.y/);
    });
    test('references cannot reach the prototype chain',()=>{
      const F=setup();
      assert.throws(()=>F.evaluate('@__proto__.x',{}),/unknown reference/);
      assert.throws(()=>F.evaluate('@constructor.length',{}),/unknown reference/);
      assert.throws(()=>F.evaluate('@toString',{}),/unknown reference/);
      assert.throws(()=>F.compile('__proto__'),/unknown function/);
    });
    test('syntax errors name the formula',()=>{
      const F=setup();
      assert.throws(()=>F.compile(''),/unexpected end of expression/);
      assert.throws(()=>F.compile('1+'),/unexpected end of expression/);
      assert.throws(()=>F.compile('(1'),/expected "\)"/);
      assert.throws(()=>F.compile('1 2'),/unexpected "2"/);
      assert.throws(()=>F.compile('1 $ 2'),/unexpected character "\$"/);
      assert.throws(()=>F.compile('@'),/malformed reference/);
      assert.throws(()=>F.compile('@a["b]'),/malformed reference|unexpected/);
      assert.throws(()=>F.compile('2d6'),/dice expressions are rolled with Fable\.dice/);
      assert.throws(()=>F.compile({}),/expected a string or number/);
      assert.throws(()=>F.compile('1+'),/Formula "1\+"/);
    });
    test('division by zero and non finite results throw',()=>{
      const F=setup();
      assert.throws(()=>F.evaluate('1/0'),/division by zero/);
      assert.throws(()=>F.evaluate('1/(2-2)'),/division by zero/);
      assert.throws(()=>F.evaluate('1e400'),/unexpected|not a finite/);
    });
    test('compile reports references and caches',()=>{
      const F=setup();
      const c=F.compile('@a.b + max(@c, 2) * -@["d-e"].f');
      assert.deepStrictEqual(c.refs.map(r=>r.text),['@a.b','@c','@["d-e"].f']);
      assert.deepStrictEqual(c.refs[2].path,['d-e','f']);
      assert.strictEqual(F.compile('@a.b + max(@c, 2) * -@["d-e"].f'),c);
      assert.strictEqual(c.evaluate({a:{b:1},c:5,'d-e':{f:2}}),-9);
    });
    test('refs, mapRefs and substitute work on dice strings',()=>{
      const F=setup();
      assert.deepStrictEqual(F.refs('1d10+@class.fighter.level').map(r=>r.text),['@class.fighter.level']);
      assert.deepStrictEqual(F.refs('2d6'),[]);
      assert.strictEqual(F.mapRefs('a @x b @y.z',r=>'<'+r.text+'>'),'a <@x> b <@y.z>');
      const scope={class:{fighter:{level:3}},neg:-2,half:1.5};
      assert.strictEqual(F.substitute('1d10+@class.fighter.level',scope),'1d10+3');
      assert.strictEqual(F.substitute('1d4+@neg',scope),'1d4+-2');
      assert.strictEqual(F.substitute('no refs',null),'no refs');
      assert.throws(()=>F.substitute('1d4+@half',scope,{integer:true}),/whole number/);
      assert.strictEqual(F.substitute('@half',scope),'1.5');
      assert.throws(()=>F.substitute('1d4+@x',null),/scope object is required/);
      assert.throws(()=>F.substitute('1d4+@',{}),/malformed reference/);
      assert.strictEqual(F.substitute('@["sneak-dice"]d6',{'sneak-dice':2}),'2d6');
    });
    test('formatRef round-trips awkward keys',()=>{
      const F=setup();
      assert.strictEqual(F.formatRef(['class','fighter','level']),'@class.fighter.level');
      assert.strictEqual(F.formatRef(['class','blood-hunter','level']),'@class["blood-hunter"].level');
    });
  });
};
