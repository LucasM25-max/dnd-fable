'use strict';
const assert=require('assert'),H=require('../harness');
let THREE;try{THREE=require('three')}catch(e){}

async function world(){
  const C=await H.loadData({monsters:true,heroes:true});
  ['js/hud/models.js','js/hud/models-combat.js','js/hud/world-labels.js'].forEach(H.runFile);
  return C;
}
function buildOf(C,edit){const b=JSON.parse(JSON.stringify(C.characters.get('human-fighter').build));if(edit)edit(b);return b}
function fight(C,build){
  const hero=Fable.creature.fromSheet(Fable.character.compute(build||buildOf(C)),{id:'hero'});
  const foe=Fable.creature.fromMonster(C.monsters.get('goblin-minion'),{id:'foe'});
  foe.hp.current=foe.hp.max=200;
  const s=Fable.combat.create({grid:Fable.grid.create({cols:40,rows:40}),seed:7,creatures:[hero,foe]});
  Fable.combat.place(s,hero,{c:3,r:3});Fable.combat.place(s,foe,{c:4,r:3});
  Fable.combat.start(s);s.order=['hero','foe'];s.turn=0;
  return {s,hero,foe};
}
function nextTurn(s,hero){s.turn=0;hero.economy=Fable.creature.newEconomy(hero)}
function stateOf(c){return JSON.stringify([c.build,c.hands,c.economy,c.stock,c.thrown,c.ac,c.hp,c.resources])}
function overlaps(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}

module.exports=function({suite,test,skip}){
  suite('combat usability: carried weapons',()=>{
    test('a sheet alone retains the actual inventory needed to draw a carried weapon',async()=>{
      const C=await world(),b=buildOf(C),{s,hero,foe}=fight(C,b);
      assert.ok(hero.build);assert.notStrictEqual(hero.build,b);
      const oldAc=hero.ac.value;
      assert.ok(Fable.combat.attack(s,hero,'dagger:melee',foe,{noReroll:true}).ok);
      assert.strictEqual(hero.hands.mainhand,'dagger');assert.strictEqual(hero.hands.offhand,'shield');
      assert.strictEqual(hero.ac.value,oldAc);assert.ok(hero.economy.action);
      assert.ok(hero.economy.object,'stowing the sword uses the additional ordinary free interaction');
      assert.ok(!hero.attacks.some(a=>a.mode==='light-extra'),'drawing one dagger does not invent a pair');
    });
    test('Thrown draws are part of the attack, without an extra Draw or Action, even after an object interaction',async()=>{
      const C=await world(),{s,hero,foe}=fight(C);
      hero.economy.object=true;
      const r=Fable.combat.attack(s,hero,'javelin:thrown',foe,{noReroll:true});
      assert.ok(r.ok,r.reason);assert.strictEqual(r.cost,'action');
      assert.strictEqual(hero.thrown.javelin,1);assert.strictEqual(hero.stock.javelin,4);
      assert.strictEqual(hero.hands.mainhand,null);
      assert.ok(!Fable.combat.attackState(s,hero,Fable.combat.findAttack(hero,'javelin:melee'),{reaction:true}).ok,'reserves are not drawn for a Reaction');
    });
    test('ordinary automatic swaps cannot bypass an already spent free interaction',async()=>{
      const C=await world(),{s,hero,foe}=fight(C);hero.economy.object=true;
      const before=stateOf(hero),r=Fable.combat.beginAttack(s,hero,'dagger:melee',foe,{noReroll:true});
      assert.ok(!r.ok);assert.match(r.reason,/interaction/);assert.strictEqual(stateOf(hero),before);
    });
    test('invalid targets and spent Actions never draw gear or spend stock',async()=>{
      const C=await world(),{s,hero,foe}=fight(C);
      foe.cell={c:39,r:39};let before=stateOf(hero);
      let r=Fable.combat.beginAttack(s,hero,'javelin:thrown',foe,{noReroll:true});
      assert.ok(!r.ok);assert.match(r.reason,/range/);assert.strictEqual(stateOf(hero),before);
      foe.cell={c:4,r:3};hero.economy.action=true;before=stateOf(hero);
      r=Fable.combat.beginAttack(s,hero,'javelin:thrown',foe,{noReroll:true});
      assert.ok(!r.ok);assert.match(r.reason,/Action/);assert.strictEqual(stateOf(hero),before);
    });
    test('only the carried number of javelins can be thrown, and the empty attack stays visible with zero remaining',async()=>{
      const C=await world(),{s,hero,foe}=fight(C);
      for(let i=0;i<4;i++){nextTurn(s,hero);assert.ok(Fable.combat.attack(s,hero,'javelin:thrown',foe,{noReroll:true}).ok)}
      nextTurn(s,hero);const before=stateOf(hero),r=Fable.combat.beginAttack(s,hero,'javelin:thrown',foe);
      assert.ok(!r.ok);assert.match(r.reason,/No Javelin/);assert.strictEqual(stateOf(hero),before);
      const slot=Fable.hudModels.actionBar(s,hero).find(a=>a.id==='attack:javelin:thrown');
      assert.ok(slot&&!slot.ok);assert.strictEqual(slot.uses.current,0);
    });
    test('visuals follow each thrown copy, the last empty hand and pickup without inventing held or stowed weapons',async()=>{
      const C=await world(),{s,hero,foe}=fight(C);
      const packed=v=>v.stowed.filter(e=>e.item==='javelin').reduce((n,e)=>n+e.qty,0);
      for(let i=0;i<4;i++){
        nextTurn(s,hero);
        const r=Fable.combat.beginAttack(s,hero,'javelin:thrown',foe,{noReroll:true});
        assert.ok(r.ok,r.reason);
        assert.strictEqual(r.pending.visuals.worn.mainhand.item,'javelin','the weapon is visible before its release cue');
        assert.strictEqual(packed(r.pending.visuals),3-i);
        const sheetBefore=JSON.stringify(hero.sheet.visuals),v=Fable.creature.visuals(hero);
        assert.strictEqual(v.worn.mainhand,null);assert.strictEqual(packed(v),3-i);
        assert.strictEqual(v.worn.body.item,'chain-mail');assert.strictEqual(v.worn.offhand.item,'shield');
        assert.strictEqual(JSON.stringify(hero.sheet.visuals),sheetBefore,'deriving runtime visuals leaves the sheet untouched');
        assert.ok(Fable.combat.completeAttack(s,r.pending).ok);
      }
      const item=s.ground.find(g=>g.item==='javelin');
      Fable.combat.place(s,hero,item.cell);nextTurn(s,hero);
      const back=Fable.combat.pickup(s,hero);assert.ok(back.ok);
      const count=back.items.filter(e=>e.item==='javelin').length,restored=Fable.creature.visuals(hero);
      assert.ok(count>0);
      assert.strictEqual(restored.worn.mainhand,null,'picking up packs the weapon; it is not a free off-turn draw');
      assert.strictEqual(packed(restored),count);
      const r=Fable.combat.beginAttack(s,hero,'javelin:thrown',foe,{noReroll:true});
      assert.ok(r.ok,r.reason);assert.strictEqual(packed(r.pending.visuals),count-1);
      assert.strictEqual(packed(Fable.creature.visuals(hero)),count-1);
    });
    test('uncarried weapons cannot be drawn, even if a caller supplies their attack data',async()=>{
      const C=await world(),{s,hero,foe}=fight(C,buildOf(C,b=>{b.inventory=b.inventory.filter(i=>i.item!=='javelin')}));
      const jav=Fable.character.compute(buildOf(C)).attacks.find(a=>a.id==='javelin:thrown');
      const before=stateOf(hero),r=Fable.combat.beginAttack(s,hero,jav,foe);
      assert.ok(!r.ok);assert.strictEqual(stateOf(hero),before);
      assert.ok(!Fable.hudModels.actionBar(s,hero).some(a=>a.item==='javelin'));
    });
    test('two-handed and ammunition weapons never silently doff a Shield',async()=>{
      const C=await world(),b=buildOf(C,b=>b.inventory.push({item:'greatsword',qty:1},{item:'shortbow',qty:1},{item:'arrows',qty:1}));
      const {s,hero,foe}=fight(C,b),before=stateOf(hero);
      ['greatsword:melee','shortbow:ranged'].forEach(id=>{
        const r=Fable.combat.beginAttack(s,hero,id,foe,{noReroll:true});
        assert.ok(!r.ok);assert.match(r.reason,/Shield.*Action/);assert.strictEqual(stateOf(hero),before);
        const slot=Fable.hudModels.actionBar(s,hero).find(a=>a.attackId===id);assert.ok(slot&&!slot.ok);
      });
    });
    test('a legal carried two-handed weapon is drawn when the off hand is free',async()=>{
      const C=await world(),b=buildOf(C,b=>{delete b.equipped.offhand;b.inventory.push({item:'greatsword',qty:1})});
      const {s,hero,foe}=fight(C,b),r=Fable.combat.attack(s,hero,'greatsword:melee',foe,{noReroll:true});
      assert.ok(r.ok,r.reason);assert.strictEqual(hero.hands.mainhand,'greatsword');assert.ok(!hero.hands.offhand);
      assert.strictEqual(hero.ac.value,17);
    });
    test('the preview and resolved sheet use the same versatile grip after automatically drawing a sword',async()=>{
      const C=await world(),b=buildOf(C,b=>{b.equipped={body:'chain-mail',mainhand:'javelin'}});
      const {s,hero,foe}=fight(C,b),a=Fable.combat.findAttack(hero,'longsword:melee');
      const preview=Fable.combat.previewAttack(s,hero,a,foe);
      assert.strictEqual(preview.damage.expression,'1d10+3');
      assert.ok(Fable.combat.beginAttack(s,hero,a.id,foe,{noReroll:true}).ok);
      assert.strictEqual(Fable.combat.findAttack(hero,a.id).damage.expression,preview.damage.expression);
    });
    test('Light extras do not draw missing weapons; a later regular attack can refill a hand from actual reserves',async()=>{
      const C=await world(),b=buildOf(C,b=>{b.inventory.find(i=>i.item==='dagger').qty=3;b.equipped={body:'chain-mail',mainhand:'dagger',offhand:'dagger'}});
      const {s,hero,foe}=fight(C,b);
      assert.ok(Fable.combat.attack(s,hero,'dagger:thrown',foe,{noReroll:true}).ok);
      let extra=Fable.combat.findAttack(hero,'dagger:light-extra');
      assert.ok(!Fable.combat.attackState(s,hero,extra).ok,'two remaining copies do not mean two held copies');
      nextTurn(s,hero);
      assert.ok(Fable.combat.attack(s,hero,'dagger:melee',foe,{noReroll:true}).ok);
      extra=Fable.combat.findAttack(hero,'dagger:light-extra');
      assert.ok(Fable.combat.attackState(s,hero,extra).ok,'a normal Attack can draw the third carried dagger into the empty hand');
    });
    test('drawing preserves health, conditions, used consumables, resource pools and the roster record',async()=>{
      const C=await world(),b=buildOf(C,b=>b.inventory.push({item:'potion-of-healing',qty:1}));
      const original=JSON.stringify(b),{s,hero,foe}=fight(C,b);
      hero.hp.current=6;hero.resources['second-wind-uses'].current=0;
      hero.stock['potion-of-healing']=0;hero.itemsUsed['potion-of-healing']=1;
      Fable.creature.addCondition(hero,{id:'test-condition',name:'Test condition'});
      assert.ok(Fable.combat.attack(s,hero,'javelin:thrown',foe,{noReroll:true}).ok);
      assert.strictEqual(hero.hp.current,6);assert.strictEqual(hero.resources['second-wind-uses'].current,0);
      assert.strictEqual(hero.stock['potion-of-healing'],0);assert.ok(hero.conditions.some(c=>c.id==='test-condition'));
      assert.strictEqual(JSON.stringify(b),original,'combat draws do not rewrite the hub inventory');
    });
    test('drawing works after worker serialization and cannot mutate the original planning state',async()=>{
      const C=await world(),{s,hero,foe}=fight(C),before=stateOf(hero);
      const copied=Fable.combat.deserialize(JSON.parse(JSON.stringify(Fable.combat.serialize(s))));
      const h=copied.byId.hero;copied.order=['hero','foe'];copied.turn=0;
      assert.strictEqual(Fable.creature.visuals(h),null,'worker snapshots need no visual assets');
      assert.ok(Fable.aiCore.usable(h,Fable.combat.findAttack(h,'javelin:thrown')));
      assert.ok(Fable.combat.attack(copied,h,'javelin:thrown',copied.byId.foe,{noReroll:true}).ok);
      assert.strictEqual(h.hands.mainhand,null);assert.strictEqual(stateOf(hero),before);
      const clone=Fable.combat.clone(s);
      assert.ok(Fable.combat.attack(clone,clone.byId.hero,'dagger:melee',clone.byId[foe.id],{noReroll:true}).ok);
      assert.strictEqual(stateOf(hero),before);
    });
  });
  suite('combat usability: world targets',()=>{
    test('crowded nameplates are separated, clamped, deterministic and clear of HUD panels',async()=>{
      await world();
      const items=Array.from({length:6},(_,i)=>({id:'foe-'+i,x:188+i*2,y:490,w:145,h:44}));
      const obstacles=[{x:0,y:0,w:390,h:360},{x:0,y:712,w:390,h:132}];
      const out=Fable.layoutNameplates(items,390,844,obstacles);
      assert.strictEqual(out.length,6);assert.deepStrictEqual(Fable.layoutNameplates(items.slice().reverse(),390,844,obstacles),out);
      out.forEach((p,i)=>{
        assert.ok(p.x>=8&&p.x+p.w<=382&&p.y>=8&&p.y+p.h<=836);
        obstacles.concat(out.slice(0,i)).forEach(other=>assert.ok(!overlaps(p,other),JSON.stringify([p,other])));
      });
    });
    test('an overfull small viewport omits a nameplate rather than overlapping another target or the HUD',async()=>{
      await world();
      const items=Array.from({length:20},(_,i)=>({id:'foe-'+i,x:160,y:395,w:148,h:44}));
      const obstacles=[{x:8,y:0,w:304,h:362},{x:8,y:444,w:304,h:124}];
      const out=Fable.layoutNameplates(items,320,568,obstacles);
      assert.ok(out.length>0&&out.length<items.length);
      out.forEach((p,i)=>obstacles.concat(out.slice(0,i)).forEach(other=>assert.ok(!overlaps(p,other))));
    });
    if(!THREE){skip('animated whole-creature picking (needs optional three@0.128.0)','set NODE_PATH to the optional Three.js installation');return}
    test('head and body picking follows the scaled animated rig, ignores defeated creatures and keeps empty ground empty',async()=>{
      H.fresh();globalThis.THREE=THREE;
      try{
        H.runFile('js/core/voxel.js');H.runFile('js/game/creature-picker.js');
        const root=new THREE.Group(),joint=new THREE.Group();root.add(joint);
        Fable.b(joint,0,6,0,4,12,4,0xffffff);root.updateMatrixWorld(true);Fable.voxelize(joint,true);
        assert.ok(joint.children[0].userData.pickBounds,'voxel parts retain their actual coarse bounds');
        root.position.set(20,0,-10);root.scale.setScalar(.7);joint.rotation.z=.25;root.updateMatrixWorld(true);
        const creature={id:'foe',alive:true,cell:{c:2,r:2}},entries={foe:{creature,root}},picker=Fable.createCreaturePicker();
        [3,11].forEach(y=>{
          const target=joint.localToWorld(new THREE.Vector3(0,y,0));
          const ray=new THREE.Ray(target.clone().add(new THREE.Vector3(0,0,50)),new THREE.Vector3(0,0,-1));
          assert.strictEqual(picker.pick(ray,entries),creature);
          creature.alive=false;assert.strictEqual(picker.pick(ray,entries),null);creature.alive=true;
        });
        assert.strictEqual(picker.pick(new THREE.Ray(new THREE.Vector3(-50,10,50),new THREE.Vector3(0,0,-1)),entries),null);
      }finally{delete globalThis.THREE}
    });
  });
};
