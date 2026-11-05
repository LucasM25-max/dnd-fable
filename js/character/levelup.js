/* Levelling up (implementation plan, section 7 and Phase 10). Pure rules code: no DOM, no Three.js, no storage.

   Experience points decide when a hero may level up (the SRD XP table, Fable.tables). Reaching the XP does not change the hero by
   itself: the player takes the level on the Level Up screen (or the hub profile), sees what it brings, and confirms. That keeps the
   build record the only place a level lives, and the sheet is recomputed from it like everything else (build.js).

   Fable.character.levelup.status(build)    {classId, className, level, nextLevel, xp, nextLevelXp, xpToGo, earnedLevel, ready, blocked, reason}
                                            earnedLevel is the level the XP allows; ready means the next level can be taken now; blocked
                                            is set when the XP is there but the class has no rules for that level yet (implementedLevel)
   Fable.character.levelup.preview(build)   what taking the next level brings, or null when it cannot be taken:
                                            {classId, className, fromLevel, toLevel, hp:{from, to, gain, die, average, conMod},
                                             proficiency:{from, to}, features:[{id, name, description, action, passive, uses}],
                                             resources:[{id, label, from, to}], pending:[choice ...]}
   Fable.character.levelup.apply(build)     {ok, build, preview, reasons}  the build one level higher (hit points are the fixed average,
                                            as the SRD allows), or the reasons it cannot be done. The input is never changed.

   Only a character with one class is levelled here; a second class arrives with multiclassing. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var Ch=Fable.character=Fable.character||{};
var Lu=Ch.levelup={};

function clone(o){return JSON.parse(JSON.stringify(o))}
function totalLevel(build){
  var n=0;
  ((build&&build.classLevels)||[]).forEach(function(c){n+=c&&c.level||0});
  return n;
}
function classOf(build){
  var cl=build&&build.classLevels&&build.classLevels[0];
  return cl&&Fable.content&&Fable.content.classes?Fable.content.classes.get(cl.class):null;
}

Lu.status=function(build){
  var T=Fable.tables,def=classOf(build),level=totalLevel(build),xp=(build&&build.xp)||0;
  var out={classId:def?def.id:null,className:def?def.name:'',level:level,nextLevel:level+1,xp:xp,nextLevelXp:null,xpToGo:0,
    earnedLevel:level,ready:false,blocked:false,reason:''};
  if(!T||!def||!level){out.reason='This character has no class to level up';return out}
  var p=T.xpProgress(xp);
  out.earnedLevel=p.level;
  if(level>=T.maxLevel()){out.reason='Maximum level';return out}
  out.nextLevelXp=T.xpForLevel(level+1);
  out.xpToGo=Math.max(0,out.nextLevelXp-xp);
  if(build.classLevels.length>1){out.reason='Levelling a multiclass character arrives later';return out}
  if(p.level<=level){out.reason=(out.xpToGo)+' XP to level '+(level+1);return out}
  if(level+1>def.implementedLevel){
    out.blocked=true;out.reason='Level '+(level+1)+' of the '+def.name+' arrives in a later update';
    return out;
  }
  out.ready=true;
  return out;
};

function featureView(id,def){
  var f=Fable.content.features.get(id);
  if(!f)return {id:id,name:id,description:'',action:null,passive:true,uses:null};
  var act=(f.actions||[])[0]||null,res=(f.resources||[])[0]||null,uses=null;
  if(res){
    var max=Fable.content.valueAtLevel(res.max,def);
    uses={id:res.id,max:max,recharge:res.recharge||null};
  }
  return {id:f.id,name:f.name,description:f.description,action:act?{id:act.id,cost:act.cost}:null,passive:!act,uses:uses,stub:f.status==='stub'};
}

Lu.preview=function(build){
  var st=Lu.status(build);
  if(!st.ready)return null;
  var def=classOf(build),to=st.nextLevel;
  var before=Ch.compute(build),after=Ch.compute(Lu.bump(build,to));
  var die=def.hitDie,average=die/2+1;
  var gain=after.summary.hp-before.summary.hp;
  var levels={};levels[def.id]=to;
  var features=(def.features[to]||[]).map(function(id){return featureView(id,levels)});
  /* a feature that comes back (Indomitable at 13) is still listed, with its new numbers */
  var resources=[];
  Object.keys(after.resources).forEach(function(id){
    var a=after.resources[id],b=before.resources[id];
    if(!b)resources.push({id:id,label:a.label,from:0,to:a.max});
    else if(b.max!==a.max)resources.push({id:id,label:a.label,from:b.max,to:a.max});
  });
  return {classId:def.id,className:def.name,fromLevel:st.level,toLevel:to,
    hp:{from:before.summary.hp,to:after.summary.hp,gain:gain,die:die,average:average,conMod:gain-average},
    proficiency:{from:before.summary.proficiencyBonus,to:after.summary.proficiencyBonus},
    features:features.filter(function(f){return !f.stub}),stubs:features.filter(function(f){return f.stub}).map(function(f){return f.name}),
    resources:resources,pending:(after.pendingChoices||[]).map(function(c){return {key:c.key,label:c.label,message:c.message}}),
    issues:after.issues.filter(function(i){return i.severity==='error'})};
};

/* the build record one level higher, with no checks (apply and preview do those) */
Lu.bump=function(build,to){
  var b=clone(build);
  b.classLevels[0].level=to;
  b.classLevels[0].hp=b.classLevels[0].hp==='max'&&to===1?'max':'average';
  return b;
};

Lu.apply=function(build){
  var st=Lu.status(build);
  if(!st.ready)return {ok:false,reasons:[st.reason||'Not ready to level up']};
  var p=Lu.preview(build);
  if(p.issues.length)return {ok:false,reasons:p.issues.map(function(i){return i.message}),preview:p};
  /* a level that needs a decision (an Ability Score Improvement, a subclass) is refused until the screen can ask it */
  if(p.pending.length)return {ok:false,reasons:p.pending.map(function(c){return c.message||('A choice is needed: '+c.label)}),preview:p};
  var next=Lu.bump(build,st.nextLevel);
  /* what a level changes about the pools: a new pool starts full, and a pool that grew gains the new uses as spent ones stay spent */
  var rec=Ch.normalize(next);
  var before=Ch.compute(build),after=Ch.compute(rec);
  rec.resources=clone(rec.resources||{});
  Object.keys(after.resources).forEach(function(id){
    var a=after.resources[id],b=before.resources[id];
    if(b&&a.max>b.max&&Object.prototype.hasOwnProperty.call(rec.resources,id))rec.resources[id]=Math.min(a.max,rec.resources[id]+(a.max-b.max));
  });
  return {ok:true,build:rec,preview:p,reasons:[]};
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
