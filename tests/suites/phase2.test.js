'use strict';
const assert=require('assert'),H=require('../harness');

/* Value of an equipment option in copper: its items at catalogue price, plus the gold it hands out. */
function itemsCp(C,option,toolId){
  return option.items.reduce((sum,e)=>sum+C.items.get(e.item||toolId).costCp*e.qty,0);
}

module.exports=function({suite,test}){
  suite('phase 2: kinds',()=>{
    test('the new kinds exist and everything validates',async()=>{
      const C=await H.loadData();
      ['features','feats','species','backgrounds','classes','subclasses'].forEach(k=>assert.ok(C[k],k));
      assert.deepStrictEqual(C.validate().errors,[]);
    });
    test('the tutorial content is registered by ids',async()=>{
      const C=await H.loadData();
      assert.deepStrictEqual(C.species.ids(),['human']);
      assert.deepStrictEqual(C.backgrounds.ids(),['soldier']);
      assert.deepStrictEqual(C.classes.ids(),['fighter']);
      assert.deepStrictEqual(C.feats.ids().sort(),['alert','defense','savage-attacker']);
      assert.strictEqual(C.subclasses.size(),0);
    });
    test('every Phase 2 definition carries the srd52 source tag and is frozen',async()=>{
      const C=await H.loadData();
      ['features','feats','species','backgrounds','classes'].forEach(k=>C[k].list().forEach(d=>assert.strictEqual(d.source,'srd52',k+' '+d.id)));
      assert.throws(()=>{'use strict';C.classes.get('fighter').hitDie=12},TypeError);
      assert.throws(()=>{'use strict';C.feats.get('defense').effects[0].value=5},TypeError);
    });
    test('the SRD source filter keeps all of it, and an "original" filter drops it without errors of its own',async()=>{
      assert.deepStrictEqual((await H.loadData({sources:['srd52']})).validate().errors,[]);
      const C=await H.loadData({sources:['original']});
      assert.strictEqual(C.classes.size(),0);
      assert.strictEqual(C.features.size(),0);
      assert.deepStrictEqual(C.validate().errors,[]);
    });
  });

  suite('phase 2: Human',()=>{
    test('size, speed, type and traits match the SRD',async()=>{
      const h=(await H.loadData()).species.get('human');
      assert.strictEqual(h.creatureType,'Humanoid');
      assert.deepStrictEqual(h.size,{choose:['Medium','Small']});
      assert.strictEqual(h.speed,30);
      assert.deepStrictEqual(h.features,['human-resourceful','human-skillful','human-versatile']);
    });
    test('languages: Common fixed plus two standard languages (Common itself is not offered)',async()=>{
      const C=await H.loadData();
      const l=C.species.get('human').languages;
      assert.deepStrictEqual(l.fixed,['common']);
      assert.strictEqual(l.choose.count,2);
      const opts=C.choiceOptions(l.choose.from).map(o=>o.id);
      assert.strictEqual(opts.length,9);
      assert.ok(opts.includes('dwarvish')&&opts.includes('elvish')&&!opts.includes('common')&&!opts.includes('abyssal'));
    });
    test('Resourceful refills Heroic Inspiration on a long rest; the pool holds one',async()=>{
      const C=await H.loadData();
      const r=C.features.get('human-resourceful'),hi=C.features.get('heroic-inspiration');
      assert.deepStrictEqual(r.grants.features,['heroic-inspiration']);
      assert.deepStrictEqual(r.onRest,[{rest:'long',restore:{resource:'heroic-inspiration',amount:'max'}}]);
      assert.strictEqual(hi.resources[0].max,1);
      assert.strictEqual(hi.actions[0].cost,'free');
      assert.deepStrictEqual(hi.actions[0].consumes,{resource:'heroic-inspiration',amount:1});
    });
    test('Skillful offers all 18 skills and Versatile offers the Origin feats',async()=>{
      const C=await H.loadData();
      const sk=C.features.get('human-skillful').choices[0],vs=C.features.get('human-versatile').choices[0];
      assert.strictEqual(C.choiceOptions(sk.from).length,18);
      assert.deepStrictEqual(C.choiceOptions(vs.from).map(f=>f.id).sort(),['alert','savage-attacker']);
      assert.ok(sk.excludeOwned&&vs.excludeOwned);
    });
  });

  suite('phase 2: Soldier',()=>{
    test('abilities, feat, skills and tool choice match the SRD',async()=>{
      const C=await H.loadData();
      const s=C.backgrounds.get('soldier');
      assert.deepStrictEqual(s.abilityScoreOptions,['str','dex','con']);
      assert.strictEqual(s.originFeat,'savage-attacker');
      assert.deepStrictEqual(s.skills,['athletics','intimidation']);
      assert.deepStrictEqual(C.choiceOptions(s.tool.choose.from).map(t=>t.id).sort(),['dice-set','dragonchess-set','playing-cards-set','three-dragon-ante-set']);
      assert.ok(C.tools.has('dice-set'));
    });
    test('equipment: option A kit is worth no more than the 50 GP of option B for every gaming set',async()=>{
      const C=await H.loadData();
      const s=C.backgrounds.get('soldier'),a=s.startingEquipment.options[0],b=s.startingEquipment.options[1];
      assert.strictEqual(b.gold.gp,50);
      assert.strictEqual(b.items.length,0);
      assert.strictEqual(a.gold.gp,14);
      assert.ok(a.items.some(e=>e.fromChoice==='tool'));
      C.tools.filter(t=>t.category==='gaming-set').forEach(t=>{
        assert.ok(itemsCp(C,a,t.id)+Fable.money.toCp(a.gold)<=Fable.money.toCp(b.gold),t.id);
      });
    });
  });

  suite('phase 2: Fighter',()=>{
    test('core traits match the SRD',async()=>{
      const f=(await H.loadData()).classes.get('fighter');
      assert.strictEqual(f.hitDie,10);
      assert.deepStrictEqual(f.primaryAbility,['str','dex']);
      assert.deepStrictEqual(f.savingThrows,['str','con']);
      assert.strictEqual(f.skills.count,2);
      assert.deepStrictEqual(f.skills.from.slice().sort(),['acrobatics','animal-handling','athletics','history','insight','intimidation','perception','persuasion','survival']);
      assert.deepStrictEqual(f.armorTraining,['light','medium','heavy','shield']);
      assert.deepStrictEqual(f.weaponProficiency,['simple','martial']);
    });
    test('starting equipment: A and B are worth exactly the 155 GP of C',async()=>{
      const C=await H.loadData();
      const [a,b,c]=C.classes.get('fighter').startingEquipment.options;
      assert.strictEqual(c.gold.gp,155);
      const total=o=>itemsCp(C,o)+Fable.money.toCp(o.gold||{gp:0});
      assert.strictEqual(total(a),15500);
      assert.strictEqual(total(b),15500);
      assert.strictEqual(total(c),15500);
      assert.deepStrictEqual(a.items.filter(e=>e.item==='javelin'),[{item:'javelin',qty:8}]);
    });
    test('the tutorial budget: Fighter C (155 GP) plus Soldier B (50 GP) is 205 GP',async()=>{
      const C=await H.loadData();
      const gp=Fable.money.toCp(C.classes.get('fighter').startingEquipment.options[2].gold)+Fable.money.toCp(C.backgrounds.get('soldier').startingEquipment.options[1].gold);
      assert.strictEqual(gp,20500);
    });
    test('level 1 grants Fighting Style, Second Wind and Weapon Mastery',async()=>{
      const f=(await H.loadData()).classes.get('fighter');
      assert.deepStrictEqual(f.features[1],['fighter-fighting-style','second-wind','weapon-mastery']);
      assert.strictEqual(f.implementedLevel,1);
    });
    test('the level table runs to 20 and matches the SRD Fighter Features table',async()=>{
      const f=(await H.loadData()).classes.get('fighter');
      assert.deepStrictEqual(Object.keys(f.features).map(Number),Array.from({length:20},(_,i)=>i+1));
      const C=Fable.content,names=lv=>f.features[lv].map(id=>C.features.get(id).name);
      assert.deepStrictEqual(names(2),['Action Surge','Tactical Mind']);
      assert.deepStrictEqual(names(5),['Extra Attack','Tactical Shift']);
      assert.deepStrictEqual(names(9),['Indomitable','Tactical Master']);
      assert.deepStrictEqual(names(11),['Two Extra Attacks']);
      assert.deepStrictEqual(names(13),['Indomitable','Studied Attacks']);
      assert.deepStrictEqual(names(17),['Action Surge','Indomitable']);
      assert.deepStrictEqual(names(19),['Epic Boon']);
      assert.deepStrictEqual(names(20),['Three Extra Attacks']);
      [4,6,8,12,14,16].forEach(lv=>assert.deepStrictEqual(names(lv),['Ability Score Improvement']));
      [7,10,15,18].forEach(lv=>assert.deepStrictEqual(names(lv),['Fighter Subclass Feature']));
      assert.deepStrictEqual(names(3),['Fighter Subclass']);
    });
    test('only the level 1 features are implemented; every later one is a labelled stub',async()=>{
      const C=await H.loadData(),f=C.classes.get('fighter');
      Object.keys(f.features).forEach(lv=>f.features[lv].forEach(id=>{
        const feat=C.features.get(id);
        assert.strictEqual(feat.status==='stub',Number(lv)>f.implementedLevel,id+' at level '+lv);
      }));
      assert.strictEqual(C.features.filter(x=>x.status==='stub').length,13);
    });
    test('Fighting Style offers every Fighting Style feat and recommends Defense',async()=>{
      const C=await H.loadData();
      const c=C.features.get('fighter-fighting-style').choices[0];
      assert.deepStrictEqual(C.choiceOptions(c.from).map(f=>f.id),['defense']);
      assert.strictEqual(c.recommended,'defense');
      assert.strictEqual(c.changeOn,'level-up');
      assert.deepStrictEqual(C.features.get('fighter-fighting-style').tags,['fighting-style']);
    });
    test('Second Wind: bonus action, 1d10 + Fighter level, 2 uses rising to 3 and 4',async()=>{
      const C=await H.loadData(),sw=C.features.get('second-wind');
      const a=sw.actions[0];
      assert.strictEqual(a.cost,'bonus');
      assert.deepStrictEqual(a.effects,[{type:'heal',target:'self',amount:'1d10+@class.fighter.level'}]);
      assert.deepStrictEqual(a.consumes,{resource:'second-wind-uses',amount:1});
      const r=sw.resources[0],at=n=>C.valueAtLevel(r.max,{fighter:n});
      assert.deepStrictEqual([1,3,4,9,10,20].map(at),[2,2,3,3,4,4]);
      assert.deepStrictEqual(r.recharge,{short:1,long:'all'});
      /* The heal formula resolves against a sheet scope. */
      const rolled=Fable.dice.roll(a.effects[0].amount,()=>0.999,{scope:{class:{fighter:{level:1}}}});
      assert.strictEqual(rolled.total,11);
    });
    test('Weapon Mastery: 3 weapons rising to 4, 5 and 6, from Simple and Martial weapons, changeable after a long rest',async()=>{
      const C=await H.loadData(),c=C.features.get('weapon-mastery').choices[0];
      assert.deepStrictEqual([1,3,4,9,10,15,16,20].map(n=>C.valueAtLevel(c.pick,{fighter:n})),[3,3,4,4,5,5,6,6]);
      const opts=C.choiceOptions(c.from);
      assert.strictEqual(opts.length,38);
      ['longsword','dagger','javelin'].forEach(id=>assert.ok(opts.some(o=>o.id===id),id));
      assert.strictEqual(c.changeOn,'long-rest');
      assert.strictEqual(c.changeLimit,1);
    });
    test('the three tutorial mastery weapons carry Sap, Nick and Slow',async()=>{
      const C=await H.loadData();
      assert.deepStrictEqual(['longsword','dagger','javelin'].map(id=>C.items.get(id).mastery),['sap','nick','slow']);
    });
  });

  suite('phase 2: feats',()=>{
    test('Defense: +1 AC only while wearing light, medium or heavy armor (not a shield alone)',async()=>{
      const C=await H.loadData(),d=C.feats.get('defense');
      assert.strictEqual(d.category,'fighting-style');
      assert.deepStrictEqual(d.prerequisite,{featureTag:'fighting-style'});
      assert.deepStrictEqual(d.effects,[{type:'modifier',stat:'ac',op:'add',value:1,when:{wearing:['light','medium','heavy']},label:'Defense'}]);
      assert.strictEqual(d.repeatable,false);
    });
    test('Alert adds the proficiency bonus to Initiative and swaps Initiative',async()=>{
      const C=await H.loadData(),a=C.feats.get('alert');
      assert.strictEqual(a.category,'origin');
      assert.strictEqual(a.prerequisite,null);
      assert.deepStrictEqual(a.effects[0],{type:'modifier',stat:'initiative',op:'add',value:'@proficiencyBonus',label:'Alert'});
      assert.strictEqual(Fable.formula.evaluate(a.effects[0].value,{proficiencyBonus:Fable.tables.proficiencyBonus(1)}),2);
      assert.strictEqual(a.effects[1].event,'onInitiative');
    });
    test('Savage Attacker: once per turn, a resource that recharges every turn',async()=>{
      const C=await H.loadData(),s=C.feats.get('savage-attacker');
      assert.strictEqual(s.category,'origin');
      assert.deepStrictEqual(s.resources,[{id:'savage-attacker',max:1,recharge:{turn:'all'}}]);
      assert.strictEqual(s.effects[0].oncePerTurn,true);
      assert.strictEqual(s.effects[0].event,'onDamageRoll');
    });
  });

  suite('phase 2: data helpers',()=>{
    test('valueAtLevel reads numbers, steps through tables and rejects nonsense',async()=>{
      const C=await H.loadData();
      assert.strictEqual(C.valueAtLevel(3,{}),3);
      const t={byClassLevel:{fighter:{2:1,5:2}}};
      assert.deepStrictEqual([1,2,4,5,9].map(n=>C.valueAtLevel(t,{fighter:n})),[0,1,1,2,2]);
      assert.strictEqual(C.valueAtLevel(t,{rogue:5}),0);
      assert.throws(()=>C.valueAtLevel({byClassLevel:{}},{}),/expected a number/);
    });
    test('choiceOptions filters by ids, exclude and field values, and rejects unknown kinds',async()=>{
      const C=await H.loadData();
      assert.deepStrictEqual(C.choiceOptions({kind:'feats',ids:['alert','defense']}).map(f=>f.id),['alert','defense']);
      assert.deepStrictEqual(C.choiceOptions({kind:'feats',category:['origin','fighting-style'],exclude:['alert']}).map(f=>f.id).sort(),['defense','savage-attacker']);
      assert.strictEqual(C.choiceOptions({kind:'skills',ability:'wis'}).length,5);
      assert.throws(()=>C.choiceOptions({kind:'nope'}),/unknown kind/);
    });
  });

  suite('phase 2: mistakes fail loudly',()=>{
    async function world(){return H.loadData()}
    test('feature shape errors are caught at registration',async()=>{
      const C=await world();
      const f=(x)=>C.features.register(Object.assign({id:'x-'+Math.random().toString(36).slice(2,8),name:'X',source:'t',description:'d'},x));
      assert.throws(()=>f({description:''}),/description/);
      assert.throws(()=>f({status:'done'}),/status/);
      assert.throws(()=>f({resources:[{id:'r',max:0}]}),/max/);
      assert.throws(()=>f({resources:[{id:'r',max:1,recharge:{hourly:1}}]}),/hourly/);
      assert.throws(()=>f({actions:[{id:'a',name:'A',cost:'minute',effects:[{type:'heal',target:'self',amount:'1d4'}]}]}),/cost/);
      assert.throws(()=>f({actions:[{id:'a',name:'A',cost:'action',effects:[{type:'heal',target:'self',amount:'1d'}]}]}),/not valid dice/);
      assert.throws(()=>f({effects:[{type:'modifier',stat:'luck',op:'add',value:1}]}),/stat/);
      assert.throws(()=>f({effects:[{type:'modifier',stat:'ac',op:'multiply',value:1}]}),/op/);
      assert.throws(()=>f({effects:[{type:'modifier',stat:'ac',op:'add',value:'1 +'}]}),/formula/);
      assert.throws(()=>f({effects:[{type:'modifier',stat:'ac',op:'add',value:1,when:{sleeping:true}}]}),/unknown condition/);
      assert.throws(()=>f({effects:[{type:'handler',handler:'nodot',event:'onHit'}]}),/handler/);
      assert.throws(()=>f({effects:[{type:'handler',handler:'feat.x',event:'onNothing'}]}),/event/);
      assert.throws(()=>f({choices:[{id:'c',pick:0,from:{kind:'feats'}}]}),/pick/);
      assert.throws(()=>f({choices:[{id:'c',pick:1,from:{}}]}),/from/);
      assert.throws(()=>f({choices:[{id:'c',pick:1,from:{kind:'feats'},changeLimit:1}]}),/changeOn/);
      assert.throws(()=>f({grants:{spells:['x']}}),/unknown key/);
      assert.throws(()=>f({onRest:[{rest:'weekly',restore:{resource:'r',amount:'max'}}]}),/rest/);
    });
    test('broken references and empty choice sources are reported by validate',async()=>{
      const C=await world();
      C.features.register({id:'bad-grant',name:'B',source:'t',description:'d',grants:{skills:['juggling'],features:['no-such']}});
      C.features.register({id:'bad-consume',name:'B',source:'t',description:'d',actions:[{id:'a',name:'A',cost:'bonus',consumes:{resource:'no-pool',amount:1},effects:[{type:'heal',target:'self',amount:'1d4'}]}]});
      C.features.register({id:'bad-choice',name:'B',source:'t',description:'d',choices:[{id:'c',pick:2,from:{kind:'feats',category:'epic-boon'}}]});
      C.features.register({id:'bad-kind',name:'B',source:'t',description:'d',choices:[{id:'c',pick:1,from:{kind:'nothing'}}]});
      C.features.register({id:'bad-recommend',name:'B',source:'t',description:'d',choices:[{id:'c',pick:1,from:{kind:'feats',category:'origin'},recommended:'defense'}]});
      C.features.register({id:'dup-pool',name:'B',source:'t',description:'d',resources:[{id:'second-wind-uses',max:1}]});
      C.features.register({id:'bad-class',name:'B',source:'t',description:'d',resources:[{id:'odd-pool',max:{byClassLevel:{wizard:{1:1}}}}]});
      const text=C.validate().errors.join('\n');
      assert.match(text,/Feature "bad-grant".*unknown Skill "juggling"/);
      assert.match(text,/Feature "bad-grant".*unknown Feature "no-such"/);
      assert.match(text,/Feature "bad-consume".*unknown resource "no-pool"/);
      assert.match(text,/Feature "bad-choice".*offers 0 option\(s\) but 2 must be picked/);
      assert.match(text,/Feature "bad-kind".*"nothing" is not a known kind/);
      assert.match(text,/Feature "bad-recommend".*"defense" is not one of the options/);
      assert.match(text,/Feature "dup-pool".*already defined by features:second-wind/);
      assert.match(text,/Feature "bad-class".*unknown Class "wizard"/);
    });
    test('feat rules: category, prerequisites and Fighting Style tags',async()=>{
      const C=await world();
      const f=(x)=>C.feats.register(Object.assign({id:'f-'+Math.random().toString(36).slice(2,8),name:'F',source:'t',description:'d',category:'general'},x));
      assert.throws(()=>f({category:'racial'}),/category/);
      assert.throws(()=>f({category:'fighting-style'}),/prerequisite/);
      assert.throws(()=>f({prerequisite:{}}),/at least one requirement/);
      assert.throws(()=>f({prerequisite:{mood:'happy'}}),/unknown requirement/);
      assert.throws(()=>f({prerequisite:{level:21}}),/level/);
      assert.throws(()=>f({repeatable:'yes'}),/repeatable/);
      C.feats.register({id:'tagged',name:'T',source:'t',description:'d',category:'general',prerequisite:{featureTag:'no-such-tag',abilityScore:{luck:13},feats:['no-feat']}});
      const text=C.validate().errors.join('\n');
      assert.match(text,/Feat "tagged".*featureTag "no-such-tag" is not carried by any feature/);
      assert.match(text,/Feat "tagged".*unknown Ability "luck"/);
      assert.match(text,/Feat "tagged".*unknown Feat "no-feat"/);
    });
    test('species, background, class and subclass rules',async()=>{
      const C=await world();
      const sp=(x)=>C.species.register(Object.assign({id:'s-'+Math.random().toString(36).slice(2,8),name:'S',source:'t',description:'d',creatureType:'Humanoid',size:'Medium',speed:30,features:['human-skillful'],languages:{fixed:['common']}},x));
      assert.throws(()=>sp({size:'Colossal'}),/size/);
      assert.throws(()=>sp({size:{choose:['Small']}}),/size/);
      assert.throws(()=>sp({speed:32}),/multiple of 5/);
      assert.throws(()=>sp({features:[]}),/features/);
      assert.throws(()=>sp({languages:{fixed:['common'],choose:{count:0,from:{kind:'languages'}}}}),/count/);
      assert.throws(()=>sp({senses:{darkvision:0}}),/senses/);
      const bg=(x)=>C.backgrounds.register(Object.assign({id:'b-'+Math.random().toString(36).slice(2,8),name:'B',source:'t',description:'d',abilityScoreOptions:['str','dex','con'],originFeat:'alert',skills:['athletics','insight'],tool:{fixed:'dice-set'},startingEquipment:{options:[{id:'a',items:[],gold:{gp:50}}]}},x));
      assert.throws(()=>bg({abilityScoreOptions:['str','str','con']}),/abilityScoreOptions/);
      assert.throws(()=>bg({skills:['athletics']}),/two different skill/);
      assert.throws(()=>bg({tool:{}}),/tool/);
      assert.throws(()=>bg({startingEquipment:{options:[{id:'a',items:[{fromChoice:'tool',qty:1}]}]}}),/needs an item id/);
      assert.throws(()=>bg({startingEquipment:{options:[{id:'a',items:[]}]}}),/gives nothing/);
      assert.throws(()=>bg({startingEquipment:{options:[{id:'a',items:[],gold:{gp:1}},{id:'a',items:[],gold:{gp:2}}]}}),/repeats the option id/);
      bg({originFeat:'defense'});
      const cl=(x)=>C.classes.register(Object.assign({},C.classes.get('fighter'),{id:'c-'+Math.random().toString(36).slice(2,8),name:'C',source:'t'},x));
      assert.throws(()=>cl({hitDie:7}),/hitDie/);
      assert.throws(()=>cl({savingThrows:['str']}),/savingThrows/);
      assert.throws(()=>cl({spellcasting:{}}),/reserved/);
      assert.throws(()=>cl({features:{2:['second-wind']}}),/level 1/);
      assert.throws(()=>cl({features:{1:['second-wind'],21:['second-wind']}}),/bad level/);
      assert.throws(()=>cl({implementedLevel:0}),/implementedLevel/);
      assert.throws(()=>C.subclasses.register({id:'sc',name:'SC',source:'t',description:'d',class:'fighter',features:{}}),/features/);
      const t=C.validate().errors.join('\n');
      assert.match(t,/Background "b-[a-z0-9]+": originFeat "defense" must be an Origin feat/);
      cl({implementedLevel:2});
      assert.match(C.validate().errors.join('\n'),/is a stub but the class says level 2 is implemented/);
    });
    test('a subclass must be listed by its class, and belong to it',async()=>{
      const C=await world();
      C.features.register({id:'sc-feat',name:'F',source:'t',description:'d'});
      C.subclasses.register({id:'champion',name:'Champion',source:'t',description:'d',class:'fighter',features:{3:['sc-feat']}});
      assert.match(C.validate().errors.join('\n'),/subclass "champion" belongs to this class but is not listed/);
    });
    test('an unknown skill in the class list or a missing starting item is reported',async()=>{
      const C=await world();
      C.classes.register(Object.assign({},C.classes.get('fighter'),{id:'odd',name:'Odd',source:'t',
        skills:{count:1,from:['juggling']},startingEquipment:{options:[{id:'a',items:[{item:'sword-of-bugs',qty:1}]}]}}));
      const t=C.validate().errors.join('\n');
      assert.match(t,/Class "odd".*unknown Skill "juggling"/);
      assert.match(t,/Class "odd".*unknown Item "sword-of-bugs"/);
    });
  });
};
