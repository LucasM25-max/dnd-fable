/* The planner (implementation plan, sections 15.2 and 15.12). Pure: no DOM and no Three.js. The rules resolve an intent into a result
   that is already final; the planner turns one rule event into a timeline of cues (animation, effects, sound, camera, bark, screen,
   HUD) and the director plays it. Nothing here decides an outcome. It only times the presentation of one that is already known.

   var plan = Fable.createPlanner({who, clip, rng, profile})
     who(id)     -> {id, team, kind, name, defId, hpMax, hpNow, x, z, profile}   (the director knows positions; tests give stand-ins)
     clip(id)    -> a clip definition, for its duration and events
     rng()       -> a number from the presentation stream (never the rules stream), so a replay is the same
   plan.event(e) -> {id, cues, duration, tag, meta} or null for events that need no playback
   plan.reroll(id) / plan.ambush(ids) / plan.victoryOrbit() are used directly by the controller and the scene.

   Cue shapes (t in timeline seconds; essential cues change what the HUD or world shows as true and survive a skip):
     {t, type:'anim', who, clip, hold, speed, tag}        {t, type:'anim', who, op:'stop', tag}
     {t, type:'vfx', fx, at:'target'|'attacker'|'who'|'ground', who, y, dir:'forward'|'toTarget'|'fromAttacker', scale, color}
     {t, type:'sfx', id, who, gain}      {t, type:'camera', op:'shot'|'shake'|'punch'|'release', ...}
     {t, type:'time', op:'slow'|'freeze', scale, dur}      {t, type:'bark', who, situation}      {t, type:'screen', op, color, dur}
     {t, type:'hud', hook, e, essential:true}      {t, type:'call', name, args}      {t, type:'status', who, id, change} */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;

var DAMAGE_TINT={fire:0xff8a3a,cold:0x9fdcff,lightning:0xcfe2ff,poison:0x9de05a,acid:0xb6e84a,necrotic:0xa58ad8,radiant:0xfff0a8,psychic:0xe0a0ff,force:0xc8b4ff,thunder:0xd9d9ff};
var LEAD=.25;           /* the camera starts pushing in before the action starts, so the move is seen from its first frame */

function clamp(v,a,b){return v<a?a:v>b?b:v}
function evTime(clip,cue){
  var ev=(clip&&clip.events)||[];
  for(var i=0;i<ev.length;i++)if(ev[i].cue===cue)return ev[i].t;
  return null;
}

Fable.createPlanner=function(o){
  var who=o.who,getClip=o.clip,rnd=o.rng||Math.random;
  function dur(id,fallback){var c=id&&getClip(id);return c?c.duration:(fallback||.5)}
  function evt(id,cue,fallback){var c=id&&getClip(id),t=c?evTime(c,cue):null;return t===null||t===undefined?fallback:t}
  function chance(p){return rnd()<p}

  /* the attack entry for this attack: item, then mode, then damage type, then default */
  function entryFor(profile,a){
    var t=(profile&&profile.attacks)||{};
    var keys=[];
    if(a&&a.item)keys.push('item:'+a.item);
    if(a&&a.mode&&a.mode!=='melee'&&a.mode!=='light-extra')keys.push('mode:'+a.mode);
    if(a&&a.damageType)keys.push('damage:'+a.damageType);
    keys.push('default');
    for(var i=0;i<keys.length;i++)if(t[keys[i]])return {key:keys[i],e:t[keys[i]]};
    return {key:'none',e:{}};
  }
  function mk(id,cues,minDuration,tag,meta){
    var d=minDuration||0;
    cues.forEach(function(c){d=Math.max(d,c.t+(c.dur||0))});
    return {id:id,cues:cues,duration:d,tag:tag||null,meta:meta||{}};
  }
  function reaction(prof,name,fallback){return (prof&&prof.clips&&prof.clips[name])||fallback||null}

  /* ---------- attacks ---------- */
  function attack(r){
    var A=who(r.attacker.id),T=who(r.target.id),AP=A.profile||{},TP=T.profile||{};
    var pick=entryFor(AP,r.attack),ent=pick.e;
    var offhand=r.attack&&r.attack.mode==='light-extra';
    var clipId=offhand&&ent.clipOff?ent.clipOff:ent.clip;
    var clip=clipId&&getClip(clipId);
    var cues=[],L=LEAD;
    var thrown=!!ent.projectile;
    var flight=thrown?clamp(Math.hypot((A.x||0)-(T.x||0),(A.z||0)-(T.z||0))/230,.16,.5):0;
    var rel=thrown?evt(clipId,'release',.3):null;
    var impact=thrown?rel+flight:evt(clipId,'impact',(clip?clip.duration:.6)*.45);
    var crit=!!r.crit,hit=!!r.hit;
    var dealt=hit&&r.damage&&r.damage.applied?r.damage.applied.dealt||0:0;
    var frac=T.hpMax?dealt/T.hpMax:0;
    var downed=!!(r.damage&&r.damage.applied&&r.damage.applied.downed);
    var heavy=hit&&(frac>=.3||crit||/bludgeoning/.test(r.attack.damageType||''));
    var tint=DAMAGE_TINT[r.attack&&r.attack.damageType]||null;
    var big=crit||frac>=.4;

    cues.push({t:0,type:'call',name:'face',a:A.id,b:T.id});
    /* camera: pushes in over the pair, a little closer for a critical hit */
    cues.push({t:0,type:'camera',op:'shot',who:[A.id,T.id],dist:crit?.68:.8,pitch:-.05,yaw:(A.team==='player'?.18:-.18),in:LEAD+.12,hold:L+impact+.28,out:.55,tag:'attack'});
    if(clipId)cues.push({t:L,type:'anim',who:A.id,clip:clipId,tag:'attack'});
    if(ent.effort&&A.kind==='hero'&&chance(.7))cues.push({t:L+Math.max(0,impact-.22),type:'sfx',id:(AP.voice&&AP.voice.effort),who:A.id});
    if(!thrown&&clip){
      (clip.events||[]).forEach(function(ev){
        if(ev.cue==='whoosh'){
          if(ent.swingSound)cues.push({t:L+ev.t,type:'sfx',id:ent.swingSound,who:A.id,gain:big?1.1:.9});
          if(ent.swing)cues.push({t:L+ev.t-.02,type:'vfx',fx:ent.swing,at:'attacker',dir:'toTarget',y:0,color:tint});
        }
      });
    }
    if(thrown){
      cues.push({t:L+rel,type:'sfx',id:ent.swingSound||'sfx-throw',who:A.id});
      cues.push({t:L+rel,type:'call',name:'projectile',a:A.id,b:T.id,spec:ent.projectile,trail:ent.trail,dur:flight,hit:hit});
    }
    var I=L+impact;
    /* the HUD shows the result at the moment of impact: the dice card, the number over the head, the health bar */
    cues.push({t:I,type:'hud',hook:'attack',e:{type:'attack',result:r},essential:true});
    if(hit){
      var fx=crit?'fx-hit-crit':(heavy?'fx-hit-heavy':'fx-hit');
      cues.push({t:I,type:'vfx',fx:fx,at:'target',y:10,dir:'fromAttacker',color:tint});
      cues.push({t:I,type:'sfx',id:crit?'sfx-crit':(heavy?'sfx-hit-heavy':((TP.sounds&&TP.sounds.hit)||'sfx-hit')),who:T.id,gain:big?1.15:1});
      if(heavy&&!crit)cues.push({t:I,type:'sfx',id:(TP.sounds&&TP.sounds.hit)||'sfx-hit',who:T.id});
      cues.push({t:I,type:'call',name:'flash',who:T.id,color:tint||0xffffff,dur:crit?.22:.14,strength:crit?1.1:.9});
      cues.push({t:I,type:'time',op:'freeze',dur:crit?.13:(heavy?.09:.06)});
      cues.push({t:I,type:'camera',op:'shake',amp:crit?1.5:(heavy?1:.55),dur:crit?.4:.25});
      if(crit){
        cues.push({t:I,type:'camera',op:'punch',fov:.05,dur:.4});
        cues.push({t:I+.05,type:'time',op:'slow',scale:.3,dur:.3});
        cues.push({t:I,type:'screen',op:'flash',color:'#fff3d2',alpha:.32,dur:.22});
      }
      if(!downed){
        var rc=heavy?reaction(TP,'hitHeavy'):reaction(TP,'hitLight');
        if(rc)cues.push({t:I+.01,type:'anim',who:T.id,clip:rc,tag:'react'});
        if(TP.voice&&TP.voice.hurt&&(T.kind==='hero'||chance(.6)))cues.push({t:I+.03,type:'sfx',id:TP.voice.hurt,who:T.id});
        cues.push({t:I+.1,type:'bark',who:T.id,situation:'hurt'});
      }
      if(A.kind==='monster')cues.push({t:I+.2,type:'bark',who:A.id,situation:'hit'});
      if(T.kind==='hero'&&frac>=.2)cues.push({t:I,type:'screen',op:'vignette',color:'#a01818',alpha:clamp(.25+frac*.9,.25,.7),dur:.5});
    }else{
      /* a miss: the target slips it or takes it on the shield; the blade whistles past */
      var useBlock=TP.clips&&TP.clips.block&&T.kind==='hero'&&chance(.5);
      var mc=useBlock?TP.clips.block:reaction(TP,'dodge');
      if(mc)cues.push({t:Math.max(L,I-.07),type:'anim',who:T.id,clip:mc,tag:'react'});
      if(useBlock){
        cues.push({t:I,type:'vfx',fx:'fx-block',at:'target',y:10,dir:'fromAttacker'});
        cues.push({t:I,type:'sfx',id:'sfx-block',who:T.id});
        cues.push({t:I,type:'camera',op:'shake',amp:.3,dur:.15});
      }else{
        cues.push({t:I,type:'vfx',fx:'fx-miss',at:'target',y:10,dir:'fromAttacker'});
        cues.push({t:I,type:'sfx',id:'sfx-miss',who:T.id});
      }
      cues.push({t:I+.1,type:'bark',who:A.id,situation:'miss'});
    }
    if(A.kind==='monster')cues.push({t:L+.05,type:'bark',who:A.id,situation:'attack'});
    else if(hit&&frac>=.3)cues.push({t:I+.15,type:'bark',who:A.id,situation:'hit'});
    var total=Math.max(clip?L+clip.duration:0,I+.34)+.04;
    return mk('attack',cues,total,'attack',{hit:hit,crit:crit,impact:I,attacker:A.id,target:T.id,reaction:!!r.reaction});
  }

  /* ---------- the rest of the rule events ---------- */
  function down(e){
    var T=who(e.id),P=T.profile||{},c=reaction(P,'down');
    var cues=[{t:0,type:'camera',op:'shot',who:[e.id],dist:.78,pitch:-.04,in:.3,hold:.9,out:.6,tag:'down'},
      {t:0,type:'hud',hook:'down',e:e,essential:true}];
    if(c)cues.push({t:.04,type:'anim',who:e.id,clip:c,hold:true,tag:'down'});
    if(P.voice&&P.voice.down)cues.push({t:.04,type:'sfx',id:P.voice.down,who:e.id});
    var landT=c?evt(c,'thud',.6):.6;
    cues.push({t:.04+landT,type:'sfx',id:'sfx-thud',who:e.id});
    cues.push({t:.04+landT,type:'vfx',fx:(P.effects&&P.effects.land)||'fx-thud',at:'who',who:e.id,y:0});
    cues.push({t:.04+landT,type:'camera',op:'shake',amp:T.kind==='hero'?1:.5,dur:.3});
    if(T.kind==='monster'){
      cues.push({t:.04+landT+.1,type:'vfx',fx:(P.effects&&P.effects.death)||'fx-death',at:'who',who:e.id,y:0});
      cues.push({t:.04+landT,type:'sfx',id:'sfx-death',who:e.id,gain:.7});
      cues.push({t:.02,type:'bark',who:e.id,situation:'down'});
    }else{
      cues.push({t:.04,type:'time',op:'slow',scale:.45,dur:.7});
      cues.push({t:.04,type:'screen',op:'vignette',color:'#1a0000',alpha:.75,dur:1.4});
    }
    cues.push({t:.04,type:'status',who:e.id,id:'down',change:'added'});
    return mk('down',cues,(c?dur(c):.9)+.2,'down');
  }
  function action(e){
    var r=e.result,W=who(r.creature.id),P=W.profile||{},cl=P.clips||{},id=r.id;
    var cues=[],d=.5;
    var hud=function(t){cues.push({t:t,type:'hud',hook:'action',e:e,essential:true})};
    if(id==='second-wind'&&cl.secondWind){
      cues.push({t:0,type:'camera',op:'shot',who:[W.id],dist:.72,pitch:-.05,in:.3,hold:1,out:.5,tag:'heal'});
      cues.push({t:.1,type:'anim',who:W.id,clip:cl.secondWind});
      cues.push({t:.1+evt(cl.secondWind,'gulp',.5),type:'sfx',id:'sfx-gulp',who:W.id});
      var s=.1+evt(cl.secondWind,'surge',.85);
      cues.push({t:s,type:'vfx',fx:'fx-surge',at:'who',who:W.id,y:0});
      cues.push({t:s,type:'sfx',id:'sfx-surge',who:W.id});
      cues.push({t:s,type:'camera',op:'punch',fov:.025,dur:.35});
      cues.push({t:s,type:'call',name:'flash',who:W.id,color:0x8dffb0,dur:.4,strength:.7});
      cues.push({t:s+.05,type:'bark',who:W.id,situation:'heal'});
      hud(s);d=s+.55;
    }else if(r.heal){
      cues.push({t:0,type:'vfx',fx:'fx-heal',at:'who',who:W.id,y:0});cues.push({t:0,type:'sfx',id:'sfx-heal',who:W.id});hud(.3);d=.9;
    }else if(id==='dodge'&&cl.brace){
      cues.push({t:0,type:'anim',who:W.id,clip:cl.brace,hold:true,tag:'status:dodging'});
      cues.push({t:.1,type:'sfx',id:'sfx-draw',who:W.id,gain:.6});hud(.15);d=.6;
    }else if(id==='disengage'&&cl.disengage){
      cues.push({t:0,type:'anim',who:W.id,clip:cl.disengage});
      cues.push({t:.1,type:'vfx',fx:'fx-skid',at:'who',who:W.id,y:0,dir:'forward'});cues.push({t:.1,type:'sfx',id:'sfx-step',who:W.id});hud(.1);d=.6;
    }else if(id==='dash'&&cl.dash){
      cues.push({t:0,type:'anim',who:W.id,clip:cl.dash});cues.push({t:.1,type:'vfx',fx:'fx-run-dust',at:'who',who:W.id,y:0});hud(.1);d=.5;
    }else if(id==='nimble-escape'&&cl.nimble){
      cues.push({t:0,type:'anim',who:W.id,clip:cl.nimble});cues.push({t:.12,type:'vfx',fx:'fx-skid',at:'who',who:W.id,y:0,dir:'forward'});
      cues.push({t:.3,type:'sfx',id:'sfx-step',who:W.id});cues.push({t:.1,type:'bark',who:W.id,situation:'flee'});hud(.1);d=.55;
    }else if(id==='hide'&&cl.hide){
      cues.push({t:0,type:'anim',who:W.id,clip:cl.hide,hold:true,tag:'status:hidden'});cues.push({t:.1,type:'vfx',fx:'fx-skid',at:'who',who:W.id,y:0});hud(.1);d=.7;
    }else{
      cues.push({t:0,type:'sfx',id:'sfx-status',who:W.id,gain:.7});hud(0);d=.35;
    }
    return mk('action',cues,d,'action');
  }
  function swap(e){
    var r=e.result,W=who(e.id),P=W.profile||{},c=reaction(P,'swap');
    var cues=[{t:0,type:'camera',op:'shot',who:[W.id],dist:.74,pitch:-.05,in:.3,hold:.8,out:.5,tag:'swap'}];
    if(c)cues.push({t:.05,type:'anim',who:W.id,clip:c});
    var st=.05+evt(c,'swap',.4);
    cues.push({t:.1,type:'sfx',id:'sfx-draw',who:W.id});
    cues.push({t:st,type:'hud',hook:'swap',e:e,essential:true});
    cues.push({t:st,type:'vfx',fx:'fx-swap',at:'who',who:W.id,y:8});
    cues.push({t:st+.12,type:'sfx',id:'sfx-hit-steel',who:W.id,gain:.3});
    return mk('swap',cues,(c?dur(c):.8)+.15,'swap');
  }
  function status(e){
    var W=who(e.id),P=W.profile||{},cl=P.clips||{},sid=e.status&&e.status.id,cues=[],d=.05;
    cues.push({t:0,type:'hud',hook:'status',e:e,essential:true});
    if(e.change==='added'||e.change==='refreshed'){
      cues.push({t:0,type:'status',who:e.id,id:sid,change:'added',essential:true});
      if(e.change==='added'){
        cues.push({t:0,type:'sfx',id:'sfx-status',who:e.id,gain:.8});
        if(Fable.content&&Fable.content.effects&&Fable.content.effects.has('fx-aura-'+sid))cues.push({t:0,type:'vfx',fx:'fx-aura-'+sid,at:'who',who:e.id,y:0});
        if(sid==='prone'&&cl.prone)cues.push({t:0,type:'anim',who:e.id,clip:cl.prone,hold:true,tag:'status:prone'});
        else if(sid==='sapped'||sid==='slowed'||sid==='vexed')cues.push({t:0,type:'anim',who:e.id,clip:cl.flinch,layer:'additive'});
        d=.4;
      }
    }else if(e.change==='removed'){
      cues.push({t:0,type:'status',who:e.id,id:sid,change:'removed',essential:true});
      cues.push({t:0,type:'anim',who:e.id,op:'stop',tag:'status:'+sid});
      if(sid==='prone'&&cl.getup){cues.push({t:.05,type:'anim',who:e.id,clip:cl.getup});cues.push({t:.4,type:'sfx',id:'sfx-step',who:e.id});d=dur(cl.getup);}
    }
    cues.forEach(function(c){if(c.type==='anim'&&!c.clip&&c.op!=='stop')c.skip=true});
    return mk('status',cues.filter(function(c){return !c.skip}),d,'status');
  }
  function deathsave(e){
    var x=e.result,W=who(e.id),P=W.profile||{},cl=P.clips||{};
    var good=x.outcome==='success'||x.outcome==='stable'||x.outcome==='revive';
    var cues=[{t:0,type:'hud',hook:'deathsave',e:e,essential:true},{t:0,type:'sfx',id:'sfx-roll',who:W.id}];
    cues.push({t:.5,type:'sfx',id:good?'sfx-heal':'sfx-death',who:W.id,gain:.6});
    cues.push({t:.5,type:'camera',op:'shake',amp:good?.3:.8,dur:.3});
    if(x.revived&&cl.getup){cues.push({t:.5,type:'anim',who:W.id,clip:cl.getup});cues.push({t:.5,type:'status',who:W.id,id:'down',change:'removed',essential:true});cues.push({t:.5,type:'vfx',fx:'fx-heal',at:'who',who:W.id,y:0})}
    return mk('deathsave',cues,x.revived&&cl.getup?1.2:.9,'deathsave');
  }
  function turnstart(e){
    var cues=[{t:0,type:'hud',hook:'turnstart',e:e,essential:true},{t:0,type:'sfx',id:'sfx-turn',gain:.7}];
    cues.push({t:0,type:'camera',op:'release',tag:'attack'});
    return mk('turnstart',cues,.25,'turn');
  }
  function simple(hook){
    return function(e){return mk(hook,[{t:0,type:'hud',hook:hook,e:e,essential:true}],0,hook)};
  }
  function over(e){
    var win=e.winner==='player',cues=[{t:0,type:'hud',hook:'over',e:e,essential:true}],d=2;
    cues.push({t:0,type:'call',name:'outcome',win:win,essential:true});
    cues.push({t:.1,type:'time',op:'slow',scale:.4,dur:.6});
    cues.push({t:.2,type:'screen',op:'flash',color:win?'#fff0c0':'#200000',alpha:win?.3:.5,dur:.5});
    cues.push({t:.15,type:'sfx',id:win?'sfx-victory':'sfx-defeat',gain:1});
    cues.push({t:0,type:'call',name:'celebrate',win:win});
    d=win?2.6:2.4;
    return mk('over',cues,d,'over',{win:win});
  }
  function start(e){
    return mk('start',[{t:0,type:'hud',hook:'start',e:e,essential:true},{t:0,type:'sfx',id:'sfx-fight',gain:.8},{t:0,type:'call',name:'music',op:'start'}],.1,'start');
  }
  function reroll(id){
    var cues=[{t:0,type:'vfx',fx:'fx-star',at:'who',who:id,y:0},{t:0,type:'sfx',id:'sfx-star',who:id},{t:0,type:'sfx',id:'sfx-roll',who:id,gain:.6},
      {t:0,type:'screen',op:'flash',color:'#ffe9a0',alpha:.28,dur:.45},{t:0,type:'camera',op:'punch',fov:.035,dur:.5},{t:.1,type:'bark',who:id,situation:'inspire'}];
    return mk('reroll',cues,.7,'reroll');
  }
  /* the goblins spring from cover when the fight starts */
  function ambush(ids){
    var cues=[],i;
    ids.forEach(function(id,k){
      var P=(who(id).profile)||{},cl=P.clips||{},t=.15+k*.22;
      if(cl.taunt)cues.push({t:t,type:'anim',who:id,clip:cl.taunt});
      cues.push({t:t+.2,type:'vfx',fx:'fx-pop',at:'who',who:id,y:0});
      cues.push({t:t+.2,type:'sfx',id:'sfx-pop',who:id,gain:.8});
      if(k===0)cues.push({t:t+.15,type:'bark',who:id,situation:'ambush',force:true});
    });
    cues.push({t:.1,type:'camera',op:'shake',amp:.6,dur:.4});
    return mk('ambush',cues,.7+ids.length*.22,'ambush');
  }

  var handlers={
    attack:function(e){return attack(e.result)},
    down:down,action:action,swap:swap,status:status,deathsave:deathsave,turnstart:turnstart,over:over,start:start,
    round:simple('round'),dead:simple('dead')
  };
  return {
    event:function(e){var h=handlers[e.type];return h?h(e):null},
    attack:attack,reroll:reroll,ambush:ambush,entryFor:entryFor,
    handles:function(type){return !!handlers[type]},
    LEAD:LEAD
  };
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
