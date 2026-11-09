'use strict';
const assert=require('assert'),H=require('../harness'),fs=require('fs'),path=require('path');
async function world(){return H.loadData({monsters:true,heroes:true,presentation:true})}
const read=f=>fs.readFileSync(path.join(H.ROOT,f),'utf8');

/* Things taken out or added with the Bestiary and Collection screens: no gold spilled on the map, no war paint, lore for every monster. */
module.exports=function(t){
  const {suite,test}=t;
  suite('menu cleanup',()=>{
    test('a defeated monster spills no coins and the hero collects none: the planner makes no coin or collect cue',async()=>{
      const C=await world();
      const info=id=>({id,team:id==='hero'?'player':'enemy',kind:id==='hero'?'hero':'monster',name:id,defId:id==='hero'?'human-fighter':'goblin-minion',hpMax:7,hpNow:0,x:0,z:0,
        profile:C.presentationProfiles.get(id==='hero'?'human-fighter':'goblin-minion'),drop:{cp:2500,tags:['hoard']}});
      const P=Fable.createPlanner({who:info,clip:id=>C.animations.get(id),rng:()=>.1});
      const names=tl=>tl?tl.cues.map(c=>c.name||c.type):[];
      const down=P.event({type:'down',id:'goblin-1',defeated:true,by:'hero'});
      assert.ok(down&&down.cues.some(c=>c.type==='vfx'),'the defeat itself is still planned (blood, dust, thud)');
      assert.ok(!names(down).includes('coins'),'no coins cue: '+names(down).join());
      const over=P.event({type:'over',winner:'player'});
      assert.ok(over,'the planner still plans the end of the fight');
      assert.ok(!names(over).includes('collect'),'no collect cue');
      assert.ok(names(over).includes('celebrate'),'the victory pose still plays');
    });
    test('the coin module and its wiring are gone, and the results screen still counts the gold',()=>{
      assert.ok(!fs.existsSync(path.join(H.ROOT,'js/presentation/coins.js')));
      assert.ok(!/coins\.js/.test(read('index.html')));
      const dir=read('js/presentation/director.js'),ctl=read('js/game/combat-controller.js');
      assert.ok(!/createCoins|collectCoins|coins\./.test(dir),'director');
      assert.ok(!/dropShares|drops:function/.test(ctl),'controller');
      assert.ok(/sfx-coin-tick/.test(read('js/hud/results.js')),'the gold count tick stays');
    });
    test('the gold is still paid in full by the rules',async()=>{
      await H.loadData({monsters:true,heroes:true});
      const eco=Fable.rewards.economy(),en=[{id:'a',xp:25,status:'defeated',treasure:[]},{id:'b',xp:25,status:'defeated',treasure:[]}];
      const r=Fable.rewards.compute({win:true,encounter:{rewards:{xp:'auto',gold:'auto',bonuses:false}},enemies:en,hero:{hp:10,hpMax:10},rounds:3,consumablesUsed:0,levels:[1],xpBefore:0,rng:()=>.5,economy:eco});
      assert.strictEqual(r.gold,50);assert.strictEqual(r.cp,5000);
    });
    test('the goblin warrior has no war paint: no red on the face in the model or the portrait',async()=>{
      const C=await world();
      const model=read('js/content/monsters/goblin-warrior/model.js');
      assert.ok(!/war paint|paintDark|paint=/.test(model),'model');
      const rows=C.monsters.get('goblin-warrior').portrait.rows;
      assert.ok(!rows.join('').includes('r'),'the red pixels are gone: '+rows[3]);
      assert.strictEqual(rows.length,12);rows.forEach(r=>assert.strictEqual(r.length,12));
    });
    test('every monster has lore for the Bestiary and a challenge rating to sort by',async()=>{
      const C=await world();
      C.monsters.list().forEach(m=>{
        assert.ok(typeof m.lore==='string'&&m.lore.length>40,m.id+' has lore');
        assert.ok(!isNaN(Fable.statblock.parseCr(m.challenge.cr)),m.id+' has a CR');
        const sb=Fable.statblock.derive(m);
        assert.ok(sb.actions.length>0,m.id+' has actions to list');
      });
    });
  });
};
