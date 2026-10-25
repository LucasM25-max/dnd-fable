'use strict';
const assert=require('assert'),H=require('../harness');

/* Phase 6: what the combat HUD shows is derived from the combat state by pure view models (implementation plan, section 13). */
async function world(){
  const C=await H.loadData({monsters:true,heroes:true});
  ['js/hud/models.js','js/hud/models-combat.js','js/hud/icons.js'].forEach(f=>H.runFile(f));
  return C;
}
function fight(C,loadout){
  let build=C.characters.get('human-fighter').build;
  if(loadout)build=Fable.character.inventory.applyLoadout(build,loadout,{}).build;
  const hero=Fable.creature.fromSheet(Fable.character.compute(build),{id:'hero',build});
  const a=Fable.creature.fromMonster(C.monsters.get('goblin-minion'),{index:0,id:'goblin-minion-1'});
  const s=Fable.combat.create({grid:Fable.grid.create({cols:20,rows:20}),seed:3,creatures:[hero,a]});
  Fable.combat.place(s,hero,{c:5,r:5});Fable.combat.place(s,a,{c:6,r:5});
  Fable.combat.start(s);s.order=['hero',a.id];s.turn=0;
  return {s,hero,a};
}
const M=()=>Fable.hudModels;

module.exports=function(t){
  const {suite,test}=t;
  suite('phase 6 hud models',()=>{
    test('the ability bar lists attacks, Second Wind, the standard actions and loadout swaps, numbered from 1',async()=>{
      const C=await world(),{s,hero}=fight(C);
      const bar=M().actionBar(s,hero,null);
      const ids=bar.map(x=>x.id);
      assert.ok(ids.indexOf('attack:longsword:melee')===0);
      ['action:second-wind','action:dash','action:disengage','action:dodge','swap:b'].forEach(id=>assert.ok(ids.indexOf(id)>=0,id));
      assert.ok(ids.indexOf('action:heroic-inspiration-reroll')<0,'the reroll is a prompt, not a slot');
      bar.forEach((x,i)=>assert.strictEqual(x.hotkey,i<9?String(i+1):i===9?'0':null));
    });
    test('every slot has an icon the icon set draws, a cost and a reason when it cannot be used',async()=>{
      const C=await world(),{s,hero}=fight(C);
      M();Fable.combat.useAction(s,hero,'dash');
      M().actionBar(s,hero,null).forEach(x=>{
        assert.ok(Fable.hudIcons.names.indexOf(x.icon)>=0,'icon '+x.icon);
        assert.ok(x.cost&&x.costLabel);
        if(!x.ok)assert.ok(x.reason,x.id+' says why');
      });
      const swd=M().actionBar(s,hero,null).find(x=>x.id==='action:second-wind');
      assert.ok(!swd.ok);assert.strictEqual(swd.uses.current,2);
    });
    test('slots read as unavailable with "Not your turn" while an enemy acts',async()=>{
      const C=await world(),{s,hero}=fight(C);
      Fable.combat.endTurn(s);
      M().actionBar(s,hero,null).forEach(x=>{assert.ok(!x.ok);assert.strictEqual(x.reason,'Not your turn')});
    });
    test('the armed attack is marked selected, and the dagger loadout offers the off-hand attack',async()=>{
      const C=await world(),{s,hero}=fight(C,'b');
      let bar=M().actionBar(s,hero,'dagger:melee');
      assert.ok(bar.find(x=>x.attackId==='dagger:melee').selected);
      assert.ok(!bar.find(x=>x.attackId==='dagger:light-extra').ok,'needs a Light attack first');
      assert.ok(bar.find(x=>x.attackId==='dagger:light-extra').name.indexOf('off-hand')>0);
      assert.ok(bar.find(x=>x.id==='swap:a'));
    });
    test('the target card carries AC, hit points and the attack preview numbers',async()=>{
      const C=await world(),{s,hero,a}=fight(C);
      const card=M().targetCard(s,hero,a,Fable.combat.findAttack(hero,'longsword:melee'));
      assert.strictEqual(card.ac,12);assert.strictEqual(card.hp.max,7);
      assert.ok(card.preview.ok);assert.strictEqual(card.preview.roll.hit,70);assert.strictEqual(card.preview.roll.crit,5);
      assert.strictEqual(card.preview.damage.text,'4-11');assert.strictEqual(card.preview.mastery.name,'Sap');
      assert.strictEqual(card.distanceFt,5);
    });
    test('the preview says why an attack cannot be made',async()=>{
      const C=await world(),{s,hero,a}=fight(C);
      Fable.combat.place(s,a,{c:10,r:5});
      const card=M().targetCard(s,hero,a,Fable.combat.findAttack(hero,'longsword:melee'));
      assert.ok(!card.preview.ok);assert.ok(/Out of reach/.test(card.preview.reason));
    });
    test('the preview names Advantage and Disadvantage with their sources',async()=>{
      const C=await world(),{s,hero,a}=fight(C);
      Fable.combat.endTurn(s);
      Fable.status.add(null,hero,{id:'prone'});
      const card=M().targetCard(s,a,hero,Fable.combat.findAttack(a,'dagger:melee'));
      assert.strictEqual(card.preview.roll.state,'advantage');
      assert.ok(card.preview.roll.sources.length>0);
    });
    test('the dice card shows both d20s, the outcome and the damage',async()=>{
      const C=await world(),{s,hero,a}=fight(C);
      s.rng=()=>0.99;
      const r=Fable.combat.attack(s,hero,'longsword:melee',a);
      const card=M().rollCard(r);
      assert.ok(card.hit&&card.crit&&card.outcome==='Critical hit');
      assert.strictEqual(card.d20.total,25);assert.strictEqual(card.d20.bonusText,'+5');assert.ok(card.damage.total>0);
      assert.strictEqual(M().rollCard({type:'x'}),null);
    });
    test('log lines name hit, miss and crit in words, and cover defeats and death saves',async()=>{
      const C=await world(),{s,hero,a}=fight(C);
      s.rng=()=>0.01;
      const miss=Fable.combat.attack(s,hero,'longsword:melee',a);
      assert.ok(/Natural 1, miss/.test(M().logEntry({type:'attack',result:miss},s).text));
      s.rng=()=>0.99;Fable.combat.endTurn(s);Fable.combat.endTurn(s);
      const hit=Fable.combat.attack(s,hero,'longsword:melee',a);
      const e=M().logEntry({type:'attack',result:hit},s);
      assert.ok(/Critical hit/.test(e.text));assert.strictEqual(e.tone,'crit');
      assert.ok(/is defeated/.test(M().logEntry({type:'down',id:a.id},s).text));
      assert.strictEqual(M().logEntry({type:'move',id:'hero',reactions:[]},s),null);
    });
    test('death save pips and statuses read from the creature',async()=>{
      const C=await world(),{s,hero,a}=fight(C);
      assert.strictEqual(M().deathPips(hero),null);
      Fable.combat.applyDamage(s,a,hero,hero.hp.current,{});
      hero.death.failures=2;
      assert.deepStrictEqual(M().deathPips(hero),{successes:0,failures:2,stable:false,dead:false});
      const chips=M().statusChips(hero,s);
      assert.ok(chips.some(c=>c.id==='unconscious'&&c.tip.length>0));
    });
    test('the sheet view lists abilities, attacks, pools and features',async()=>{
      const C=await world(),{hero}=fight(C);
      const v=M().sheetView(hero);
      assert.strictEqual(v.abilities.length,6);assert.strictEqual(v.ac,19);
      assert.ok(v.attacks.some(x=>x.name==='Longsword'&&x.mastery==='Sap'));
      assert.ok(v.resources.some(r=>r.name==='Second Wind'));
      assert.ok(v.features.length>3);
    });
    test('the encounter tutorial steps are validated: known events only',async()=>{
      await world();
      const E=Fable.content.encounters;
      assert.throws(()=>E.register({id:'t-bad',name:'x',map:'m',enemies:[],tutorial:[{id:'a',text:'x',when:'dance'}]}),/when must be one of/);
      assert.throws(()=>E.register({id:'t-bad2',name:'x',map:'m',enemies:[],tutorial:[{id:'a',when:'move'}]}),/needs an id and text/);
      E.register({id:'t-ok',name:'x',map:'m',enemies:[],tutorial:[{id:'a',text:'Move',when:'move'}]});
    });
    test('the knowledge policy hides enemy AC and exact hit points unless the encounter reveals them',async()=>{
      const C=await world(),{s,hero,a}=fight(C);
      a.reveal={ac:false,hp:false};
      const card=M().targetCard(s,hero,a,Fable.combat.findAttack(hero,'longsword:melee'));
      assert.strictEqual(card.ac,'?');assert.ok(!card.acKnown&&!card.hpKnown);assert.strictEqual(card.preview.roll.hit,'?');
      s.rng=()=>0.5;
      const r=Fable.combat.attack(s,hero,'longsword:melee',a);
      assert.ok(!/vs AC/.test(M().logEntry({type:'attack',result:r},s).text));
      assert.strictEqual(M().rollCard(r,s).d20.ac,'?');
      a.reveal={ac:true,hp:true};
      assert.ok(/vs AC 12/.test(M().attackLine(r,false)));
      assert.strictEqual(M().targetCard(s,hero,a,null).ac,12);
      assert.deepStrictEqual(M().knows({}),{ac:true,hp:true});
    });
    test('hud icons draw every name and a fallback for an unknown one',async()=>{
      await world();
      Fable.hudIcons.names.forEach(n=>assert.ok(Fable.hudIcons.svg(n).indexOf('<svg')===0));
      assert.ok(Fable.hudIcons.svg('nope').indexOf('<path')>0);
    });
  });
};
