'use strict';
const assert=require('assert'),H=require('../harness');
const byId=(C,id)=>C.items.get(id);
const ofType=(C,t)=>C.items.filter(i=>i.type===t);

module.exports=function({suite,test}){
  suite('items',()=>{
    test('counts: 38 weapons, 13 armor rows, 7 packs, 37 tools',async()=>{
      const C=await H.loadData();
      assert.strictEqual(ofType(C,'weapon').length,38);
      assert.strictEqual(ofType(C,'armor').length,13);
      assert.strictEqual(ofType(C,'pack').length,7);
      assert.strictEqual(ofType(C,'tool').length,37);
      assert.strictEqual(ofType(C,'gear').length,87);
      assert.strictEqual(C.items.size(),182);
    });
    test('weapon categories split 10, 4, 18 and 6',async()=>{
      const C=await H.loadData();
      const n=(c,k)=>ofType(C,'weapon').filter(w=>w.category===c&&w.kind===k).length;
      assert.deepStrictEqual([n('simple','melee'),n('simple','ranged'),n('martial','melee'),n('martial','ranged')],[10,4,18,6]);
    });
    test('every weapon mastery and property reference validates, and every mastery is used by some weapon',async()=>{
      const C=await H.loadData();
      const used=new Set(ofType(C,'weapon').map(w=>w.mastery));
      C.weaponMasteries.ids().forEach(m=>assert.ok(used.has(m),'no weapon uses '+m));
      ofType(C,'weapon').forEach(w=>{
        assert.ok(C.weaponMasteries.has(w.mastery),w.id);
        w.properties.forEach(p=>assert.ok(C.weaponProperties.get(p).onWeapons,w.id+' '+p));
      });
    });
    test('every weapon damage expression is valid dice and rolls within its range',async()=>{
      const C=await H.loadData();
      ofType(C,'weapon').forEach(w=>{
        assert.strictEqual(Fable.dice.validate(w.damage.dice),null,w.id);
        if(w.versatile)assert.strictEqual(Fable.dice.validate(w.versatile),null,w.id+' versatile');
      });
      assert.deepStrictEqual([Fable.dice.stats('1').min,Fable.dice.stats('1').max],[1,1]);
      assert.strictEqual(Fable.dice.stats(byId(C,'greatsword').damage.dice).max,12);
    });
    test('the tutorial weapons match section 11 of the plan',async()=>{
      const C=await H.loadData();
      const l=byId(C,'longsword'),d=byId(C,'dagger'),j=byId(C,'javelin');
      assert.deepStrictEqual([l.damage,l.versatile,l.mastery,l.costCp,l.weight],[{dice:'1d8',type:'slashing'},'1d10','sap',1500,3]);
      assert.deepStrictEqual([d.damage,d.properties,d.range,d.mastery,d.costCp,d.weight],[{dice:'1d4',type:'piercing'},['finesse','light','thrown'],{normal:20,long:60},'nick',200,1]);
      assert.deepStrictEqual([j.damage,j.properties,j.range,j.mastery,j.costCp,j.weight],[{dice:'1d6',type:'piercing'},['thrown'],{normal:30,long:120},'slow',50,2]);
    });
    test('ranged weapons name ammunition that exists, with storage',async()=>{
      const C=await H.loadData();
      const types={};
      ofType(C,'weapon').filter(w=>w.ammoType).forEach(w=>{types[w.ammoType]=1});
      assert.deepStrictEqual(Object.keys(types).sort(),['arrow','bolt','firearm-bullet','needle','sling-bullet']);
      Object.keys(types).forEach(t=>{
        const a=ofType(C,'gear').filter(g=>g.ammoType===t);
        assert.strictEqual(a.length,1,t);
        assert.ok(C.items.has(a[0].storage),t);
      });
      assert.strictEqual(byId(C,'sling').ammoType,'sling-bullet');
      assert.strictEqual(byId(C,'pistol').ammoType,'firearm-bullet');
    });
    test('the Lance is Two-Handed unless mounted',async()=>{
      const C=await H.loadData();
      assert.strictEqual(byId(C,'lance').twoHandedUnlessMounted,true);
      assert.strictEqual(ofType(C,'weapon').filter(w=>w.twoHandedUnlessMounted).length,1);
    });
    test('armor: AC rules, Strength requirements and stealth',async()=>{
      const C=await H.loadData();
      assert.deepStrictEqual(byId(C,'chain-mail').ac,{base:16,dex:'none'});
      assert.strictEqual(byId(C,'chain-mail').strengthRequirement,13);
      assert.strictEqual(byId(C,'chain-mail').stealthDisadvantage,true);
      assert.deepStrictEqual(byId(C,'breastplate').ac,{base:14,dex:'cap',dexCap:2});
      assert.deepStrictEqual(byId(C,'studded-leather-armor').ac,{base:12,dex:'full'});
      assert.deepStrictEqual(byId(C,'shield').ac,{bonus:2});
      assert.strictEqual(byId(C,'leather-armor').strengthRequirement,null);
      assert.strictEqual(byId(C,'leather-armor').stealthDisadvantage,false);
      assert.deepStrictEqual(ofType(C,'armor').filter(a=>a.strengthRequirement!==null).map(a=>a.id),['chain-mail','splint-armor','plate-armor']);
      assert.deepStrictEqual(ofType(C,'armor').filter(a=>a.stealthDisadvantage).map(a=>a.id),
        ['padded-armor','scale-mail','half-plate-armor','ring-mail','chain-mail','splint-armor','plate-armor']);
    });
    test('armor don and doff come from the category',async()=>{
      const C=await H.loadData();
      assert.deepStrictEqual([byId(C,'chain-mail').don,byId(C,'chain-mail').doff],[{minutes:10},{minutes:5}]);
      assert.deepStrictEqual([byId(C,'shield').don,byId(C,'shield').doff],[{action:'utilize'},{action:'utilize'}]);
      assert.deepStrictEqual([byId(C,'hide-armor').don,byId(C,'hide-armor').doff],[{minutes:5},{minutes:1}]);
    });
    test('costs are stored as exact integer copper',async()=>{
      const C=await H.loadData();
      C.items.list().forEach(i=>{assert.ok(Number.isInteger(i.costCp)&&i.costCp>=0,i.id);assert.strictEqual(i.costCp,Fable.money.toCp(i.cost),i.id)});
      assert.strictEqual(byId(C,'plate-armor').costCp,150000);
      assert.strictEqual(byId(C,'javelin').costCp,50);
      assert.strictEqual(byId(C,'dart').costCp,5);
    });
    test('packs: the weight of every pack equals the weight of its contents',async()=>{
      const C=await H.loadData();
      ofType(C,'pack').forEach(p=>{
        const w=p.contents.reduce((s,e)=>s+C.items.get(e.item).weight*e.qty,0);
        assert.strictEqual(w,p.weight,p.id);
      });
    });
    test("the Explorer's Pack has the SRD contents",async()=>{
      const C=await H.loadData();
      const p=byId(C,'explorers-pack');
      assert.deepStrictEqual(p.contents,[{item:'backpack',qty:1},{item:'bedroll',qty:1},{item:'oil',qty:2},{item:'rations',qty:10},{item:'rope',qty:1},
        {item:'tinderbox',qty:1},{item:'torch',qty:10},{item:'waterskin',qty:1}]);
      assert.deepStrictEqual([p.costCp,p.weight],[1000,55]);
    });
    test('the tutorial kit costs 116 GP, weighs 129 lb and fits the 205 GP budget and the 255 lb capacity',async()=>{
      const C=await H.loadData();
      const kit=[['chain-mail',1],['shield',1],['longsword',1],['dagger',2],['javelin',4],['explorers-pack',1]];
      const cp=kit.reduce((s,[id,q])=>s+byId(C,id).costCp*q,0),wt=kit.reduce((s,[id,q])=>s+byId(C,id).weight*q,0);
      assert.strictEqual(cp,11600);
      assert.strictEqual(Fable.money.format(cp),'116 gp');
      assert.strictEqual(wt,129);
      assert.ok(cp<=205*100);
      assert.ok(wt<=17*15);
    });
    test('tools are items, with cost and weight copied from the tool',async()=>{
      const C=await H.loadData();
      C.tools.list().forEach(t=>{
        const it=byId(C,t.id);
        assert.strictEqual(it.type,'tool',t.id);
        assert.strictEqual(it.tool,t.id);
        assert.strictEqual(it.costCp,t.costCp,t.id);
        assert.strictEqual(it.weight,t.weight,t.id);
      });
    });
    test('gear details: Torch can be a weapon, magic items are marked, Healer\'s Kit has ten uses',async()=>{
      const C=await H.loadData();
      assert.deepStrictEqual(byId(C,'torch').asWeapon,{category:'simple',kind:'melee',damage:{dice:'1',type:'fire'}});
      assert.deepStrictEqual(ofType(C,'gear').filter(g=>g.magic).map(g=>g.id),['potion-of-healing','spell-scroll-cantrip','spell-scroll-level-1']);
      assert.strictEqual(byId(C,'healers-kit').uses,10);
      assert.strictEqual(byId(C,'costume').weight,4);
      assert.strictEqual(byId(C,'spyglass').costCp,100000);
    });
    test('every gear item and pack has a description',async()=>{
      const C=await H.loadData();
      C.items.filter(i=>i.type==='gear'||i.type==='pack').forEach(i=>assert.ok(i.description&&i.description.length>10,i.id));
    });
    test('item text is plain ASCII so it loads the same everywhere',async()=>{
      const C=await H.loadData();
      C.kindNames().forEach(k=>C[k].list().forEach(d=>assert.ok(/^[\x20-\x7e]*$/.test(JSON.stringify(d)),k+' '+d.id)));
    });
    test('ids are unique across all item types and items are frozen',async()=>{
      const C=await H.loadData();
      assert.strictEqual(new Set(C.items.ids()).size,C.items.size());
      assert.throws(()=>{'use strict';byId(C,'longsword').weight=9},TypeError);
      assert.throws(()=>{'use strict';byId(C,'longsword').damage.dice='9d9'},TypeError);
    });
  });

  suite('items: mistakes fail loudly',()=>{
    const bad=async(row,re)=>{const C=await H.loadData();assert.throws(()=>C.items.register(row),re,JSON.stringify(row).slice(0,80))};
    const base=()=>({id:'test-sword',name:'Test Sword',source:'original',type:'weapon',category:'martial',kind:'melee',cost:{gp:1},weight:1,
      damage:{dice:'1d8',type:'slashing'},properties:[],mastery:'sap'});
    test('a valid custom weapon registers',async()=>{const C=await H.loadData();C.items.register(base());assert.deepStrictEqual(C.validate().errors,[])});
    test('type, cost and weight problems',async()=>{
      await bad(Object.assign(base(),{type:'wand'}),/type must be one of/);
      await bad(Object.assign(base(),{cost:{gp:-1}}),/whole number of 0 or more/);
      await bad(Object.assign(base(),{cost:{zz:1}}),/unknown coin/);
      await bad(Object.assign(base(),{cost:15}),/must be an object of coins/);
      await bad(Object.assign(base(),{weight:-1}),/weight/);
      await bad(Object.assign(base(),{weight:'3'}),/weight/);
    });
    test('weapon field problems',async()=>{
      await bad(Object.assign(base(),{damage:{dice:'1d',type:'slashing'}}),/not valid dice/);
      await bad(Object.assign(base(),{kind:'flying'}),/melee/);
      await bad(Object.assign(base(),{properties:['versatile']}),/needs a versatile dice/);
      await bad(Object.assign(base(),{versatile:'1d10'}),/only make sense with the Versatile/);
      await bad(Object.assign(base(),{properties:['thrown']}),/needs a range/);
      await bad(Object.assign(base(),{range:{normal:20,long:60}}),/range only makes sense/);
      await bad(Object.assign(base(),{properties:['thrown'],range:{normal:60,long:20}}),/long above normal/);
      await bad(Object.assign(base(),{properties:['ammunition'],range:{normal:10,long:20},ammoType:'arrow'}),/must be Ranged/);
      await bad(Object.assign(base(),{kind:'ranged'}),/needs the Thrown or Ammunition/);
      await bad(Object.assign(base(),{properties:['light','light']}),/twice/);
      await bad(Object.assign(base(),{mastery:undefined}),/mastery/);
      await bad(Object.assign(base(),{twoHandedUnlessMounted:true}),/Two-Handed/);
    });
    test('armor field problems',async()=>{
      const a=()=>({id:'test-armor',name:'Test Armor',source:'original',type:'armor',category:'light',cost:{gp:1},weight:1,ac:{base:11,dex:'full'}});
      await bad(Object.assign(a(),{ac:{base:11,dex:'lots'}}),/ac.dex/);
      await bad(Object.assign(a(),{ac:{base:11,dex:'cap'}}),/dexCap/);
      await bad(Object.assign(a(),{ac:{base:11,dex:'full',dexCap:2}}),/dexCap only/);
      await bad(Object.assign(a(),{category:'shield'}),/Shield needs ac/);
      await bad(Object.assign(a(),{strengthRequirement:40}),/strengthRequirement/);
      await bad(Object.assign(a(),{don:{minutes:0}}),/don must be/);
    });
    test('gear and pack field problems',async()=>{
      const g=()=>({id:'test-gear',name:'Test Gear',source:'original',type:'gear',cost:{gp:1},weight:1,description:'A thing.'});
      await bad(Object.assign(g(),{description:''}),/description/);
      await bad(Object.assign(g(),{ammoType:'x'}),/amount and a storage/);
      await bad(Object.assign(g(),{amount:5}),/only for ammunition/);
      await bad(Object.assign(g(),{magic:false}),/magic/);
      const p=()=>({id:'test-pack',name:'Test Pack',source:'original',type:'pack',cost:{gp:1},weight:1,description:'A pack.',contents:[{item:'backpack',qty:1}]});
      await bad(Object.assign(p(),{contents:[]}),/contents/);
      await bad(Object.assign(p(),{contents:[{item:'backpack',qty:0}]}),/qty/);
      await bad({id:'t',name:'T',source:'original',type:'tool',cost:{gp:1},weight:1},/tool must be/);
    });
    test('validateAll catches broken references and wrong pack weights',async()=>{
      const C=await H.loadData();
      C.items.register(Object.assign(base(),{id:'ref-1',properties:['spiky']}));
      C.items.register(Object.assign(base(),{id:'ref-2',mastery:'slice'}));
      C.items.register(Object.assign(base(),{id:'ref-3',category:'exotic'}));
      C.items.register(Object.assign(base(),{id:'ref-4',damage:{dice:'1d6',type:'sparkles'}}));
      C.items.register(Object.assign(base(),{id:'ref-5',properties:['range']}));
      C.items.register(Object.assign(base(),{id:'ref-6',kind:'ranged',properties:['ammunition'],range:{normal:10,long:20},ammoType:'laser'}));
      C.items.register({id:'ref-pack',name:'P',source:'original',type:'pack',cost:{gp:1},weight:99,description:'p',contents:[{item:'backpack',qty:1},{item:'nope',qty:1}]});
      C.items.register({id:'ref-pack2',name:'P2',source:'original',type:'pack',cost:{gp:1},weight:99,description:'p',contents:[{item:'backpack',qty:1}]});
      C.items.register({id:'ref-pack3',name:'P3',source:'original',type:'pack',cost:{gp:1},weight:5,description:'p',contents:[{item:'explorers-pack',qty:1}]});
      const e=C.validate().errors.join('\n');
      [/ref-1.*unknown Weapon property "spiky"/s,/ref-2.*unknown Weapon mastery "slice"/s,/unknown weapon category "exotic"/,/unknown Damage type "sparkles"/,
       /"range" is a rule, not a property/,/no ammunition item has ammoType "laser"/,/unknown Item "nope"/,/weight is 99 lb but its contents weigh 5 lb/,/cannot contain another pack/]
        .forEach(re=>assert.match(e,re));
    });
  });
};
