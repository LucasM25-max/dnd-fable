'use strict';
const assert=require('assert'),H=require('../harness');
function setup(){H.fresh();H.loadRules();return Fable.dice}
/* A fake random stream: each call returns the next value; faces map as value = (face-1)/sides + a little. */
function seq(...vals){let i=0;return()=>{if(i>=vals.length)throw new Error('ran out of fake randoms');return vals[i++]}}
const face=(f,sides)=>(f-0.5)/sides; /* the random that produces exactly face f on a die with that many sides */

module.exports=function({suite,test}){
  suite('dice parse',()=>{
    test('accepts the documented syntax',()=>{
      const D=setup();
      ['1d8','d20','D20','2d6+3','1d4-1','2d6+1d4+3','5','-3','+3','1d6 - 1d4 + -2','4d6kh3','2d20kl1','4d6dl1','4d6dh1','1d100','100d1000','4D6KH3',' 2d6 + 3 '].forEach(e=>
        assert.strictEqual(D.validate(e),null,e+' -> '+D.validate(e)));
    });
    test('parse result structure',()=>{
      const D=setup();
      const a=D.parse('2d6+1d4-3');
      assert.strictEqual(a.terms.length,3);
      assert.deepStrictEqual(JSON.parse(JSON.stringify(a.terms[0])),{type:'dice',sign:1,count:2,sides:6,keep:null});
      assert.deepStrictEqual(JSON.parse(JSON.stringify(a.terms[2])),{type:'flat',sign:-1,value:3});
      assert.deepStrictEqual(JSON.parse(JSON.stringify(D.parse('4d6dl1').terms[0].keep)),{mode:'h',n:3});
      assert.deepStrictEqual(JSON.parse(JSON.stringify(D.parse('4d6dh1').terms[0].keep)),{mode:'l',n:3});
      assert.deepStrictEqual(JSON.parse(JSON.stringify(D.parse('2d20kl').terms[0].keep)),{mode:'l',n:1});
      assert.strictEqual(D.parse('--3').terms[0].sign,1);
      assert.strictEqual(D.parse('1d6--1d4').terms[1].sign,1);
      assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.terms[0]));
      assert.strictEqual(D.parse('2d6+1d4-3'),a);
    });
    test('rejects bad input with a readable message',()=>{
      const D=setup();
      const bad={'':/empty/,'   ':/empty/,'d':/number of sides/,'2d':/number of sides/,'0d6':/between 1 and 100/,'101d6':/between 1 and 100/,
        '2d1':/between 2 and 1000/,'2d1001':/between 2 and 1000/,'2d6+':/after the operator/,'2d6 3':/expected \+ or -/,'abc':/expected a number or dice/,
        'kh':/expected a number or dice/,'2d6kh3':/between 1 and 2/,'2d6kh0':/between 1 and 2/,'2d6dl2':/between 1 and 1/,'1d6dl1':/between 1 and 0/,
        '2d6*2':/unexpected "\*"/,'1.5':/unexpected "\."|expected/,'1000001':/larger than/,'2d6d':/expected \+ or -/};
      Object.keys(bad).forEach(e=>{
        const m=D.validate(e);
        assert.ok(m&&bad[e].test(m),JSON.stringify(e)+' gave '+m);
      });
      assert.ok(/too long|longer than/.test(D.validate('1+'.repeat(150)+'1')));
      assert.ok(/more than 20 terms/.test(D.validate(Array(22).fill('1d4').join('+'))));
      assert.ok(/must be a string/.test(D.validate({})));
      assert.ok(/whole number/.test(D.validate(1.5)));
      assert.strictEqual(D.validate(4),null);
    });
    test('validate checks syntax around @references',()=>{
      const D=setup();
      assert.strictEqual(D.validate('1d10+@class.fighter.level'),null);
      assert.strictEqual(D.validate('@["x"]d6'),null);
      assert.ok(D.validate('@x d6'),'a space between a count and d is not allowed');
      assert.ok(D.validate('1d10+@'));
      assert.ok(D.validate('1d10+@x+'));
      assert.throws(()=>D.parse('1d6+@x'),/@references/);
    });
  });

  suite('dice roll',()=>{
    test('uses one random number per die and maps faces correctly',()=>{
      const D=setup();
      assert.strictEqual(D.roll('1d6',seq(0),{}).total,1);
      assert.strictEqual(D.roll('1d6',seq(0.9999999)).total,6);
      assert.strictEqual(D.roll('1d20',seq(face(13,20))).total,13);
      const r=D.roll('2d6+3',seq(face(4,6),face(5,6)));
      assert.strictEqual(r.total,12);
      assert.deepStrictEqual(r.terms[0].rolls,[4,5]);
      assert.strictEqual(r.terms[0].subtotal,9);
      assert.strictEqual(r.terms[1].subtotal,3);
      assert.strictEqual(r.expr,'2d6+3');
    });
    test('terms are rolled left to right with signs',()=>{
      const D=setup();
      const r=D.roll('1d8-1d4+2',seq(face(7,8),face(3,4)));
      assert.strictEqual(r.total,7-3+2);
      assert.strictEqual(r.terms[1].subtotal,-3);
      assert.strictEqual(D.roll('5',seq()).total,5);
      assert.strictEqual(D.roll(5,seq()).total,5);
      assert.strictEqual(D.roll(-2,seq()).total,-2);
      assert.throws(()=>D.roll(1.5,seq()),/whole number/);
    });
    test('keep and drop mark which dice count',()=>{
      const D=setup();
      let r=D.roll('4d6kh3',seq(face(2,6),face(6,6),face(1,6),face(4,6)));
      assert.strictEqual(r.total,12);
      assert.deepStrictEqual(r.terms[0].kept,[true,true,false,true]);
      r=D.roll('4d6dl1',seq(face(2,6),face(6,6),face(1,6),face(4,6)));
      assert.strictEqual(r.total,12);
      r=D.roll('2d20kl1',seq(face(15,20),face(4,20)));
      assert.strictEqual(r.total,4);
      assert.deepStrictEqual(r.terms[0].kept,[false,true]);
      r=D.roll('4d6dh1',seq(face(2,6),face(6,6),face(1,6),face(4,6)));
      assert.strictEqual(r.total,7);
    });
    test('ties keep the earlier die',()=>{
      const D=setup();
      const r=D.roll('3d6kh2',seq(face(5,6),face(5,6),face(5,6)));
      assert.deepStrictEqual(r.terms[0].kept,[true,true,false]);
      assert.strictEqual(r.total,10);
    });
    test('crit doubles dice but not flat numbers',()=>{
      const D=setup();
      const r=D.roll('1d4+2',seq(face(3,4),face(4,4)),{crit:true});
      assert.strictEqual(r.total,3+4+2);
      assert.strictEqual(r.terms[0].count,2);
      assert.strictEqual(r.crit,true);
      assert.strictEqual(D.roll('2d6+1d4+3',seq(...Array(6).fill(0)),{crit:true}).total,4+2+3);
    });
    test('minDie raises low dice (Great Weapon Fighting style)',()=>{
      const D=setup();
      const r=D.roll('2d6',seq(face(1,6),face(5,6)),{minDie:3});
      assert.deepStrictEqual(r.terms[0].rolls,[3,5]);
      assert.deepStrictEqual(r.terms[0].rawRolls,[1,5]);
      assert.strictEqual(r.total,8);
    });
    test('references resolve from the scope',()=>{
      const D=setup();
      const scope={class:{fighter:{level:3}}};
      const r=D.roll('1d10+@class.fighter.level',seq(face(6,10)),{scope});
      assert.strictEqual(r.total,9);
      assert.strictEqual(r.resolved,'1d10+3');
      assert.strictEqual(r.expr,'1d10+@class.fighter.level');
      assert.throws(()=>D.roll('1d10+@class.fighter.level',seq(0)),/no opts\.scope/);
      assert.throws(()=>D.roll('1d10+@x',seq(0),{scope:{x:1.5}}),/whole number/);
      assert.throws(()=>D.roll('1d10+@y',seq(0),{scope}),/unknown reference @y/);
    });
    test('refuses to roll without a random function or with a bad one',()=>{
      const D=setup();
      assert.throws(()=>D.roll('1d6'),/needs a random function/);
      assert.throws(()=>D.roll('1d6',()=>1),/expected a number from 0/);
      assert.throws(()=>D.roll('1d6',()=>-0.1),/expected a number from 0/);
      assert.throws(()=>D.roll('1d6',()=>NaN),/expected a number from 0/);
    });
    test('seeded rolls are reproducible',()=>{
      const D=setup();
      const a=Fable.rng(77),b=Fable.rng(77);
      for(let i=0;i<200;i++)assert.deepStrictEqual(D.roll('3d8+2',a),D.roll('3d8+2',b));
    });
    test('distribution is sane over many seeded rolls',()=>{
      const D=setup();
      const r=Fable.rng(2024),counts=[0,0,0,0,0,0,0];
      let sum=0;const N=60000;
      for(let i=0;i<N;i++){const v=D.roll('1d6',r).total;counts[v]++;sum+=v}
      assert.ok(Math.abs(sum/N-3.5)<0.03,'mean '+sum/N);
      for(let f=1;f<=6;f++)assert.ok(Math.abs(counts[f]/N-1/6)<0.01,'face '+f);
      assert.strictEqual(counts[0],0);
    });
  });

  suite('dice stats',()=>{
    test('min, max and average',()=>{
      const D=setup();
      assert.deepStrictEqual(D.stats('1d4+2'),{min:3,max:6,average:4.5}); /* Goblin Minion dagger, plan section 14 */
      assert.deepStrictEqual(D.stats('2d6'),{min:2,max:12,average:7});
      assert.deepStrictEqual(D.stats('1d8+3'),{min:4,max:11,average:7.5});
      assert.deepStrictEqual(D.stats('1d8-1d4'),{min:-3,max:7,average:2});
      assert.deepStrictEqual(D.stats('7'),{min:7,max:7,average:7});
    });
    test('keep modifiers use exact averages',()=>{
      const D=setup();
      const s=D.stats('4d6kh3');
      assert.strictEqual(s.min,3);assert.strictEqual(s.max,18);
      assert.ok(Math.abs(s.average-15869/1296)<1e-9);
      assert.ok(Math.abs(D.stats('2d20kh1').average-13.825)<1e-9);
      assert.ok(Math.abs(D.stats('2d20kl1').average-7.175)<1e-9);
      assert.throws(()=>D.stats('10d20kh5'),/too many combinations/);
    });
    test('crit and minDie change the numbers',()=>{
      const D=setup();
      assert.deepStrictEqual(D.stats('1d4+2',{crit:true}),{min:4,max:10,average:7});
      const g=D.stats('2d6',{minDie:3});
      assert.strictEqual(g.min,6);
      assert.ok(Math.abs(g.average-2*(3+3+3+4+5+6)/6)<1e-9);
    });
    test('stats agree with a big simulation',()=>{
      const D=setup();
      ['2d6+3','4d6kh3','1d12-1d4+1'].forEach(e=>{
        const st=D.stats(e),r=Fable.rng(Fable.rng.hash(e));
        let sum=0,lo=1e9,hi=-1e9;const N=40000;
        for(let i=0;i<N;i++){const v=D.roll(e,r).total;sum+=v;lo=Math.min(lo,v);hi=Math.max(hi,v)}
        assert.ok(Math.abs(sum/N-st.average)<0.1,e+' mean '+sum/N+' vs '+st.average);
        assert.ok(lo>=st.min&&hi<=st.max,e);
      });
    });
    test('stats accept scopes',()=>{
      const D=setup();
      assert.deepStrictEqual(D.stats('1d10+@lvl',{scope:{lvl:1}}),{min:2,max:11,average:6.5});
    });
  });

  suite('dice d20',()=>{
    test('normal, advantage and disadvantage',()=>{
      const D=setup();
      let r=D.d20(seq(face(14,20)),{bonus:5});
      assert.deepStrictEqual([r.natural,r.total,r.mode,r.rolls.length],[14,19,'normal',1]);
      r=D.d20(seq(face(4,20),face(17,20)),{mode:'advantage'});
      assert.deepStrictEqual([r.natural,r.rolls],[17,[4,17]]);
      r=D.d20(seq(face(4,20),face(17,20)),{mode:'disadvantage',bonus:-1});
      assert.deepStrictEqual([r.natural,r.total],[4,3]);
    });
    test('flags natural 20 and 1 without deciding what they mean',()=>{
      const D=setup();
      assert.strictEqual(D.d20(seq(face(20,20))).nat20,true);
      assert.strictEqual(D.d20(seq(face(1,20))).nat1,true);
      const r=D.d20(seq(face(19,20)));
      assert.strictEqual(r.nat20,false);assert.strictEqual(r.nat1,false);
    });
    test('rejects bad options',()=>{
      const D=setup();
      assert.throws(()=>D.d20(seq(0),{mode:'lucky'}),/mode must be/);
      assert.throws(()=>D.d20(seq(0),{bonus:1.5}),/whole number/);
      assert.throws(()=>D.d20(),/needs a random function/);
    });
    test('advantage and disadvantage cancel regardless of count',()=>{
      const D=setup();
      assert.strictEqual(D.rollState(0,0),'normal');
      assert.strictEqual(D.rollState(1,0),'advantage');
      assert.strictEqual(D.rollState(3,0),'advantage');
      assert.strictEqual(D.rollState(0,2),'disadvantage');
      assert.strictEqual(D.rollState(3,1),'normal');
      assert.strictEqual(D.rollState(['alert'],[]),'advantage');
      assert.strictEqual(D.rollState(['a','b'],['c']),'normal');
    });
  });

  suite('dice roller',()=>{
    test('binds a seeded stream and can save and restore it',()=>{
      const D=setup();
      const a=D.createRoller(1234),b=D.createRoller(1234);
      assert.deepStrictEqual(a.roll('2d6+1'),b.roll('2d6+1'));
      const s=a.getState(),x=a.roll('4d6kh3'),y=a.d20({mode:'advantage'});
      a.setState(s);
      assert.deepStrictEqual(a.roll('4d6kh3'),x);
      assert.deepStrictEqual(a.d20({mode:'advantage'}),y);
    });
    test('string seeds work and differ from each other',()=>{
      const D=setup();
      assert.deepStrictEqual(D.createRoller('fight-1').roll('10d20'),D.createRoller('fight-1').roll('10d20'));
      assert.notDeepStrictEqual(D.createRoller('fight-1').roll('10d20'),D.createRoller('fight-2').roll('10d20'));
    });
    test('accepts a custom random function and rejects nonsense',()=>{
      const D=setup();
      assert.strictEqual(D.createRoller(seq(0)).roll('1d6').total,1);
      assert.throws(()=>D.createRoller(seq(0)).getState(),/cannot report/);
      assert.throws(()=>D.createRoller(seq(0)).setState(1),/cannot restore/);
      assert.throws(()=>D.createRoller(),/needs a seed/);
      assert.throws(()=>D.createRoller(NaN),/needs a seed/);
    });
  });
};
