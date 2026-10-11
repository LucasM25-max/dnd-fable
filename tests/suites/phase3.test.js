'use strict';
const assert=require('assert'),H=require('../harness');

/* A world with the real rules and content (no Three.js) plus the real premade hero definition. */
async function world(){
  const C=await H.loadData();
  Fable.createHumanFighter=function(){};
  H.runFile('js/content/characters/human-fighter/definition.js');
  return C;
}
function heroBuild(C,edit){
  const b=JSON.parse(JSON.stringify(C.characters.get('human-fighter').build));
  if(edit)edit(b);
  return b;
}
/* Every stat-like object of a sheet whose breakdown must add up to its value. */
function statObjects(sheet){
  const out=[];
  Object.keys(sheet.stats).forEach(k=>out.push([k,sheet.stats[k]]));
  Object.keys(sheet.abilities).forEach(k=>out.push(['ability '+k,sheet.abilities[k]]));
  Object.keys(sheet.saves).forEach(k=>out.push(['save '+k,sheet.saves[k]]));
  Object.keys(sheet.skills).forEach(k=>out.push(['skill '+k,sheet.skills[k]]));
  out.push(['carrying capacity',sheet.carrying.capacity]);
  sheet.attacks.forEach(a=>{out.push([a.id+' attack',a.bonus]);out.push([a.id+' damage',a.damage.bonus])});
  return out;
}
const sum=b=>b.reduce((n,e)=>n+e.value,0);
/* A class with little training, to prove the sheet follows data and not the Fighter. */
function addTester(C){
  C.features.register({id:'tester-feature',name:'Tester Feature',source:'original',description:'Nothing special.'});
  C.classes.register({id:'tester',name:'Tester',source:'original',description:'A class for tests.',hitDie:6,primaryAbility:['dex'],
    savingThrows:['dex','int'],skills:{count:2,from:['stealth','arcana','history']},armorTraining:['light'],weaponProficiency:['simple'],
    startingEquipment:{options:[{id:'a',items:[],gold:{gp:10}}]},features:{1:['tester-feature']},implementedLevel:1,subclasses:[],spellcasting:null});
}
function testerBuild(C,edit){
  return heroBuild(C,b=>{
    b.classLevels=[{class:'tester',level:1,hp:'max'}];
    delete b.choices['fighter:skills'];delete b.choices['fighter-fighting-style:style'];delete b.choices['weapon-mastery:weapons'];
    b.choices['tester:skills']=['stealth','arcana'];
    b.resources={};
    if(edit)edit(b);
  });
}
const codes=s=>s.issues.map(i=>i.code);

module.exports=function({suite,test}){
  suite('phase 3: stat pipeline',()=>{
    test('base, set, add, min and max apply in a fixed order and the breakdown adds up',async()=>{
      await world();
      const r=Fable.stats.reduce([
        {label:'Shield',op:'add',value:2},{label:'Chain Mail',op:'base',value:16},{label:'Defense',op:'add',value:1},
        {label:'Floor',op:'min',value:5},{label:'Cap',op:'max',value:30}
      ]);
      assert.strictEqual(r.value,19);
      assert.deepStrictEqual(r.breakdown.map(b=>b.label),['Chain Mail','Shield','Defense']);
      assert.strictEqual(sum(r.breakdown),19);
      assert.strictEqual(Fable.stats.explain(r),'Chain Mail 16 + Shield 2 + Defense 1 = 19');
    });
    test('the highest base wins and the others are listed as ignored',async()=>{
      await world();
      const r=Fable.stats.reduce([{label:'Unarmored',op:'base',value:12},{label:'Better formula',op:'base',value:14},{label:'Ring',op:'add',value:1}]);
      assert.strictEqual(r.value,15);
      assert.strictEqual(r.ignored.length,1);
      assert.strictEqual(r.ignored[0].label,'Unarmored');
    });
    test('set replaces the base (the last set wins) and adds still apply after it',async()=>{
      await world();
      const r=Fable.stats.reduce([{label:'Base',op:'base',value:30},{label:'Grappled',op:'set',value:0},{label:'Stuck',op:'set',value:5},{label:'Boots',op:'add',value:10}]);
      assert.strictEqual(r.value,15);
      assert.deepStrictEqual(r.breakdown.map(b=>b.label),['Stuck','Boots']);
      assert.strictEqual(sum(r.breakdown),15);
      assert.strictEqual(r.ignored.length,2);
    });
    test('a min or max that changes the value shows up as an adjustment, so the sum still holds',async()=>{
      await world();
      const low=Fable.stats.reduce([{label:'Base',op:'base',value:3},{label:'Curse',op:'add',value:-5},{label:'At least 0',op:'min',value:0}]);
      assert.strictEqual(low.value,0);assert.strictEqual(sum(low.breakdown),0);
      assert.strictEqual(low.breakdown[low.breakdown.length-1].op,'min');
      const high=Fable.stats.reduce([{label:'Base',op:'base',value:19},{label:'Boon',op:'add',value:3},{label:'Cap',op:'max',value:20}]);
      assert.strictEqual(high.value,20);assert.strictEqual(sum(high.breakdown),20);
      const untouched=Fable.stats.reduce([{label:'Base',op:'base',value:10},{label:'Cap',op:'max',value:20}]);
      assert.strictEqual(untouched.breakdown.length,1);
    });
    test('malformed contributions are a programming error and throw',async()=>{
      await world();
      assert.throws(()=>Fable.stats.reduce([{label:'x',op:'times',value:2}]),/unknown op/);
      assert.throws(()=>Fable.stats.reduce([{label:'x',op:'add',value:NaN}]),/finite number/);
      assert.throws(()=>Fable.stats.reduce([{op:'add',value:1}]),/needs a label/);
      assert.throws(()=>Fable.stats.reduce('no'),/list of contributions/);
    });
    test('"when" understands wearing and rejects unknown conditions',async()=>{
      await world();
      const w={wearing:['light','medium','heavy']};
      assert.strictEqual(Fable.stats.when(w,{wearing:['heavy','shield']}),true);
      assert.strictEqual(Fable.stats.when(w,{wearing:['shield']}),false,'a Shield alone is not armor');
      assert.strictEqual(Fable.stats.when(w,{wearing:[]}),false);
      assert.strictEqual(Fable.stats.when(undefined,{}),true);
      assert.throws(()=>Fable.stats.when({moon:'full'},{}),/unknown condition/);
    });
    test('advantage and disadvantage cancel out however many sources there are',async()=>{
      await world();
      assert.strictEqual(Fable.stats.rollState(['a'],[]).state,'advantage');
      assert.strictEqual(Fable.stats.rollState([],['a','b']).state,'disadvantage');
      assert.strictEqual(Fable.stats.rollState(['a','b'],['c']).state,'normal');
      assert.deepStrictEqual(Fable.stats.rollState(['a','a'],[]).advantage,['a']);
      assert.strictEqual(Fable.stats.signed(5),'+5');assert.strictEqual(Fable.stats.signed(-1),'-1');assert.strictEqual(Fable.stats.signed(0),'+0');
    });
  });

  suite('phase 3: build records',()=>{
    test('create fills in every optional field and starts at the current version',async()=>{
      await world();
      const b=Fable.character.create({name:'Test',species:'human',background:'soldier',class:'fighter'});
      assert.strictEqual(b.v,Fable.character.CURRENT_VERSION);
      assert.deepStrictEqual(b.classLevels,[{class:'fighter',level:1,hp:'max'}]);
      assert.deepStrictEqual([b.choices,b.inventory,b.equipped,b.currency,b.resources,b.hitDiceUsed,b.hpCurrent],[{},[],{},{},{},{},null]);
    });
    test('normalize and migrate return copies and never change the input',async()=>{
      const C=await world();
      const b=heroBuild(C),before=JSON.stringify(b);
      const n=Fable.character.normalize(b);
      n.choices.x='y';n.inventory.push({item:'dagger',qty:9});
      assert.strictEqual(JSON.stringify(b),before);
      assert.notStrictEqual(Fable.character.migrate(b),b);
    });
    test('serialize and parse round trip, and bad text is a clear error',async()=>{
      const C=await world();
      const b=Fable.character.normalize(heroBuild(C));
      assert.deepStrictEqual(Fable.character.parse(Fable.character.serialize(b)),b);
      assert.throws(()=>Fable.character.parse('{nope'),/not valid JSON/);
    });
    test('records without a version, from the future or from a missing migration are refused',async()=>{
      const C=await world();
      assert.throws(()=>Fable.character.migrate({}),/no valid version/);
      assert.throws(()=>Fable.character.migrate(null),/must be an object/);
      assert.throws(()=>Fable.character.migrate(Object.assign(heroBuild(C),{v:99})),/newer than this game/);
      Fable.character.CURRENT_VERSION=3;
      assert.throws(()=>Fable.character.migrate(heroBuild(C)),/no migration from build version 1/);
    });
    test('migrations run in order and renamed ids are applied',async()=>{
      const C=await world();
      Fable.character.CURRENT_VERSION=3;
      Fable.character.migrations[1]=r=>Object.assign(r,{v:2,name:r.name+'!'});
      Fable.character.migrations[2]=r=>Object.assign(r,{v:3});
      Fable.character.renamedIds.items={'old-sword':'longsword'};
      const old=heroBuild(C,b=>{b.inventory.push({item:'old-sword',qty:1});b.equipped.mainhand='old-sword'});
      const m=Fable.character.migrate(old);
      assert.strictEqual(m.v,3);assert.strictEqual(m.name,'Aldric!');
      assert.strictEqual(m.equipped.mainhand,'longsword');
      assert.ok(m.inventory.some(e=>e.item==='longsword'));
    });
    test('choice keys follow "<source>:<choice>", with a counter for repeated features',async()=>{
      await world();
      assert.strictEqual(Fable.character.choiceKey('human-versatile','feat'),'human-versatile:feat');
      assert.strictEqual(Fable.character.choiceKey('ability-score-improvement','feat',1),'ability-score-improvement:feat');
      assert.strictEqual(Fable.character.choiceKey('ability-score-improvement','feat',2),'ability-score-improvement#2:feat');
      assert.throws(()=>Fable.character.choiceKey('','x'),/needs a source id/);
    });
    test('the shape check finds malformed records without looking at content',async()=>{
      const C=await world();
      const bad=(edit)=>Fable.character.checkRecord(Fable.character.normalize(heroBuild(C,edit))).map(i=>i.code);
      assert.deepStrictEqual(bad(),[]);
      assert.ok(bad(b=>{b.name=''}).includes('missing-name'));
      assert.ok(bad(b=>{b.classLevels=[]}).includes('no-class'));
      assert.ok(bad(b=>{b.classLevels[0].level=21}).includes('bad-class-level'));
      assert.ok(bad(b=>{b.classLevels=[{class:'fighter',level:12,hp:'max'},{class:'wizard',level:9,hp:'max'}]}).includes('level-cap'));
      assert.ok(bad(b=>{b.classLevels.push({class:'fighter',level:1,hp:'max'})}).includes('duplicate-class'));
      assert.ok(bad(b=>{b.classLevels[0].hp=[5]}).includes('bad-hp'));
      assert.ok(bad(b=>{b.abilityScores.method='dice'}).includes('bad-score-method'));
      assert.ok(bad(b=>{delete b.abilityScores.base.str}).includes('bad-scores'));
      assert.ok(bad(b=>{b.backgroundAsi={luck:2}}).includes('bad-asi'));
      assert.ok(bad(b=>{b.choices['x:y']=5}).includes('bad-choice'));
      assert.ok(bad(b=>{b.inventory[0].qty=0}).includes('bad-inventory'));
      assert.ok(bad(b=>{b.equipped.head='chain-mail'}).includes('unknown-slot'));
      assert.ok(bad(b=>{b.currency.gp=-1}).includes('bad-currency'));
      assert.ok(bad(b=>{b.resources['second-wind-uses']=1.5}).includes('bad-resource'));
      assert.ok(bad(b=>{b.hpCurrent=-3}).includes('bad-hp-current'));
      assert.ok(bad(b=>{b.surprise=1}).includes('unknown-field'));
    });
    test('a build that cannot be computed gives a fatal sheet with the problems, never an exception',async()=>{
      const C=await world();
      const s=Fable.character.compute(heroBuild(C,b=>{b.species='ghost'}));
      assert.strictEqual(s.fatal,true);assert.strictEqual(s.complete,false);
      assert.ok(codes(s).includes('unknown-species'));
      const t=Fable.character.compute(heroBuild(C,b=>{b.classLevels=[]}));
      assert.strictEqual(t.fatal,true);
      assert.strictEqual(Fable.character.compute({v:1}).fatal,true);
      assert.throws(()=>Fable.character.compute('nope'),/must be an object/);
    });
    test('compute says so when content is not loaded yet',()=>{
      H.fresh();H.loadRules();H.loadRegistry();
      assert.throws(()=>Fable.character.compute({v:1}),/content is not loaded/);
    });
  });

  suite('phase 3: golden sheet (plan section 11.5)',()=>{
    test('the premade hero computes a complete sheet with no issues',async()=>{
      const C=await world();
      const s=Fable.character.forCharacter('human-fighter');
      assert.deepStrictEqual(s.issues,[]);
      assert.strictEqual(s.complete,true);assert.strictEqual(s.fatal,false);
      assert.deepStrictEqual(s.pendingChoices,[]);
      assert.strictEqual(s.name,'Aldric');assert.strictEqual(s.level,1);
      assert.strictEqual(s.summary.classLine,'Human Fighter 1');
    });
    test('abilities: standard array plus Soldier +2 Str and +1 Con',async()=>{
      await world();
      const a=Fable.character.forCharacter('human-fighter').abilities;
      assert.deepStrictEqual(Object.keys(a).map(k=>[a[k].score,a[k].mod]),[[17,3],[14,2],[14,2],[8,-1],[10,0],[12,1]]);
      assert.deepStrictEqual(a.str.breakdown.map(b=>[b.label,b.value]),[['Standard array',15],['Soldier',2]]);
    });
    test('hit points 12, proficiency +2, initiative +4, speed 30, passive Perception 12',async()=>{
      await world();
      const s=Fable.character.forCharacter('human-fighter');
      assert.strictEqual(s.stats['hp-max'].value,12);
      assert.deepStrictEqual(s.hp,{max:12,current:12,temp:0});
      assert.strictEqual(s.stats['proficiency-bonus'].value,2);
      assert.strictEqual(s.stats.initiative.value,4);
      assert.deepStrictEqual(s.stats.initiative.breakdown.map(b=>[b.label,b.value]),[['Dexterity modifier',2],['Alert',2]]);
      assert.strictEqual(s.stats.speed.value,30);
      assert.strictEqual(s.stats['passive-perception'].value,12);
      assert.deepStrictEqual(s.hitDice,[{class:'fighter',die:10,total:1,used:0,remaining:1}]);
    });
    test('AC 19 in Loadout A: Chain Mail 16, Shield 2, Defense 1, no Dexterity with heavy armor',async()=>{
      await world();
      const ac=Fable.character.forCharacter('human-fighter').stats.ac;
      assert.strictEqual(ac.value,19);
      assert.deepStrictEqual(ac.breakdown.map(b=>[b.label,b.op,b.value]),[['Chain Mail','base',16],['Shield','add',2],['Defense','add',1]]);
      assert.strictEqual(Fable.character.explain(ac),'Chain Mail 16 + Shield 2 + Defense 1 = 19');
    });
    test('AC 17 in Loadout B: two daggers, no Shield',async()=>{
      const C=await world();
      const s=Fable.character.compute(heroBuild(C,b=>{b.equipped={body:'chain-mail',mainhand:'dagger',offhand:'dagger'}}));
      assert.deepStrictEqual(s.issues,[]);
      assert.strictEqual(s.stats.ac.value,17);
      assert.deepStrictEqual(s.stats.ac.breakdown.map(b=>b.label),['Chain Mail','Defense']);
    });
    test('Defense needs armor: a Shield alone does not give it, and unarmored is 10 + Dexterity',async()=>{
      const C=await world();
      const s=Fable.character.compute(heroBuild(C,b=>{b.equipped={offhand:'shield',mainhand:'longsword'}}));
      assert.strictEqual(s.stats.ac.value,14,'10 + Dex 2 + Shield 2, no Defense');
      assert.ok(!s.stats.ac.breakdown.some(b=>b.label==='Defense'));
      const bare=Fable.character.compute(heroBuild(C,b=>{b.equipped={}}));
      assert.strictEqual(bare.stats.ac.value,12);
      assert.deepStrictEqual(bare.stats.ac.breakdown.map(b=>b.label),['Unarmored','Dexterity modifier']);
    });
    test('saving throws Str +5 and Con +4; the other four have no proficiency',async()=>{
      await world();
      const v=Fable.character.forCharacter('human-fighter').saves;
      assert.deepStrictEqual(Object.keys(v).map(k=>v[k].value),[5,2,4,-1,0,1]);
      assert.deepStrictEqual(Object.keys(v).filter(k=>v[k].proficient),['str','con']);
    });
    test('skills: Athletics +5, Intimidation +3, Acrobatics +4, Perception +2, Insight +2, and only those five are proficient',async()=>{
      await world();
      const k=Fable.character.forCharacter('human-fighter').skills;
      assert.deepStrictEqual(['athletics','intimidation','acrobatics','perception','insight'].map(i=>k[i].value),[5,3,4,2,2]);
      assert.deepStrictEqual(Object.keys(k).filter(i=>k[i].proficient).sort(),['acrobatics','athletics','insight','intimidation','perception']);
      assert.strictEqual(k.stealth.value,2);
      assert.strictEqual(k.history.value,-1);
    });
    test('proficiencies: armor, weapons, saves, skills, tool and languages with their sources',async()=>{
      await world();
      const p=Fable.character.forCharacter('human-fighter').proficiencies;
      assert.deepStrictEqual(p.armorTraining.map(x=>x.id),['light','medium','heavy','shield']);
      assert.deepStrictEqual(p.weaponProficiency.map(x=>x.id),['simple','martial']);
      assert.deepStrictEqual(p.savingThrows.map(x=>x.id),['str','con']);
      assert.deepStrictEqual(p.tools.map(x=>x.id),['dice-set']);
      assert.deepStrictEqual(p.languages.map(x=>x.id),['common','dwarvish','elvish']);
      const insight=p.skills.find(x=>x.id==='insight');
      assert.deepStrictEqual(insight.sources,['Skillful']);
      assert.deepStrictEqual(p.skills.find(x=>x.id==='athletics').sources,['Soldier']);
    });
    test('features and feats: Alert and Savage Attacker, Defense, Second Wind, Weapon Mastery',async()=>{
      await world();
      const s=Fable.character.forCharacter('human-fighter');
      assert.deepStrictEqual(s.feats.map(f=>f.id).sort(),['alert','defense','savage-attacker']);
      ['human-resourceful','human-skillful','human-versatile','heroic-inspiration','fighter-fighting-style','second-wind','weapon-mastery'].forEach(id=>assert.ok(s.features.some(f=>f.id===id),id));
      assert.strictEqual(s.identity.size,'Medium');
      assert.strictEqual(s.identity.species.name,'Human');
      assert.deepStrictEqual(s.identity.languages,['common','dwarvish','elvish']);
    });
    test('attacks: Longsword +5 1d8+3 (1d10+3 two handed), Dagger +5 1d4+3, Javelin thrown +5 1d6+3',async()=>{
      await world();
      const s=Fable.character.forCharacter('human-fighter');
      const by=id=>s.attacks.find(a=>a.id===id);
      const sword=by('longsword:melee');
      assert.strictEqual(sword.bonus.value,5);
      assert.strictEqual(sword.damage.expression,'1d8+3');
      assert.strictEqual(sword.damage.type,'slashing');
      assert.strictEqual(sword.versatile.expression,'1d10+3');
      assert.strictEqual(sword.versatile.active,false,'the shield is in the off hand');
      assert.deepStrictEqual(sword.bonus.breakdown.map(b=>[b.label,b.value]),[['Strength modifier',3],['Proficiency bonus',2]]);
      assert.deepStrictEqual([by('dagger:melee').bonus.value,by('dagger:melee').damage.expression,by('dagger:melee').ability],[5,'1d4+3','str']);
      assert.deepStrictEqual([by('javelin:thrown').bonus.value,by('javelin:thrown').damage.expression],[5,'1d6+3']);
      assert.deepStrictEqual(by('javelin:thrown').range,{normal:30,long:120});
      assert.deepStrictEqual(by('dagger:thrown').range,{normal:20,long:60});
      assert.strictEqual(by('longsword:melee').reach,5);
      assert.strictEqual(s.loadout.mainAttack,'longsword:melee');
    });
    test('with the off hand empty the Longsword is used two handed for 1d10+3',async()=>{
      const C=await world();
      const s=Fable.character.compute(heroBuild(C,b=>{b.equipped={body:'chain-mail',mainhand:'longsword'}}));
      const sword=s.attacks.find(a=>a.id==='longsword:melee');
      assert.strictEqual(sword.versatile.active,true);
      assert.strictEqual(sword.damage.expression,'1d10+3');
      assert.strictEqual(sword.damage.stats.max,13);
      assert.strictEqual(s.loadout.twoHanded,true);
      assert.strictEqual(s.stats.ac.value,17);
    });
    test('Loadout B: the Light extra attack is 1d4 with no modifier, and Nick moves it into the Attack action',async()=>{
      const C=await world();
      const s=Fable.character.compute(heroBuild(C,b=>{b.equipped={body:'chain-mail',mainhand:'dagger',offhand:'dagger'}}));
      assert.strictEqual(s.loadout.lightPair,true);
      const extra=s.attacks.find(a=>a.id==='dagger:light-extra');
      assert.ok(extra);
      assert.deepStrictEqual([extra.bonus.value,extra.damage.expression,extra.damage.bonus.value],[5,'1d4',0]);
      assert.strictEqual(extra.mastery.usable,true);
      assert.strictEqual(extra.timing,'attack-action');
      assert.strictEqual(s.attacks.find(a=>a.id==='dagger:melee').damage.expression,'1d4+3');
      assert.strictEqual(s.attacks.filter(a=>a.mode==='light-extra').length,1);
    });
    test('Nick is inapplicable with Longsword and Shield, and the tooltip says why',async()=>{
      await world();
      const s=Fable.character.forCharacter('human-fighter');
      assert.strictEqual(s.loadout.lightPair,false);
      assert.ok(!s.attacks.some(a=>a.mode==='light-extra'));
      const nick=s.attacks.find(a=>a.id==='dagger:melee').mastery;
      assert.deepStrictEqual([nick.id,nick.chosen,nick.applicable,nick.usable],['nick',true,false,false]);
      assert.match(nick.reason,/Light weapon in each hand/);
    });
    test('weapon masteries: Sap, Nick and Slow are chosen and usable where they apply',async()=>{
      await world();
      const s=Fable.character.forCharacter('human-fighter');
      assert.strictEqual(s.attacks.find(a=>a.id==='longsword:melee').mastery.id,'sap');
      assert.strictEqual(s.attacks.find(a=>a.id==='longsword:melee').mastery.usable,true);
      assert.strictEqual(s.attacks.find(a=>a.id==='javelin:thrown').mastery.id,'slow');
      assert.strictEqual(s.attacks.find(a=>a.id==='javelin:thrown').mastery.usable,true);
      assert.strictEqual(s.masteries.pick,3);
      assert.deepStrictEqual(s.masteries.chosen.map(m=>[m.item,m.mastery.id]),[['longsword','sap'],['dagger','nick'],['javelin','slow']]);
    });
    test('a weapon kind that was not chosen cannot use its mastery',async()=>{
      const C=await world();
      const s=Fable.character.compute(heroBuild(C,b=>{
        b.choices['weapon-mastery:weapons']=['longsword','javelin','mace'];
        b.inventory.push({item:'mace',qty:1});b.inventory.push({item:'handaxe',qty:1});
      }));
      const axe=s.attacks.find(a=>a.id==='handaxe:melee').mastery;
      assert.deepStrictEqual([axe.id,axe.chosen,axe.usable],['vex',false,false]);
      assert.match(axe.reason,/not chosen for Handaxe/);
      assert.strictEqual(s.attacks.find(a=>a.id==='mace:melee').mastery.usable,true);
    });
    test('Unarmed Strike is always there: 1 plus Strength, proficient',async()=>{
      await world();
      const u=Fable.character.forCharacter('human-fighter').attacks.find(a=>a.id==='unarmed-strike:melee');
      assert.deepStrictEqual([u.bonus.value,u.damage.expression,u.damage.type,u.damage.stats.min],[5,'4','bludgeoning',4]);
    });
    test('Second Wind: bonus action, 2 uses, heals 1d10 + 1',async()=>{
      await world();
      const s=Fable.character.forCharacter('human-fighter');
      const sw=s.actions.find(a=>a.id==='second-wind');
      assert.strictEqual(sw.cost,'bonus');
      assert.strictEqual(sw.effects[0].amount,'1d10+1');
      assert.strictEqual(sw.effects[0].formula,'1d10+@class.fighter.level');
      assert.deepStrictEqual(sw.effects[0].range,{min:2,max:11,average:6.5});
      assert.deepStrictEqual([s.resources['second-wind-uses'].current,s.resources['second-wind-uses'].max],[2,2]);
      assert.strictEqual(sw.available,true);
    });
    test('Savage Attacker and Alert reach combat as handlers; Heroic Inspiration starts empty',async()=>{
      await world();
      const s=Fable.character.forCharacter('human-fighter');
      const h=s.handlers.map(x=>x.handler+':'+x.event).sort();
      assert.deepStrictEqual(h,['feat.alert-initiative-swap:onInitiative','feat.savage-attacker:onDamageRoll','inspiration.reroll:onRoll']);
      assert.strictEqual(s.handlers.find(x=>x.handler==='feat.savage-attacker').oncePerTurn,true);
      assert.deepStrictEqual([s.resources['savage-attacker'].current,s.resources['heroic-inspiration'].current,s.resources['heroic-inspiration'].max],[1,0,1]);
      const reroll=s.actions.find(a=>a.id==='heroic-inspiration-reroll');
      assert.strictEqual(reroll.available,false);
      assert.match(reroll.reason,/No uses of Heroic Inspiration/);
      assert.deepStrictEqual(s.onRest.map(r=>r.rest+':'+r.restore.resource),['long:heroic-inspiration']);
    });
    test('all twelve standard actions are on every sheet',async()=>{
      const C=await world();
      assert.strictEqual(C.standardActions.size(),12);
      const s=Fable.character.forCharacter('human-fighter');
      assert.deepStrictEqual(s.actions.filter(a=>a.kind==='standard').map(a=>a.id),['attack','dash','disengage','dodge','help','hide','influence','magic','ready','search','study','utilize']);
      assert.ok(s.actions.filter(a=>a.kind==='standard').every(a=>a.cost==='action'&&a.available));
    });
    test('carried weight 129 lb of 255 lb, and the purse is empty',async()=>{
      await world();
      const s=Fable.character.forCharacter('human-fighter');
      assert.strictEqual(s.carrying.weight,129);
      assert.strictEqual(s.carrying.capacity.value,255);
      assert.strictEqual(s.carrying.encumbered,false);
      assert.deepStrictEqual(s.currency,{coins:{gp:0},totalCp:0,text:'0 gp'});
      assert.strictEqual(s.inventory.find(i=>i.item==='dagger').qty,2);
      assert.strictEqual(s.inventory.find(i=>i.item==='dagger').equippedQty,0);
      assert.strictEqual(s.inventory.find(i=>i.item==='chain-mail').equippedQty,1);
    });
    test('the kit costs 116 GP, within the 205 GP budget, and weighs 129 lb',async()=>{
      const C=await world();
      const b=heroBuild(C);
      const cp=b.inventory.reduce((n,e)=>n+C.items.get(e.item).costCp*e.qty,0);
      assert.strictEqual(cp,11600);
      assert.ok(cp<=20500);
      assert.deepStrictEqual(b.currency,{gp:0});
    });
    test('every stat, ability, save, skill, attack bonus and damage bonus has a breakdown that adds up',async()=>{
      const C=await world();
      const sheets=[Fable.character.forCharacter('human-fighter'),
        Fable.character.compute(heroBuild(C,b=>{b.equipped={body:'chain-mail',mainhand:'dagger',offhand:'dagger'}})),
        Fable.character.compute(heroBuild(C,b=>{b.classLevels[0]={class:'fighter',level:5,hp:'average'}}))];
      sheets.forEach(sh=>statObjects(sh).forEach(([name,st])=>{
        assert.ok(st.breakdown.length>0,name+' has no breakdown');
        assert.strictEqual(sum(st.breakdown),st.value,name+': '+JSON.stringify(st.breakdown));
      }));
    });
    test('the sheet is plain data: deterministic, JSON friendly, and it changes neither the build nor the content',async()=>{
      const C=await world();
      const b=heroBuild(C),before=JSON.stringify(b);
      const a=Fable.character.compute(b),c=Fable.character.compute(b);
      assert.deepStrictEqual(a,c);
      assert.strictEqual(JSON.stringify(b),before);
      assert.doesNotThrow(()=>JSON.parse(JSON.stringify(a)));
      assert.strictEqual(C.classes.get('fighter').hitDie,10);
    });
    test('the hub summary reads straight from the sheet',async()=>{
      await world();
      const m=Fable.character.forCharacter('human-fighter').summary;
      assert.deepStrictEqual(m,{name:'Aldric',classLine:'Human Fighter 1',ac:19,hp:12,initiative:4,proficiencyBonus:2,speed:30,
        mainAttack:{name:'Longsword',bonus:5,damage:'1d8+3',damageType:'slashing'}});
    });
  });

  suite('phase 3: choice resolution',()=>{
    test('every decision of the hero is a keyed choice and all are made',async()=>{
      await world();
      const s=Fable.character.forCharacter('human-fighter');
      assert.deepStrictEqual(s.choices.map(c=>c.key).sort(),[
        'fighter-fighting-style:style','fighter:skills','human-skillful:skill','human-versatile:feat','human:languages','human:size','soldier:tool','weapon-mastery:weapons']);
      assert.ok(s.choices.every(c=>c.status==='ok'));
    });
    test('an empty build lists exactly what is still to be decided, with the options',async()=>{
      const C=await world();
      const s=Fable.character.compute(heroBuild(C,b=>{b.choices={}}));
      assert.strictEqual(s.complete,false);
      assert.strictEqual(s.fatal,false);
      assert.deepStrictEqual(s.pendingChoices.map(c=>c.key).sort(),[
        'fighter-fighting-style:style','fighter:skills','human-skillful:skill','human-versatile:feat','human:languages','human:size','soldier:tool','weapon-mastery:weapons']);
      const style=s.pendingChoices.find(c=>c.key==='fighter-fighting-style:style');
      assert.deepStrictEqual(style.options.map(o=>o.id),['defense']);
      assert.strictEqual(style.recommended,'defense');
      assert.strictEqual(style.pick,1);
      assert.strictEqual(style.changeOn,'level-up');
      const skills=s.pendingChoices.find(c=>c.key==='fighter:skills');
      assert.strictEqual(skills.pick,2);
      assert.ok(!skills.options.some(o=>o.id==='athletics'||o.id==='intimidation'),'the background skills are already owned');
      assert.strictEqual(s.pendingChoices.find(c=>c.key==='weapon-mastery:weapons').pick,3);
      assert.deepStrictEqual(s.pendingChoices.find(c=>c.key==='human:size').options.map(o=>o.id),['Medium','Small']);
      assert.strictEqual(s.pendingChoices.find(c=>c.key==='human:languages').options.length,9);
      assert.ok(codes(s).includes('pending-choice'));
    });
    test('a half made pick is pending, and what was picked still counts',async()=>{
      const C=await world();
      const s=Fable.character.compute(heroBuild(C,b=>{b.choices['fighter:skills']=['acrobatics']}));
      const c=s.choices.find(x=>x.key==='fighter:skills');
      assert.strictEqual(c.status,'pending');
      assert.match(c.message,/1 more pick/);
      assert.strictEqual(s.skills.acrobatics.proficient,true);
      assert.strictEqual(s.skills.perception.proficient,false);
    });
    test('illegal picks are errors and are not applied',async()=>{
      const C=await world();
      const run=(key,val)=>Fable.character.compute(heroBuild(C,b=>{b.choices[key]=val}));
      let s=run('fighter:skills',['acrobatics','acrobatics']);
      assert.ok(s.issues.some(i=>i.code==='invalid-choice'&&/twice/.test(i.message)));
      s=run('fighter:skills',['athletics','perception']);
      assert.ok(s.issues.some(i=>i.code==='invalid-choice'&&/already owned/.test(i.message)),'athletics comes from Soldier');
      s=run('fighter:skills',['arcana','perception']);
      assert.ok(s.issues.some(i=>i.code==='invalid-choice'&&/not one of the options/.test(i.message)),'arcana is not a Fighter skill');
      s=run('fighter:skills',['acrobatics','perception','survival']);
      assert.ok(s.issues.some(i=>i.code==='invalid-choice'&&/only 2 are allowed/.test(i.message)));
      assert.strictEqual(s.skills.acrobatics.proficient,false);
      assert.strictEqual(s.complete,false);
      s=run('human-versatile:feat','savage-attacker');
      assert.ok(s.issues.some(i=>/already owned/.test(i.message)),'Savage Attacker comes from Soldier');
      s=run('human-versatile:feat','defense');
      assert.ok(s.issues.some(i=>i.code==='invalid-choice'),'Defense is not an Origin feat');
    });
    test('Skillful cannot repeat a skill the class chose, whichever is resolved first',async()=>{
      const C=await world();
      const s=Fable.character.compute(heroBuild(C,b=>{b.choices['human-skillful:skill']='perception'}));
      assert.ok(s.issues.some(i=>i.code==='invalid-choice'&&/already owned/.test(i.message)));
    });
    test('a choice the record has but nothing asks for is a warning',async()=>{
      const C=await world();
      const s=Fable.character.compute(heroBuild(C,b=>{b.choices['mystery:pick']='x'}));
      assert.ok(s.issues.some(i=>i.code==='unused-choice'&&i.severity==='warning'));
      assert.strictEqual(s.complete,true);
    });
    test('single picks may be stored as an id or a one item list',async()=>{
      const C=await world();
      const s=Fable.character.compute(heroBuild(C,b=>{b.choices['human-versatile:feat']=['alert'];b.choices['fighter-fighting-style:style']=['defense']}));
      assert.deepStrictEqual(s.issues,[]);
      assert.strictEqual(s.stats.initiative.value,4);
    });
  });

  suite('phase 3: validation',()=>{
    const run=(C,edit)=>Fable.character.compute(heroBuild(C,edit));
    test('standard array and point buy are checked',async()=>{
      const C=await world();
      assert.ok(codes(run(C,b=>{b.abilityScores.base.str=14})).includes('bad-standard-array'));
      const pb=(base)=>run(C,b=>{b.abilityScores={method:'point-buy',base}});
      assert.deepStrictEqual(codes(pb({str:15,dex:15,con:15,int:8,wis:8,cha:8})).filter(c=>c.startsWith('bad')),[],'27 points exactly');
      assert.ok(codes(pb({str:15,dex:15,con:15,int:10,wis:8,cha:8})).includes('bad-point-buy'));
      assert.ok(codes(pb({str:16,dex:8,con:8,int:8,wis:8,cha:8})).includes('bad-point-buy'));
      assert.ok(!codes(run(C,b=>{b.abilityScores={method:'manual',base:{str:18,dex:3,con:12,int:9,wis:20,cha:1}}})).some(c=>c.startsWith('bad')));
    });
    test('background increases must be +2/+1 or +1/+1/+1 on the background abilities',async()=>{
      const C=await world();
      assert.ok(codes(run(C,b=>{b.backgroundAsi={}})).includes('asi-incomplete'));
      assert.ok(codes(run(C,b=>{b.backgroundAsi={str:2,int:1}})).includes('asi-option'));
      assert.ok(codes(run(C,b=>{b.backgroundAsi={str:2,dex:2}})).includes('asi-shape'));
      assert.ok(codes(run(C,b=>{b.backgroundAsi={str:2}})).includes('asi-shape'));
      const even=run(C,b=>{b.backgroundAsi={str:1,dex:1,con:1}});
      assert.deepStrictEqual(even.issues,[]);
      assert.strictEqual(even.abilities.str.score,16);
    });
    test('ability scores cannot pass 20 from ordinary increases',async()=>{
      const C=await world();
      const s=run(C,b=>{b.abilityScores={method:'manual',base:{str:20,dex:14,con:13,int:8,wis:10,cha:12}}});
      assert.strictEqual(s.abilities.str.score,20);
      assert.strictEqual(s.abilities.str.breakdown[s.abilities.str.breakdown.length-1].op,'max');
      assert.strictEqual(sum(s.abilities.str.breakdown),20);
    });
    test('inventory and equipment problems are errors with the slot named',async()=>{
      const C=await world();
      assert.ok(codes(run(C,b=>{b.inventory.push({item:'vorpal-blade',qty:1})})).includes('unknown-item'));
      assert.ok(codes(run(C,b=>{b.equipped.mainhand='dagger';b.equipped.offhand='shield';b.inventory=b.inventory.filter(e=>e.item!=='dagger')})).includes('not-carried'));
      assert.ok(codes(run(C,b=>{b.equipped.body='longsword'})).includes('wrong-slot'));
      assert.ok(codes(run(C,b=>{b.equipped.body='shield'})).includes('wrong-slot'));
      assert.ok(codes(run(C,b=>{b.equipped.mainhand='chain-mail'})).includes('wrong-slot'));
      assert.ok(codes(run(C,b=>{b.equipped.offhand='chain-mail'})).includes('wrong-slot'));
      const two=run(C,b=>{b.inventory.push({item:'greatsword',qty:1});b.equipped.mainhand='greatsword'});
      assert.ok(codes(two).includes('two-handed'),'Greatsword with a Shield');
      const ok=run(C,b=>{b.inventory.push({item:'greatsword',qty:1});b.equipped={body:'chain-mail',mainhand:'greatsword'}});
      assert.ok(!codes(ok).includes('two-handed'));
      assert.ok(codes(run(C,b=>{b.equipped={mainhand:'dagger',offhand:'dagger'};b.inventory=b.inventory.map(e=>e.item==='dagger'?{item:'dagger',qty:1}:e)})).includes('not-carried'),'two equipped daggers need two daggers');
    });
    test('currency, resources, hit points and hit dice are checked',async()=>{
      const C=await world();
      const s=run(C,b=>{b.currency={gp:5,sp:3,cp:2,xx:1}});
      assert.ok(codes(s).includes('bad-currency'));
      const coins=run(C,b=>{b.currency={gp:50,sp:5}});
      assert.deepStrictEqual([coins.currency.totalCp,coins.currency.text],[5050,'50 gp 5 sp']);
      assert.strictEqual(coins.carrying.weight,129+55/50);
      assert.ok(codes(run(C,b=>{b.resources['second-wind-uses']=5})).includes('resource-over-max'));
      assert.strictEqual(run(C,b=>{b.resources['second-wind-uses']=5}).resources['second-wind-uses'].current,2);
      assert.ok(codes(run(C,b=>{b.resources.jetpack=1})).includes('unknown-resource'));
      assert.ok(codes(run(C,b=>{b.hitDiceUsed={wizard:1}})).includes('unknown-hit-dice'));
      const hurt=run(C,b=>{b.hpCurrent=5;b.hitDiceUsed={fighter:1}});
      assert.deepStrictEqual([hurt.hp.current,hurt.hp.max,hurt.hitDice[0].remaining],[5,12,0]);
      const over=run(C,b=>{b.hpCurrent=40});
      assert.strictEqual(over.hp.current,12);
      assert.ok(codes(over).includes('hp-over-max'));
      assert.strictEqual(run(C,b=>{b.hpCurrent=0}).hp.current,0);
    });
    test('using up Second Wind makes the action unavailable with a reason',async()=>{
      const C=await world();
      const sw=run(C,b=>{b.resources['second-wind-uses']=0}).actions.find(a=>a.id==='second-wind');
      assert.strictEqual(sw.available,false);
      assert.match(sw.reason,/No uses of Second Wind left/);
    });
    test('Strength below the armor requirement costs 10 ft of speed, and Heavy armor ignores a negative Dexterity',async()=>{
      const C=await world();
      const weak=run(C,b=>{b.abilityScores.base={str:8,dex:15,con:14,int:13,wis:12,cha:10};b.backgroundAsi={dex:1,con:1,str:1}});
      assert.strictEqual(weak.abilities.str.score,9);
      assert.strictEqual(weak.stats.speed.value,20);
      assert.deepStrictEqual(weak.stats.speed.breakdown.map(b=>b.value),[30,-10]);
      assert.match(weak.stats.speed.breakdown[1].label,/needs Strength 13/);
      assert.strictEqual(run(C,b=>{b.abilityScores.base={str:15,dex:8,con:14,int:13,wis:12,cha:10}}).stats.ac.value,19,'Dex -1 does not lower Chain Mail');
    });
    test('Chain Mail gives Disadvantage on Stealth, shown with its source',async()=>{
      const C=await world();
      const s=Fable.character.forCharacter('human-fighter');
      assert.strictEqual(s.skills.stealth.rollState.state,'disadvantage');
      assert.deepStrictEqual(s.skills.stealth.rollState.disadvantage,['Chain Mail']);
      assert.strictEqual(s.skills.athletics.rollState.state,'normal');
      assert.strictEqual(run(C,b=>{b.equipped={}}).skills.stealth.rollState.state,'normal');
    });
    test('medium armor caps Dexterity at +2 and light armor adds all of it',async()=>{
      const C=await world();
      const dex=(armor)=>run(C,b=>{b.abilityScores.base={str:13,dex:15,con:14,int:12,wis:10,cha:8};b.backgroundAsi={dex:1,con:1,str:1};b.inventory.push({item:armor,qty:1});b.equipped={body:armor}});
      const med=dex('scale-mail'),light=dex('studded-leather-armor');
      assert.deepStrictEqual(med.stats.ac.breakdown.map(b=>b.value),[14,2,1]);
      assert.match(med.stats.ac.breakdown[1].label,/maximum \+2/);
      assert.strictEqual(med.stats.ac.value,17);
      assert.deepStrictEqual(light.stats.ac.breakdown.map(b=>b.value),[12,3,1]);
    });
    test('a ranged weapon needs its ammunition, and Dexterity drives it',async()=>{
      const C=await world();
      const bow=(arrows)=>run(C,b=>{b.inventory.push({item:'shortbow',qty:1});if(arrows)b.inventory.push({item:'arrows',qty:1});b.equipped={body:'chain-mail',mainhand:'shortbow'}});
      const withArrows=bow(true).attacks.find(a=>a.id==='shortbow:ranged'),without=bow(false).attacks.find(a=>a.id==='shortbow:ranged');
      assert.strictEqual(withArrows.available,true);
      assert.deepStrictEqual(withArrows.ammo,{type:'arrow',count:20});
      assert.strictEqual(withArrows.ability,'dex');
      assert.strictEqual(withArrows.bonus.value,4);
      assert.deepStrictEqual(withArrows.range,{normal:80,long:320});
      assert.strictEqual(without.available,false);
      assert.match(without.reason,/No arrow ammunition/);
    });
    test('a Heavy weapon is at Disadvantage below Strength 13',async()=>{
      const C=await world();
      const gs=(str)=>run(C,b=>{b.abilityScores={method:'manual',base:{str:str,dex:14,con:13,int:8,wis:10,cha:12}};b.backgroundAsi={str:1,dex:1,con:1};b.inventory.push({item:'greatsword',qty:1});b.equipped={mainhand:'greatsword'}}).attacks.find(a=>a.id==='greatsword:melee');
      assert.strictEqual(gs(11).rollState.state,'disadvantage');
      assert.match(gs(11).rollState.disadvantage[0],/Heavy/);
      assert.strictEqual(gs(12).rollState.state,'normal');
    });
    test('a Shield and armor the class is not trained for bring Disadvantage and a warning',async()=>{
      const C=await world();addTester(C);
      const s=Fable.character.compute(testerBuild(C));
      assert.deepStrictEqual(s.issues.map(i=>i.code).sort(),['untrained-armor','untrained-shield']);
      assert.strictEqual(s.stats.ac.value,16,'the untrained Shield gives nothing');
      assert.strictEqual(s.rollStates.attack.state,'disadvantage');
      assert.strictEqual(s.stats.initiative.rollState,undefined);
      assert.strictEqual(s.rollStates.initiative.state,'disadvantage','initiative is a Dexterity check');
      assert.strictEqual(s.skills.athletics.rollState.state,'disadvantage');
      assert.strictEqual(s.skills.perception.rollState.state,'normal');
      assert.strictEqual(s.saves.dex.rollState.state,'disadvantage');
      assert.strictEqual(s.saves.wis.rollState.state,'normal');
      assert.strictEqual(s.attacks.find(a=>a.id==='longsword:melee').rollState.state,'disadvantage');
    });
    test('a weapon category without proficiency gets no proficiency bonus',async()=>{
      const C=await world();addTester(C);
      const s=Fable.character.compute(testerBuild(C));
      const sword=s.attacks.find(a=>a.id==='longsword:melee'),dagger=s.attacks.find(a=>a.id==='dagger:melee');
      assert.deepStrictEqual([sword.proficient,sword.bonus.value],[false,3]);
      assert.deepStrictEqual([dagger.proficient,dagger.bonus.value],[true,5]);
      assert.deepStrictEqual(s.proficiencies.savingThrows.map(p=>p.id),['dex','int']);
      assert.strictEqual(s.stats['hp-max'].value,8,'d6 maximum plus Con +2');
    });
  });

  suite('phase 3: content drives the sheet (no engine edits)',()=>{
    test('a new feat with a hit point effect changes HP, and a new origin feat is offered by Versatile',async()=>{
      const C=await world();
      C.feats.register({id:'tough',name:'Tough',source:'original',category:'origin',description:'Your hit point maximum increases.',
        effects:[{type:'modifier',stat:'hp-per-level',op:'add',value:2,label:'Tough'}]});
      const s=Fable.character.compute(heroBuild(C,b=>{b.choices['human-versatile:feat']='tough'}));
      assert.deepStrictEqual(s.issues,[]);
      assert.strictEqual(s.stats['hp-max'].value,14);
      assert.strictEqual(s.stats.initiative.value,2,'no Alert');
      assert.ok(Fable.character.compute(heroBuild(C,b=>{b.choices={}})).pendingChoices.find(c=>c.key==='human-versatile:feat').options.some(o=>o.id==='tough'));
      const l5=Fable.character.compute(heroBuild(C,b=>{b.choices['human-versatile:feat']='tough';b.classLevels[0]={class:'fighter',level:5,hp:'average'}}));
      assert.strictEqual(l5.stats['hp-max'].value,10+24+10+10);
    });
    test('feat effects can raise abilities, skills, saves, speed, AC, attacks and damage, with labels',async()=>{
      const C=await world();
      C.feats.register({id:'blessed',name:'Blessed',source:'original',category:'origin',description:'A bit of everything.',effects:[
        {type:'modifier',stat:'ability:dex',op:'add',value:1,label:'Blessed dex'},
        {type:'modifier',stat:'skill:stealth',op:'add',value:2,label:'Blessed stealth'},
        {type:'modifier',stat:'save:wis',op:'add',value:'@proficiencyBonus',label:'Blessed save'},
        {type:'modifier',stat:'speed',op:'add',value:10,label:'Blessed speed'},
        {type:'modifier',stat:'ac',op:'add',value:1,label:'Blessed AC',when:{wearing:['heavy']}},
        {type:'modifier',stat:'attack',op:'add',value:1,label:'Blessed aim'},
        {type:'modifier',stat:'damage',op:'add',value:2,label:'Blessed strikes'},
        {type:'modifier',stat:'passive-perception',op:'add',value:5,label:'Blessed senses'},
        {type:'modifier',stat:'proficiency-bonus',op:'add',value:1,label:'Blessed prowess'},
        {type:'advantage',roll:'save:wis',label:'Blessed mind'}
      ]});
      const s=Fable.character.compute(heroBuild(C,b=>{b.choices['human-versatile:feat']='blessed'}));
      assert.deepStrictEqual(s.issues,[]);
      assert.strictEqual(s.abilities.dex.score,15);
      assert.strictEqual(s.stats['proficiency-bonus'].value,3);
      assert.strictEqual(s.skills.stealth.value,2+2,'Dex 15 is still +2, plus 2');
      assert.strictEqual(s.saves.wis.value,0+3);
      assert.strictEqual(s.saves.wis.rollState.state,'advantage');
      assert.strictEqual(s.stats.speed.value,40);
      assert.strictEqual(s.stats.ac.value,20);
      assert.strictEqual(s.stats['passive-perception'].value,10+2+1+5,'proficiency went up too');
      const sword=s.attacks.find(a=>a.id==='longsword:melee');
      assert.strictEqual(sword.bonus.value,3+3+1);
      assert.strictEqual(sword.damage.expression,'1d8+5');
      statObjects(s).forEach(([n,st])=>assert.strictEqual(sum(st.breakdown),st.value,n));
    });
    test('an ability effect that reads another ability is reported, not run',async()=>{
      const C=await world();
      C.feats.register({id:'circular',name:'Circular',source:'original',category:'origin',description:'Reads abilities.',
        effects:[{type:'modifier',stat:'ability:str',op:'add',value:'@abilities.dex.mod',label:'Loop'}]});
      const s=Fable.character.compute(heroBuild(C,b=>{b.choices['human-versatile:feat']='circular'}));
      assert.ok(s.issues.some(i=>i.code==='formula-error'&&/abilities/.test(i.message)));
      assert.strictEqual(s.abilities.str.score,17);
    });
    test('an alternative base competes with the sheet base instead of stacking',async()=>{
      const C=await world();
      C.feats.register({id:'natural-armor',name:'Natural Armor',source:'original',category:'origin',description:'Tough hide.',
        effects:[{type:'modifier',stat:'ac',op:'base',value:18,label:'Natural armor'}]});
      const s=Fable.character.compute(heroBuild(C,b=>{b.choices['human-versatile:feat']='natural-armor'}));
      assert.strictEqual(s.stats.ac.value,18+2+1);
      assert.strictEqual(s.stats.ac.breakdown[0].label,'Natural armor');
      assert.strictEqual(s.stats.ac.ignored[0].label,'Chain Mail');
    });
    test('level 5: proficiency +3, Second Wind 3 uses, 4 weapon masteries, hit points from the dice, later features are placeholders',async()=>{
      const C=await world();
      const s=Fable.character.compute(heroBuild(C,b=>{b.classLevels[0]={class:'fighter',level:5,hp:'average'}}));
      assert.strictEqual(s.level,5);
      assert.strictEqual(s.stats['proficiency-bonus'].value,3);
      assert.strictEqual(s.stats['hp-max'].value,10+4*6+5*2);
      assert.strictEqual(s.stats['hp-max'].breakdown[0].op,'base');
      assert.strictEqual(s.stats['hp-max'].breakdown.find(b=>/Constitution/.test(b.label)).value,10);
      assert.strictEqual(s.resources['second-wind-uses'].max,3);
      assert.strictEqual(s.actions.find(a=>a.id==='second-wind').effects[0].amount,'1d10+5');
      assert.strictEqual(s.masteries.pick,4);
      assert.strictEqual(s.choices.find(c=>c.key==='weapon-mastery:weapons').status,'pending');
      assert.ok(codes(s).includes('unimplemented-level'));
      assert.ok(s.features.some(f=>f.id==='extra-attack'&&f.status==='stub'));
      assert.strictEqual(s.stats.initiative.value,2+3);
      const ok=Fable.character.compute(heroBuild(C,b=>{b.classLevels[0]={class:'fighter',level:5,hp:'average'};b.choices['weapon-mastery:weapons'].push('mace');b.inventory.push({item:'mace',qty:1})}));
      assert.strictEqual(ok.choices.find(c=>c.key==='weapon-mastery:weapons').status,'ok');
    });
    test('rolled hit points are used, checked against the die, and level 1 stays maximum',async()=>{
      const C=await world();
      const rolled=Fable.character.compute(heroBuild(C,b=>{b.classLevels[0]={class:'fighter',level:3,hp:[7,3]}}));
      assert.strictEqual(rolled.stats['hp-max'].value,10+7+3+2*3);
      assert.ok(rolled.stats['hp-max'].breakdown.some(b=>/rolled 7/.test(b.label)));
      const bad=Fable.character.compute(heroBuild(C,b=>{b.classLevels[0]={class:'fighter',level:2,hp:[11]}}));
      assert.ok(codes(bad).includes('bad-hp'));
      const max=Fable.character.compute(heroBuild(C,b=>{b.classLevels[0]={class:'fighter',level:2,hp:'max'}}));
      assert.strictEqual(max.stats['hp-max'].value,10+10+2*2);
    });
    test('a negative Constitution modifier never gives less than 1 hit point per level',async()=>{
      const C=await world();
      const s=Fable.character.compute(heroBuild(C,b=>{b.abilityScores={method:'manual',base:{str:15,dex:14,con:3,int:8,wis:10,cha:12}};b.backgroundAsi={str:1,dex:1,con:1};b.classLevels[0]={class:'fighter',level:2,hp:[1]}}));
      assert.strictEqual(s.abilities.con.mod,-3);
      assert.strictEqual(s.stats['hp-max'].value,8,'level 1: 10-3=7; level 2: the roll of 1 minus 3 is raised to 1');
      assert.strictEqual(sum(s.stats['hp-max'].breakdown),s.stats['hp-max'].value);
    });
    test('another class is picked up from data alone: Tester with its own saves, skills and hit die',async()=>{
      const C=await world();addTester(C);
      const s=Fable.character.compute(testerBuild(C));
      assert.strictEqual(s.fatal,false);
      assert.deepStrictEqual(s.identity.classes,[{id:'tester',name:'Tester',level:1,hitDie:6,subclass:null}]);
      assert.strictEqual(s.skills.stealth.proficient,true);
      assert.strictEqual(s.skills.arcana.value,-1+2);
      assert.deepStrictEqual(s.hitDice[0].die,6);
      assert.ok(!s.actions.some(a=>a.id==='second-wind'));
      assert.ok(!('second-wind-uses' in s.resources));
      assert.strictEqual(s.summary.classLine,'Human Tester 1');
    });
    test('a second class entry is accepted as groundwork with a warning, and proficiencies come from the first class',async()=>{
      const C=await world();addTester(C);
      const s=Fable.character.compute(heroBuild(C,b=>{b.classLevels=[{class:'fighter',level:1,hp:'max'},{class:'tester',level:2,hp:'average'}]}));
      assert.ok(codes(s).includes('multiclass'));
      assert.strictEqual(s.level,3);
      assert.strictEqual(s.stats['proficiency-bonus'].value,2);
      assert.strictEqual(s.stats['hp-max'].value,10+4+4+2*3);
      assert.deepStrictEqual(s.hitDice.map(h=>[h.class,h.die,h.total]),[['fighter',10,1],['tester',6,2]]);
      assert.deepStrictEqual(s.proficiencies.savingThrows.map(p=>p.id),['str','con']);
    });
    test('a class with a subclass asks for it at the subclass level and adds its features',async()=>{
      const C=await world();
      C.features.register({id:'champion-test',name:'Champion Test',source:'original',description:'A subclass feature.',effects:[{type:'modifier',stat:'initiative',op:'add',value:1,label:'Champion'}]});
      C.subclasses.register({id:'champion-test',name:'Champion Test',source:'original',description:'A test subclass.',class:'fighter',features:{3:['champion-test']}});
      const old=C.classes.get('fighter');
      /* Classes are frozen, so register a copy with the subclass listed. */
      const copy=JSON.parse(JSON.stringify(old));copy.id='fighter-two';copy.name='Fighter Two';copy.subclasses=['champion-test'];
      C.subclasses.register({id:'champion-two',name:'Champion Two',source:'original',description:'Another.',class:'fighter-two',features:{3:['champion-test']}});
      copy.subclasses=['champion-two'];
      /* The subclass of Fighter Two must not be listed on the original class: remove the first one by using a fresh class instead. */
      C.classes.register(copy);
      const pend=Fable.character.compute(heroBuild(C,b=>{b.classLevels[0]={class:'fighter-two',level:3,hp:'average'};delete b.choices['fighter:skills'];b.choices['fighter-two:skills']=['acrobatics','perception']}));
      const c=pend.pendingChoices.find(x=>x.key==='fighter-two:subclass');
      assert.ok(c,'subclass choice is pending');
      assert.deepStrictEqual(c.options.map(o=>o.id),['champion-two']);
      const done=Fable.character.compute(heroBuild(C,b=>{b.classLevels[0]={class:'fighter-two',level:3,hp:'average'};delete b.choices['fighter:skills'];b.choices['fighter-two:skills']=['acrobatics','perception'];b.choices['fighter-two:subclass']='champion-two'}));
      assert.deepStrictEqual(done.identity.classes[0].subclass,{id:'champion-two',name:'Champion Two'});
      assert.strictEqual(done.stats.initiative.value,2+2+1,'Alert (+2 at level 1 and 2 table) plus the Champion feature');
      const low=Fable.character.compute(heroBuild(C,b=>{b.classLevels[0]={class:'fighter-two',level:2,hp:'average'};delete b.choices['fighter:skills'];b.choices['fighter-two:skills']=['acrobatics','perception']}));
      assert.ok(!low.pendingChoices.some(x=>x.key==='fighter-two:subclass'),'not asked before the subclass level');
    });
    test('a feature gained twice gets its own choice key for the second copy',async()=>{
      const C=await world();
      C.features.register({id:'twice-test',name:'Twice Test',source:'original',description:'Pick a skill each time.',
        choices:[{id:'skill',pick:1,from:{kind:'skills'},excludeOwned:true}]});
      const copy=JSON.parse(JSON.stringify(C.classes.get('fighter')));
      copy.id='doubler';copy.name='Doubler';copy.features={1:['twice-test'],2:['twice-test']};copy.implementedLevel=2;copy.subclasses=[];copy.subclassLevel=undefined;
      delete copy.subclassLevel;
      C.classes.register(copy);
      const s=Fable.character.compute(heroBuild(C,b=>{
        b.classLevels=[{class:'doubler',level:2,hp:'average'}];
        ['fighter:skills','fighter-fighting-style:style','weapon-mastery:weapons'].forEach(k=>delete b.choices[k]);
        b.choices['doubler:skills']=['acrobatics','perception'];
        b.choices['twice-test:skill']='arcana';
      }));
      assert.deepStrictEqual(s.pendingChoices.map(c=>c.key),['twice-test#2:skill']);
      const done=Fable.character.compute(heroBuild(C,b=>{
        b.classLevels=[{class:'doubler',level:2,hp:'average'}];
        ['fighter:skills','fighter-fighting-style:style','weapon-mastery:weapons'].forEach(k=>delete b.choices[k]);
        b.choices['doubler:skills']=['acrobatics','perception'];
        b.choices['twice-test:skill']='arcana';b.choices['twice-test#2:skill']='history';
      }));
      assert.deepStrictEqual(done.pendingChoices,[]);
      assert.ok(done.skills.arcana.proficient&&done.skills.history.proficient);
      assert.strictEqual(done.features.filter(f=>f.id==='twice-test').length,2);
    });
  });

  suite('phase 3: load-time validation of premade heroes',()=>{
    const premade=(id,build)=>Fable.content.characters.register({id:id,name:id,factory(){},build:build});
    test('the real premade hero passes validateAll with no warnings of its own',async()=>{
      const C=await world();
      const r=C.validate();
      assert.deepStrictEqual(r.errors,[]);
      assert.deepStrictEqual(r.warnings,[]);
    });
    test('a premade hero with a broken build fails validateAll naming the character and the problem',async()=>{
      const C=await world();
      premade('broken-hero',heroBuild(C,b=>{b.inventory.push({item:'vorpal-blade',qty:1});b.equipped.mainhand='dagger'}));
      const r=C.validate();
      assert.strictEqual(r.ok,false);
      assert.ok(r.errors.some(e=>/Character "broken-hero".*vorpal-blade/.test(e)),r.errors.join('\n'));
      assert.ok(!r.errors.some(e=>/"human-fighter"/.test(e)));
    });
    test('a premade hero with a pending choice fails validateAll',async()=>{
      const C=await world();
      premade('half-hero',heroBuild(C,b=>{delete b.choices['fighter:skills']}));
      const r=C.validate();
      assert.ok(r.errors.some(e=>/"half-hero" is a premade hero but still has a pending choice/.test(e)),r.errors.join('\n'));
    });
    test('warnings from a premade build are reported as warnings',async()=>{
      const C=await world();
      premade('hurt-hero',heroBuild(C,b=>{b.hpCurrent=99}));
      const r=C.validate();
      assert.strictEqual(r.ok,true);
      assert.ok(r.warnings.some(w=>/"hurt-hero".*above the maximum/.test(w)));
    });
    test('characters without a build (model only) are left alone, and missing content kinds skip the check',async()=>{
      const C=await world();
      premade('model-only',undefined);
      assert.deepStrictEqual(C.validate().errors,[]);
      H.fresh();H.loadRules();H.loadRegistry();
      Fable.content.characters.register({id:'lonely',name:'Lonely',factory(){},build:{v:1}});
      assert.strictEqual(Fable.content.validate().ok,true,'nothing is loaded, so builds cannot be checked yet');
    });
    test('addValidator replaces a validator of the same name and reports one that throws',async()=>{
      await world();
      let calls=0;
      Fable.content.addValidator('probe',()=>{calls++});
      Fable.content.addValidator('probe',ctx=>{calls+=10;ctx.fail('probe says no')});
      const r=Fable.content.validate();
      assert.strictEqual(calls,10);
      assert.ok(r.errors.includes('probe says no'));
      Fable.content.addValidator('boom',()=>{throw new Error('kaput')});
      assert.ok(Fable.content.validate().errors.includes('boom: kaput'));
      assert.throws(()=>Fable.content.addValidator('',()=>{}),/needs a name/);
      assert.throws(()=>Fable.content.addValidator('x'),/needs a function/);
    });
  });
};
