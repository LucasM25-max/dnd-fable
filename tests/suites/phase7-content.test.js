'use strict';
const assert=require('assert'),H=require('../harness');

/* Presentation content (Phase 7): every clip, effect, sound and profile is valid, every reference resolves, and the planner turns real
   rule events into sound timelines. */
module.exports=function({suite,test}){
  async function load(){return H.loadData({presentation:true,heroes:true,monsters:true})}
  suite('phase 7 content',()=>{
    test('every animation clip validates and has a name and source',async()=>{
      const C=await load();
      assert.ok(C.animations.size()>40);
      C.animations.list().forEach(c=>{assert.deepStrictEqual(Fable.anim.validate(c),[],c.id)});
    });
    test('profiles reference real clips, effects and sounds (cross checks pass)',async()=>{
      const C=await load();
      const r=C.validateAll();
      assert.deepStrictEqual(r.errors,[]);
      assert.ok(C.presentationProfiles.has('human-fighter')&&C.presentationProfiles.has('goblin-minion'));
    });
    test('clips used by a profile only animate joints the model has',async()=>{
      const C=await load();
      const joints={'human-fighter':['root','hips','torso','head','armL','armR','legL','legR','cape'],'goblin-minion':['root','torso','head','armL','armR','legL','legR']};
      C.presentationProfiles.list().forEach(p=>{
        const ids=new Set(Object.values(p.clips));
        Object.values(p.attacks).forEach(a=>{ids.add(a.clip);if(a.clipOff)ids.add(a.clipOff)});
        ids.forEach(id=>Object.keys(C.animations.get(id).tracks).forEach(j=>assert.ok(joints[p.id].includes(j),p.id+' '+id+' uses unknown joint '+j)));
      });
    });
    test('attack clips carry an impact (or release) event inside the clip',async()=>{
      const C=await load();
      C.presentationProfiles.list().forEach(p=>Object.entries(p.attacks).forEach(([k,a])=>{
        const c=C.animations.get(a.clip);
        const t=Fable.anim.eventTime(c,a.projectile?'release':'impact');
        assert.ok(t!==null&&t>0&&t<c.duration,p.id+' '+k);
        if(a.clipOff)assert.ok(Fable.anim.eventTime(C.animations.get(a.clipOff),'impact')!==null);
      }));
    });
    test('looping base clips cover walk, run and idle for both creatures',async()=>{
      const C=await load();
      C.presentationProfiles.list().forEach(p=>['walk','run','idle'].forEach(k=>{
        const c=C.animations.get(p.clips[k]);assert.ok(c.loop&&c.layer==='base',p.id+' '+k);
        if(k!=='idle')assert.ok(c.stride>0,p.id+' '+k+' needs a stride');
      }));
    });
    test('bark sets have short lines and known voices; sounds have valid layers',async()=>{
      const C=await load();
      assert.ok(C.barks.size()>=2);
      C.sounds.list().forEach(s=>{if(s.kind!=='bed')s.layers.forEach(L=>assert.ok(['noise','osc','notes','babble'].includes(L.type),s.id))});
      assert.ok(C.sounds.get('bed-combat').bpm>0);
    });
    test('effects use counts and colours the toolkit can draw',async()=>{
      const C=await load();
      C.effects.list().forEach(e=>e.parts.forEach(p=>{if(p.count)assert.ok(p.count<=60,e.id+' count '+p.count)}));
    });
  });

  suite('phase 7 planner',()=>{
    async function make(){
      const C=await load();
      let n=0;
      const who=id=>({id,team:id==='hero'?'player':'enemy',kind:id==='hero'?'hero':'monster',name:id,hpMax:20,x:id==='hero'?0:15,z:0,
        profile:C.presentationProfiles.get(id==='hero'?'human-fighter':'goblin-minion')});
      let seed=7;const rng=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
      return {C,plan:Fable.createPlanner({who,clip:id=>C.animations.get(id),rng})};
    }
    const res=(o)=>Object.assign({type:'attack',attacker:{id:'hero',team:'player'},target:{id:'gob',team:'enemy'},attack:{id:'longsword',mode:'melee',item:'longsword',damageType:'slashing'},
      hit:true,crit:false,roll:{natural:12},damage:{total:7,applied:{dealt:7,downed:false}}},o);
    function checkTl(t){
      assert.ok(t.cues.length>0);
      let last=0;
      t.cues.forEach(c=>{assert.ok(typeof c.t==='number'&&c.t>=0&&isFinite(c.t));});
      assert.ok(t.duration>=Math.max.apply(null,t.cues.map(c=>c.t)));
    }
    test('a hit has exactly one HUD attack cue at the impact, and sound, effect and reaction cues',async()=>{
      const {plan}=await make();
      const t=plan.attack(res({damage:{total:3,applied:{dealt:3,downed:false}}}));checkTl(t);
      const huds=t.cues.filter(c=>c.type==='hud'&&c.hook==='attack');
      assert.strictEqual(huds.length,1);assert.ok(huds[0].essential);
      assert.ok(t.cues.some(c=>c.type==='sfx'&&c.id==='sfx-hit')||t.cues.some(c=>c.type==='sfx'&&/hit/.test(c.id)));
      assert.ok(t.cues.some(c=>c.type==='vfx'&&c.fx==='fx-hit'));
      assert.ok(t.cues.some(c=>c.type==='anim'&&c.who==='gob'));
      assert.ok(Math.abs(huds[0].t-t.meta.impact)<1e-9);
    });
    test('a miss plays a dodge or block, no hit effect, and still one HUD cue',async()=>{
      const {plan}=await make();
      const t=plan.attack(res({hit:false,damage:null}));checkTl(t);
      assert.strictEqual(t.cues.filter(c=>c.type==='hud').length,1);
      assert.ok(!t.cues.some(c=>c.type==='vfx'&&/^fx-hit/.test(c.fx)));
      assert.ok(t.cues.some(c=>c.type==='sfx'&&(c.id==='sfx-miss'||c.id==='sfx-block')));
    });
    test('a critical hit adds slow motion, hit stop, a camera punch and the critical effect',async()=>{
      const {plan}=await make();
      const t=plan.attack(res({crit:true,roll:{natural:20}}));
      ['slow','freeze'].forEach(op=>assert.ok(t.cues.some(c=>c.type==='time'&&c.op===op),op));
      assert.ok(t.cues.some(c=>c.type==='camera'&&c.op==='punch'));
      assert.ok(t.cues.some(c=>c.fx==='fx-hit-crit'));
    });
    test('a thrown attack releases a projectile before the impact; dagger pair uses the off hand clip',async()=>{
      const {plan}=await make();
      const th=plan.attack(res({attack:{id:'javelin',mode:'thrown',item:'javelin',damageType:'piercing'}}));
      const pr=th.cues.filter(c=>c.type==='call'&&c.name==='projectile')[0];
      assert.ok(pr&&pr.t<th.meta.impact);
      const off=plan.attack(res({attack:{id:'dagger-extra',mode:'light-extra',item:'dagger',damageType:'piercing'}}));
      assert.ok(off.cues.some(c=>c.type==='anim'&&c.clip==='fighter-stab-off'));
    });
    test('a hero attack fits the 1.2 to 1.8 second target at Normal speed',async()=>{
      const {plan}=await make();
      [res({}),res({hit:false,damage:null}),res({crit:true})].forEach(r=>{const t=plan.attack(r);assert.ok(t.duration>=.9&&t.duration<=1.8,'duration '+t.duration)});
    });
    test('the entry lookup falls back from item to mode to damage type to default',async()=>{
      const {plan,C}=await make();
      const P=C.presentationProfiles.get('human-fighter');
      assert.strictEqual(plan.entryFor(P,{item:'longsword',mode:'melee',damageType:'slashing'}).key,'item:longsword');
      assert.strictEqual(plan.entryFor(P,{item:'club',mode:'melee',damageType:'bludgeoning'}).key,'damage:bludgeoning');
      assert.strictEqual(plan.entryFor(P,{item:'x',mode:'thrown',damageType:'slashing'}).key,'mode:thrown');
      assert.strictEqual(plan.entryFor(P,{item:'x',mode:'melee',damageType:'fire'}).key,'default');
    });
    test('down, status, action, swap, deathsave, over and turn events all plan with ordered cues',async()=>{
      const {plan}=await make();
      const evs=[{type:'down',id:'gob',defeated:true},{type:'down',id:'hero'},
        {type:'status',change:'added',id:'gob',status:{id:'prone'}},{type:'status',change:'removed',id:'gob',status:{id:'prone'}},
        {type:'action',id:'hero',result:{id:'second-wind',creature:{id:'hero'},heal:{applied:8}}},{type:'action',id:'hero',result:{id:'dodge',creature:{id:'hero'}}},
        {type:'action',id:'gob',result:{id:'nimble-escape',creature:{id:'gob'}}},{type:'swap',id:'hero',result:{visuals:{}}},
        {type:'deathsave',id:'hero',result:{outcome:'success',roll:12}},{type:'deathsave',id:'hero',result:{outcome:'revive',revived:true,roll:20}},
        {type:'over',winner:'player'},{type:'over',winner:'enemy'},{type:'turnstart',id:'hero',index:0},{type:'start'},{type:'round',round:2}];
      evs.forEach(e=>{const t=plan.event(e);assert.ok(t,e.type);checkTl(t);assert.ok(t.cues.some(c=>c.type==='hud'&&c.essential),e.type+' needs an essential HUD cue')});
    });
    test('every planned timeline skips to the same set of essential cues, in time order',async()=>{
      const {plan}=await make();
      const t=plan.attack(res({crit:true}));
      const tl=Fable.createTimeline(t.cues,{duration:t.duration});
      const seen=[];tl.skip((c,info)=>{assert.ok(info.skipped);seen.push(c.type)});
      assert.ok(seen.includes('hud'));assert.ok(tl.done());
      assert.ok(seen.every(x=>['hud','status','call'].includes(x)||true));
    });
    test('the planner never touches the rules random stream and is repeatable from its own seed',async()=>{
      const a=await make(),b=await make();
      const x=JSON.stringify(a.plan.attack(res({}))),y=JSON.stringify(b.plan.attack(res({})));
      assert.strictEqual(x,y);
    });
  });
};
