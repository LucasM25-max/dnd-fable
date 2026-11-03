'use strict';
const assert=require('assert'),H=require('../harness');

/* The first-launch tutorial script played through the real rules with a stub HUD: every step must be reachable by exactly what it asks
   for, the dice must give the lesson its hits and its miss, the goblins must do what is written, and the hero must win without ever
   being in danger. */
async function setup(){
  const C=await H.loadData({monsters:true,heroes:true});
  H.runFile('js/game/tutorial.js');H.runFile('js/content/tutorials/goblin-ambush.js');
  /* a fight starts after a night's rest, so the hero has Heroic Inspiration */
  let build=C.characters.get('human-fighter').build;
  build=Object.assign({},build,{resources:Object.assign({},build.resources,{'heroic-inspiration':1})});
  const hero=Fable.creature.fromSheet(Fable.character.compute(build),{id:'hero',team:'player',build});
  const a=Fable.creature.fromMonster(C.monsters.get('goblin-minion'),{index:0,id:'goblin-minion-1'});
  const b=Fable.creature.fromMonster(C.monsters.get('goblin-minion'),{index:1,id:'goblin-minion-2'});
  const grid=Fable.grid.create({cols:20,rows:20});
  const s=Fable.combat.create({grid,seed:11,creatures:[hero,a,b]});
  Fable.combat.place(s,hero,{c:5,r:10});Fable.combat.place(s,a,{c:8,r:7});Fable.combat.place(s,b,{c:9,r:7});
  const said=[],focus=[],ui={hints:[],beacon:undefined,nudges:0,announced:[]};
  const hud={mods:{elminster:{say:o=>said.push(o.text),hide(){},onSkip(){},nudge(){ui.nudges++}},tutorialCoach:{focus:f=>focus.push(f)}},promptActive:()=>false,prompt(){},announce:m=>ui.announced.push(m)};
  const marks={setHints:c=>{ui.hints=c},setBeacon:p=>{ui.beacon=p}};
  let finished=null;
  const t=Fable.createTutorial({id:'goblin-ambush',state:s,hero,foes:[a,b],hud,marks,grid,announce:m=>ui.announced.push(m),leave(){},finish:(w,sk)=>{finished={w,sk}}});
  return {s,hero,a,b,t,said,focus,ui,fin:()=>finished};
}
function enemyTurn(f,c){
  const plan=f.t.enemyPlan(c);
  plan.intents.forEach(it=>{assert.ok(Fable.ai.legal(f.s,c,it).ok,c.id+' '+JSON.stringify(it));Fable.ai.perform(f.s,c,it,{reactions:{}})});
  Fable.combat.endTurn(f.s);
}
module.exports=function(t){
  const {suite,test}=t;
  suite('tutorial script',()=>{
    test('the script registers, steps have their own ids, and a bad script is refused',async()=>{
      const f=await setup();
      const sc=Fable.tutorials.get('goblin-ambush');
      assert.ok(sc.steps.length>=10);
      assert.throws(()=>Fable.tutorials.register({id:'goblin-ambush',order:['hero'],steps:[{id:'x',until:'click'}]}),/already registered/);
      assert.throws(()=>Fable.tutorials.register({id:'t2',order:['hero'],steps:[{id:'x',until:'click'},{id:'x',until:'click'}]}),/own id/);
      assert.throws(()=>Fable.tutorials.register({id:'t3',order:['hero'],steps:[{id:'x'}]}),/until/);
      assert.throws(()=>Fable.createTutorial({id:'nope',state:f.s}),/Unknown tutorial/);
    });
    test('Elminster is brief: every line is short and the whole lesson is a few hundred characters',async()=>{
      await setup();
      const sc=Fable.tutorials.get('goblin-ambush');
      const lines=sc.steps.map(x=>x.say).filter(Boolean).concat(Object.values(sc.steps.reduce((o,x)=>Object.assign(o,x.on||{}),{})).map(x=>x.say)).concat([sc.victory]);
      lines.forEach(l=>assert.ok(l.split(/\s+/).length<=20,'too long: '+l));
      assert.ok(lines.join(' ').length<900);
    });
    test('the whole lesson plays through: gated clicks, fixed dice, scripted goblins, a safe win',async()=>{
      const f=await setup(),{s,hero,a,b,t:tut,ui}=f,Cb=Fable.combat;
      Cb.start(s,{order:tut.order()});tut.begin();
      assert.deepStrictEqual(s.order,['hero','goblin-minion-1','goblin-minion-2']);
      /* welcome: nothing can be done until the click */
      assert.strictEqual(tut.allowSlot('move'),false);assert.strictEqual(tut.allowEnd(),false);assert.ok(ui.nudges>=2);
      tut.event('click');
      assert.strictEqual(tut.allowSlot('attack:longsword:melee'),false,'only Move is asked for');
      assert.strictEqual(tut.allowSlot('move'),true);tut.event('slot',{id:'move'});
      /* the glowing squares: beside goblin 1, out of goblin 2's reach */
      assert.ok(ui.hints.length>=1);
      ui.hints.forEach(c=>{assert.ok(Math.max(Math.abs(c.c-a.cell.c),Math.abs(c.r-a.cell.r))===1);assert.ok(Math.max(Math.abs(c.c-b.cell.c),Math.abs(c.r-b.cell.r))>1)});
      assert.strictEqual(tut.allowClick({c:5,r:9},null,null),false,'a square that is not glowing');
      assert.strictEqual(tut.allowClick(null,a,'longsword:melee'),false,'no attacking yet');
      assert.strictEqual(tut.allowClick(ui.hints[0],null,null),true);
      assert.ok(Cb.move(s,hero,ui.hints[0],{reactions:{}}).ok);tut.event('moved');
      assert.strictEqual(tut.allowSlot('attack:longsword:melee'),true);tut.event('slot',{id:'attack:longsword:melee'});
      assert.strictEqual(tut.allowClick(null,b,'longsword:melee'),false,'the wrong goblin');
      assert.strictEqual(tut.allowClick(null,a,'longsword:melee'),true);
      let r=Cb.attack(s,hero,'longsword:melee',a,tut.attackOpts());
      assert.ok(r.hit&&!r.crit);assert.strictEqual(a.hp.current,2,'the first hit leaves the goblin wounded, not dead');
      tut.event('attack',{hit:true});
      assert.strictEqual(tut.allowEnd(),true);Cb.endTurn(s);tut.event('endturn');
      enemyTurn(f,a);enemyTurn(f,b);
      assert.ok(hero.hp.current<12&&hero.hp.current>=6,'goblin 1 hit the hero, goblin 2 missed: '+hero.hp.current);
      assert.ok(Cb.active(s)===hero&&s.round===2);tut.event('hero-turn');
      assert.strictEqual(tut.allowSlot('action:second-wind'),true);
      assert.ok(Cb.useAction(s,hero,'second-wind',{}).ok);tut.event('action',{id:'second-wind'});
      tut.event('slot',{id:'attack:longsword:melee'});
      const bp=Cb.beginAttack(s,hero,'longsword:melee',a,tut.attackOpts());
      assert.ok(bp.ok&&bp.pending.canReroll,'this one attack offers Heroic Inspiration');
      assert.strictEqual(bp.pending.roll.natural,2);
      tut.event('insp-offer');
      assert.deepStrictEqual(tut.rerollChoices([{id:'reroll'},{id:'keep'}]).map(c=>c.id),['reroll'],'the miss cannot be kept');
      const used=Cb.completeAttack(s,bp.pending,{reroll:true});
      assert.ok(used.hit&&!a.alive,'the reroll hits and finishes it');tut.event('attack',{hit:true});
      Cb.endTurn(s);tut.event('endturn');
      assert.strictEqual(a.alive,false);
      enemyTurn(f,b);
      assert.ok(hero.hp.current>=3,'the hero is never in danger: '+hero.hp.current);
      assert.ok(Cb.active(s)===hero);tut.event('hero-turn');
      assert.strictEqual(tut.attackOpts().noReroll,true,'no reroll offer on the last fight');
      assert.strictEqual(tut.allowClick(null,b,'longsword:melee'),true);
      r=Cb.attack(s,hero,'longsword:melee',b,tut.attackOpts());
      assert.ok(r.hit&&!b.alive);
      assert.strictEqual(s.phase,'over');assert.strictEqual(s.winner,'player');
      tut.event('over',{win:true});
      assert.deepStrictEqual(f.fin(),{w:true,sk:false});
      assert.strictEqual(s.fixed.length,0,'every fixed die was used');
      assert.ok(f.said.length>=10&&f.said[f.said.length-1]===Fable.tutorials.get('goblin-ambush').victory);
    });
    test('the lesson plays the same for any seed',async()=>{
      for(const seed of [1,2,3,4,5]){
        const f=await setup();
        f.s.rng=Fable.rng(seed);
        Fable.combat.start(f.s,{order:f.t.order()});f.t.begin();
        assert.deepStrictEqual(f.s.order,['hero','goblin-minion-1','goblin-minion-2']);
        f.t.event('click');f.t.event('slot',{id:'move'});
        assert.ok(f.ui.hints.length>=1,'seed '+seed);
      }
    });
  });
};
