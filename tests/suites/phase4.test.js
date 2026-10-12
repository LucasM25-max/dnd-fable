'use strict';
const assert=require('assert'),H=require('../harness');

/* Phase 4: inventory, equipment, loadouts and visible gear (implementation plan, section 20). */
async function world(){
  const C=await H.loadData();
  Fable.createHumanFighter=function(){};
  H.runFile('js/content/characters/human-fighter/definition.js');
  return C;
}
const hero=C=>JSON.parse(JSON.stringify(C.characters.get('human-fighter').build));
const ch=()=>Fable.character,Inv=()=>Fable.character.inventory;

module.exports=function(t){
  const {suite,test,skip}=t;
  suite('phase 4 equipment',()=>{
    test('loadout A and loadout B give AC 19 and AC 17 with correct breakdowns',async()=>{
      const C=await world(),b=hero(C),a=ch().compute(b);
      assert.strictEqual(a.summary.ac,19);
      assert.strictEqual(Fable.stats.explain(a.stats.ac),'Chain Mail 16 + Shield 2 + Defense 1 = 19');
      assert.strictEqual(Inv().activeLoadout(b),'a');
      const r=Inv().applyLoadout(b,'b');
      assert.ok(r.ok);
      const s=ch().compute(r.build);
      assert.strictEqual(s.summary.ac,17);
      assert.strictEqual(Fable.stats.explain(s.stats.ac),'Chain Mail 16 + Defense 1 = 17');
      assert.strictEqual(Inv().activeLoadout(r.build),'b');
      assert.strictEqual(s.summary.mainAttack.name,'Dagger');
    });
    test('swapping loadouts reports its cost: a Utilize action for the shield and free weapon changes',async()=>{
      const C=await world(),r=Inv().applyLoadout(hero(C),'b');
      assert.strictEqual(r.cost.utilize,1);
      assert.strictEqual(r.cost.minutes,0);
      assert.ok(r.cost.weaponChanges>=2);
      const back=Inv().applyLoadout(r.build,'a');
      assert.ok(back.ok);assert.strictEqual(ch().compute(back.build).summary.ac,19);
    });
    test('armor changes take minutes and are refused in combat',async()=>{
      const C=await world(),b=hero(C);
      const off=Inv().unequip(b,'body');
      assert.ok(off.ok);assert.ok(off.cost.minutes>0);
      assert.strictEqual(ch().compute(off.build).summary.ac,14,'10 + Dex 2 + Shield 2');
      const inCombat=Inv().unequip(b,'body',{inCombat:true});
      assert.strictEqual(inCombat.ok,false);
      assert.match(inCombat.reasons[0],/combat/);
      assert.ok(Inv().unequip(b,'offhand',{inCombat:true}).ok);
    });
    test('equip rules: slots, carried items and two-handed weapons',async()=>{
      const C=await world();let b=hero(C);
      assert.strictEqual(Inv().equip(b,'shield','mainhand').ok,false);
      assert.strictEqual(Inv().equip(b,'greatsword').ok,false,'not carried');
      b=Inv().add(b,'greatsword',1).build;
      const g=Inv().equip(b,'greatsword');
      assert.ok(g.ok);
      assert.strictEqual(g.build.equipped.mainhand,'greatsword');
      assert.ok(!g.build.equipped.offhand,'a two-handed weapon empties the off hand');
      assert.strictEqual(Inv().equip(g.build,'shield').ok,true);
      assert.ok(!Inv().equip(g.build,'shield').build.equipped.mainhand);
      assert.strictEqual(Inv().equip(b,'dagger','offhand').ok,true);
      assert.strictEqual(Inv().setEquipped(b,{mainhand:'dagger',offhand:'dagger'}).ok,true);
      assert.strictEqual(Inv().setEquipped(b,{mainhand:'longsword',offhand:'longsword'}).ok,false,'only one longsword');
    });
    test('removing an equipped item takes it off',async()=>{
      const C=await world(),r=Inv().remove(hero(C),'shield',1);
      assert.ok(r.ok);assert.ok(!r.build.equipped.offhand);
      assert.strictEqual(ch().compute(r.build).summary.ac,17);
      assert.strictEqual(Inv().remove(hero(C),'shield',2).ok,false);
    });
    test('packs unpack into their contents',async()=>{
      const C=await world(),r=Inv().unpack(hero(C),'explorers-pack');
      assert.ok(r.ok);assert.strictEqual(Inv().count(r.build,'explorers-pack'),0);
      assert.ok(Inv().count(r.build,'rope')>0||r.build.inventory.length>6);
    });
    test('money: gain, spend, buy and sell work in exact copper',async()=>{
      const C=await world();let b=hero(C);
      assert.strictEqual(Inv().purseCp(b),0);
      b=Inv().gain(b,1234).build;
      assert.strictEqual(Inv().purseCp(b),1234);
      assert.strictEqual(Inv().spend(b,5000).ok,false);
      b=Inv().spend(b,34).build;assert.strictEqual(Inv().purseCp(b),1200);
      const bought=Inv().buy(b,'dagger',1);
      assert.ok(bought.ok);assert.strictEqual(Inv().purseCp(bought.build),1200-C.items.get('dagger').costCp);
      assert.strictEqual(Inv().count(bought.build,'dagger'),3);
      assert.strictEqual(Inv().buy(hero(C),'longsword',1).ok,false);
      const sold=Inv().sell(bought.build,'dagger',1);
      assert.ok(sold.ok);assert.strictEqual(Inv().count(sold.build,'dagger'),2);
      assert.ok(Inv().purseCp(sold.build)>Inv().purseCp(bought.build));
    });
    test('Strength requirement and stealth effects follow the armor worn',async()=>{
      const C=await world();let b=hero(C);
      const base=ch().compute(b);
      assert.strictEqual(base.rollStates['skill:stealth'].state,'disadvantage');
      b.abilityScores.base.str=8;b.backgroundAsi={dex:2,con:1};
      const weak=ch().compute(b);
      assert.ok(weak.stats.speed.value<base.stats.speed.value,'chain mail needs Str 13');
      const bare=Inv().unequip(b,'body').build;
      assert.ok(!ch().compute(bare).rollStates['skill:stealth'],'no armor, no stealth penalty');
    });
    test('encumbrance is a variant rule and slows a character who carries too much',async()=>{
      const C=await world();let b=hero(C);
      const plain=ch().compute(b);
      assert.strictEqual(plain.carrying.level,'none');
      b=Inv().add(b,'warhammer',20).build;
      const off=ch().compute(b);
      assert.strictEqual(off.stats.speed.value,plain.stats.speed.value,'off by default');
      const on=ch().compute(b,{variants:{encumbrance:true}});
      assert.ok(on.carrying.encumbered);
      assert.ok(on.stats.speed.value<plain.stats.speed.value);
      assert.ok(on.carrying.weight>on.carrying.thresholds.encumbered);
    });
    test('loadouts can be saved and removed, and bad ones are rejected',async()=>{
      const C=await world(),b=hero(C);
      const s=Inv().saveLoadout(b,'javelins','Javelins');
      assert.ok(s.ok);assert.strictEqual(s.build.loadouts.length,3);
      assert.strictEqual(Inv().removeLoadout(s.build,'javelins').build.loadouts.length,2);
      assert.strictEqual(Inv().saveLoadout(b,'Bad Id','x').ok,false);
      const bad=hero(C);bad.loadouts.push({id:'a',name:'dup',equipped:{}});
      assert.ok(ch().checkRecord(ch().normalize(bad)).some(i=>i.severity==='error'));
      const slot=hero(C);slot.loadouts[0].equipped.head='x';
      assert.ok(ch().checkRecord(ch().normalize(slot)).some(i=>i.severity==='error'));
    });
  });

  suite('phase 4 visuals data',()=>{
    test('every weapon and armor has an item model, and models are valid content',async()=>{
      const C=await world();
      ['weapon','armor'].forEach(type=>C.items.list().filter(i=>i.type===type).forEach(i=>{
        assert.ok(i.visual&&C.itemModels.get(i.visual.model),i.id+' has no item model');
      }));
      assert.strictEqual(C.validateAll().ok,true);
    });
    test('sheet visuals differ between loadout A and B',async()=>{
      const C=await world(),a=ch().compute(hero(C)),b=ch().compute(Inv().applyLoadout(hero(C),'b').build);
      assert.strictEqual(a.visuals.worn.mainhand.item,'longsword');
      assert.strictEqual(a.visuals.worn.offhand.item,'shield');
      assert.strictEqual(b.visuals.worn.mainhand.item,'dagger');
      assert.strictEqual(b.visuals.worn.offhand.item,'dagger');
      assert.strictEqual(a.visuals.worn.body.item,'chain-mail');
      assert.ok(a.visuals.stowed.some(s=>s.item==='dagger'&&s.qty===2));
      assert.ok(b.visuals.stowed.some(s=>s.item==='longsword'));
      assert.ok(b.visuals.stowed.some(s=>s.item==='shield'));
      assert.ok(!b.visuals.stowed.some(s=>s.item==='dagger'));
    });
    test('the roster keeps a working build, swaps loadouts and tells listeners',async()=>{
      await world();H.runFile('js/character/roster.js');
      const R=ch().roster,seen=[];
      R.onChange((id,s)=>seen.push(s.summary.ac));
      assert.strictEqual(R.sheet('human-fighter').summary.ac,19);
      assert.ok(R.swap('human-fighter','b').ok);
      assert.strictEqual(R.sheet('human-fighter').summary.ac,17);
      assert.strictEqual(R.swap('human-fighter','nope').ok,false);
      R.reset('human-fighter');
      assert.deepStrictEqual(seen,[17,19]);
    });
  });

  let THREE=null;
  try{THREE=require('three')}catch(e){}
  suite('phase 4 models',()=>{
    if(!THREE){skip('item models, rigs and the equipment view (needs the "three" npm package)','run npm i three@0.128.0 --no-save to enable');return}
    async function scene(){
      const C=await H.loadData();
      globalThis.THREE=THREE;
      ['js/core/voxel.js','js/engine/gear-models.js','js/engine/equipment.js',
        'js/content/characters/human-fighter/model.js','js/content/monsters/goblin-minion/model.js'].forEach(H.runFile);
      H.runFile('js/content/characters/human-fighter/definition.js');
      H.runFile('js/content/monsters/goblin-minion/definition.js');
      return C;
    }
    const count=o=>{let n=0;o.traverse(x=>{if(x.isInstancedMesh)n+=x.count});return n};
    test('every item model builds, and weapons also build in their stowed form',async()=>{
      try{
        const C=await scene();
        C.items.list().filter(i=>i.visual).forEach(i=>{
          const o=Fable.gear.create(i.id);
          assert.ok(o&&count(o)>0,i.id+' drew nothing');
          if(Fable.gear.specFor(i.id).mount==='hand')assert.ok(count(Fable.gear.create(i.id,{stowed:true}))>0,i.id+' stowed');
        });
      }finally{delete globalThis.THREE}
    });
    test('the fighter and goblin expose joints, sockets and stow points',async()=>{
      try{
        await scene();
        const f=Fable.content.characters.create('human-fighter').rig,g=Fable.content.monsters.create('goblin-minion').rig;
        ['torso','head','armL','armR','legL','legR'].forEach(k=>assert.ok(f.joints[k],'fighter '+k));
        ['mainHand','offHand','forearmOff'].forEach(k=>assert.ok(f.sockets[k],'fighter '+k));
        ['hip','belt','back-flat','back-diag'].forEach(k=>assert.ok(f.stow[k]&&f.stow[k].length,'fighter stow '+k));
        ['head','armL','armR','legL','legR'].forEach(k=>assert.ok(g.joints[k],'goblin '+k));
        ['mainHand','offHand'].forEach(k=>assert.ok(g.sockets[k],'goblin '+k));
        assert.ok(g.stow.belt.length);
      }finally{delete globalThis.THREE}
    });
    test('applying a different loadout changes the model on screen, and only what changed',async()=>{
      try{
        const C=await scene();
        const fg=Fable.content.characters.create('human-fighter'),view=Fable.createEquipmentView(fg.rig);
        const a=ch().compute(hero(C)),b=ch().compute(Inv().applyLoadout(hero(C),'b').build);
        view.apply(a.visuals);
        const before=view.mounted(),n=count(fg.root);
        assert.ok(before.includes('body')&&before.includes('main')&&before.includes('off'));
        assert.ok(before.some(k=>k.indexOf('stow:hip')===0)||before.some(k=>k.indexOf('stow:belt')===0));
        assert.ok(count(fg.rig.sockets.forearmOff)>0,'shield on the forearm');
        view.apply(b.visuals);
        assert.ok(count(fg.rig.sockets.forearmOff)===0,'shield removed');
        assert.ok(count(fg.rig.sockets.offHand)>0,'dagger in the off hand');
        assert.ok(count(fg.rig.sockets.mainHand)>0);
        assert.notStrictEqual(count(fg.root),n);
        view.apply(a.visuals);
        assert.strictEqual(count(fg.root),n,'swapping back restores the model');
        view.clear();
        assert.strictEqual(view.mounted().length,0);
      }finally{delete globalThis.THREE}
    });
    test('the goblin draws its daggers from its equipment',async()=>{
      try{
        await scene();
        const def=Fable.content.monsters.get('goblin-minion'),m=Fable.content.monsters.create('goblin-minion');
        const v=Fable.equipmentVisualsFor(def);
        assert.strictEqual(v.worn.mainhand.item,'dagger');
        assert.strictEqual(v.stowed[0].qty,1);
        const view=Fable.createEquipmentView(m.rig).apply(v);
        assert.ok(count(m.rig.sockets.mainHand)>0&&count(m.rig.sockets.offHand)>0);
        assert.strictEqual(view.mounted().length,3);
      }finally{delete globalThis.THREE}
    });
  });
};
