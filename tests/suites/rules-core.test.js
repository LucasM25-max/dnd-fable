'use strict';
const assert=require('assert'),H=require('../harness');

module.exports=function({suite,test}){
  suite('rules-core data',()=>{
    test('everything loads and every cross reference validates',async()=>{
      const C=await H.loadData();
      const r=C.validate();
      assert.deepStrictEqual(r.errors,[]);
      assert.strictEqual(r.ok,true);
    });
    test('the expected kinds and sizes exist',async()=>{
      const C=await H.loadData();
      const sizes={abilities:6,skills:18,damageTypes:13,conditions:15,weaponProperties:10,weaponMasteries:8,languages:19,coins:5,
        weaponCategories:2,armorCategories:4,levels:20,proficiencyBands:8,tools:37};
      Object.keys(sizes).forEach(k=>assert.strictEqual(C[k].size(),sizes[k],k));
    });
    test('every row carries the srd52 source tag',async()=>{
      const C=await H.loadData();
      C.kindNames().forEach(k=>C[k].list().forEach(d=>assert.strictEqual(d.source,'srd52',k+' '+d.id)));
    });
    test('abilities are in the usual order with three letter abbreviations',async()=>{
      const C=await H.loadData();
      assert.deepStrictEqual(C.abilities.ids(),['str','dex','con','int','wis','cha']);
      assert.deepStrictEqual(C.abilities.list().map(a=>a.abbr),['STR','DEX','CON','INT','WIS','CHA']);
    });
    test('skills use the right abilities (spot checks from the hero and the SRD)',async()=>{
      const C=await H.loadData();
      const want={athletics:'str',acrobatics:'dex','sleight-of-hand':'dex',stealth:'dex',arcana:'int',history:'int',investigation:'int',nature:'int',religion:'int',
        'animal-handling':'wis',insight:'wis',medicine:'wis',perception:'wis',survival:'wis',deception:'cha',intimidation:'cha',performance:'cha',persuasion:'cha'};
      assert.deepStrictEqual(C.skills.ids().sort(),Object.keys(want).sort());
      Object.keys(want).forEach(id=>assert.strictEqual(C.skills.get(id).ability,want[id],id));
    });
    test('there are 13 damage types, including the three physical ones used by weapons',async()=>{
      const C=await H.loadData();
      ['bludgeoning','piercing','slashing','fire','force','radiant'].forEach(id=>assert.ok(C.damageTypes.has(id),id));
    });
    test('conditions: all 15 SRD conditions with their implied conditions',async()=>{
      const C=await H.loadData();
      assert.deepStrictEqual(C.conditions.ids(),['blinded','charmed','deafened','exhaustion','frightened','grappled','incapacitated','invisible',
        'paralyzed','petrified','poisoned','prone','restrained','stunned','unconscious']);
      assert.deepStrictEqual(C.conditions.get('unconscious').includes,['incapacitated','prone']);
      assert.deepStrictEqual(C.conditions.get('paralyzed').includes,['incapacitated']);
      assert.deepStrictEqual(C.conditions.get('stunned').includes,['incapacitated']);
      assert.deepStrictEqual(C.conditions.get('petrified').immuneTo,['poisoned']);
      assert.strictEqual(C.conditions.get('exhaustion').cumulative,true);
      assert.strictEqual(C.conditions.get('exhaustion').deathLevel,6);
      assert.strictEqual(C.conditions.get('blinded').cumulative,undefined);
    });
    test('weapon masteries: eight, each with a handler id and a valid trigger',async()=>{
      const C=await H.loadData();
      assert.deepStrictEqual(C.weaponMasteries.ids(),['cleave','graze','nick','push','sap','slow','topple','vex']);
      C.weaponMasteries.list().forEach(m=>assert.strictEqual(m.handler,'mastery.'+m.id));
      assert.strictEqual(C.weaponMasteries.get('slow').speedReduction,10);
      assert.strictEqual(C.weaponMasteries.get('push').distance,10);
      assert.deepStrictEqual(C.weaponMasteries.get('topple').save,{ability:'con',dcBase:8});
      assert.strictEqual(C.weaponMasteries.get('topple').condition,'prone');
    });
    test('weapon properties: Range is a rule, not a property weapons list',async()=>{
      const C=await H.loadData();
      assert.deepStrictEqual(C.weaponProperties.ids(),['ammunition','finesse','heavy','light','loading','range','reach','thrown','two-handed','versatile']);
      assert.strictEqual(C.weaponProperties.get('range').onWeapons,false);
      assert.strictEqual(C.weaponProperties.get('finesse').onWeapons,true);
      assert.strictEqual(C.weaponProperties.get('reach').reachBonus,5);
    });
    test('languages: the standard table rolls cover 1 to 12 exactly once',async()=>{
      const C=await H.loadData();
      const seen=[];
      C.languages.filter(l=>l.rarity==='standard'&&l.roll).forEach(l=>{for(let r=l.roll[0];r<=l.roll[1];r++)seen.push(r)});
      assert.deepStrictEqual(seen.sort((a,b)=>a-b),[1,2,3,4,5,6,7,8,9,10,11,12]);
      assert.strictEqual(C.languages.filter(l=>l.rarity==='rare').length,9);
      assert.strictEqual(C.languages.get('common').roll,null);
      assert.deepStrictEqual(C.languages.get('primordial').dialects,['Aquan','Auran','Ignan','Terran']);
      assert.ok(C.languages.has('dwarvish'));
    });
    test('coins agree with Fable.money',async()=>{
      const C=await H.loadData();
      Fable.money.COINS.forEach(c=>assert.strictEqual(C.coins.get(c.id).valueCp,c.cp));
    });
    test('armor categories: don and doff times',async()=>{
      const C=await H.loadData();
      const t=id=>[C.armorCategories.get(id).don,C.armorCategories.get(id).doff];
      assert.deepStrictEqual(t('light'),[{minutes:1},{minutes:1}]);
      assert.deepStrictEqual(t('medium'),[{minutes:5},{minutes:1}]);
      assert.deepStrictEqual(t('heavy'),[{minutes:10},{minutes:5}]);
      assert.deepStrictEqual(t('shield'),[{action:'utilize'},{action:'utilize'}]);
    });
    test('tools: 17 artisan, 6 other, 4 gaming sets and 10 instruments, each with a valid ability',async()=>{
      const C=await H.loadData();
      const n=c=>C.tools.filter(t=>t.category===c).length;
      assert.deepStrictEqual([n('artisan'),n('other'),n('gaming-set'),n('musical-instrument')],[17,6,4,10]);
      assert.strictEqual(C.tools.get('dice-set').costCp,10);
      assert.strictEqual(C.tools.get('thieves-tools').utilize.length,2);
      C.tools.filter(t=>t.category==='musical-instrument').forEach(t=>assert.strictEqual(t.ability,'cha'));
      C.tools.filter(t=>t.category==='gaming-set').forEach(t=>assert.strictEqual(t.ability,'wis'));
    });
    test('definitions are frozen so rules code cannot change them',async()=>{
      const C=await H.loadData();
      const s=C.skills.get('stealth');
      assert.throws(()=>{'use strict';s.ability='str'},TypeError);
      assert.throws(()=>{'use strict';C.conditions.get('prone').includes=[]},TypeError);
    });
    test('mistakes in rules data fail loudly',async()=>{
      const C=await H.loadData();
      assert.throws(()=>C.skills.register({id:'bad',name:'Bad',source:'x',ability:'dex'}),/examples/);
      assert.throws(()=>C.abilities.register({id:'foo',name:'Foo',source:'x',abbr:'fo',measures:'x'}),/abbr/);
      assert.throws(()=>C.conditions.register({id:'odd',name:'Odd',source:'x',description:'d',includes:['odd']}),/itself/);
      assert.throws(()=>C.weaponMasteries.register({id:'xx',name:'XX',source:'x',description:'d',handler:'mastery.other',trigger:'hit'}),/handler/);
      assert.throws(()=>C.languages.register({id:'zz',name:'ZZ',source:'x',rarity:'standard'}),/roll/);
    });
    test('a broken reference in rules data is reported by validate',async()=>{
      const C=await H.loadData();
      C.skills.register({id:'badref',name:'Bad Ref',source:'x',ability:'luck',examples:'e'});
      const r=C.validate();
      assert.strictEqual(r.ok,false);
      assert.ok(r.errors.some(e=>/Skill "badref".*unknown Ability "luck"/.test(e)),r.errors.join('\n'));
    });
    test('the SRD source filter keeps everything because all rows are srd52',async()=>{
      const C=await H.loadData({sources:['srd52']});
      assert.deepStrictEqual(C.validate().errors,[]);
      assert.strictEqual(C.items.size(),182);
    });
    test('a source filter that drops the SRD rows makes anything that refers to them fail validation',async()=>{
      const C=await H.loadData({sources:['original']});
      assert.strictEqual(C.items.size(),0);
      assert.strictEqual(C.skills.size(),0);
      assert.ok(C.weapons===undefined);
      C.items.register({id:'my-pack',name:'My Pack',source:'original',type:'pack',cost:{gp:1},weight:5,description:'p',contents:[{item:'backpack',qty:1}]});
      const r=C.validate();
      assert.strictEqual(r.ok,false);
      assert.match(r.errors.join('\n'),/unknown Item "backpack"/);
      assert.ok(r.warnings.length>0);
    });
  });
};
