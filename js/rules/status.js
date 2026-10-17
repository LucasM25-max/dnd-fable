/* Conditions and effects on creatures, with durations (implementation plan, sections 12 and 15.10; Phase 6). Pure rules code:
   no DOM, no Three.js.

   A creature's `conditions` list holds status entries:
     {id, name, kind:'condition'|'effect', source:{id, name, creature}, expires:{creature, event}|null, note, speedMod?}
   `kind` is 'condition' for the SRD conditions (Prone, Unconscious ...) and 'effect' for what a feature or mastery puts on a
   creature (Sapped, Slowed, Dodging, Disengaged). `expires` says when the entry ends: at the 'turnstart' or the 'turnend' of
   the creature with that id ("until the start of your next turn" is {creature: <the source>, event:'turnstart'}).

   Fable.status.add(s, c, spec)         put a status on a creature (refreshes one it already has); returns {entry, added}
   Fable.status.remove(s, c, id)        take it off; returns true when it was there
   Fable.status.expire(s, creatureId, event)   end every status that expires at this creature's turn start or end
   Fable.status.has(c, id)              the creature has the status, directly or because another one includes it
   Fable.status.attackMods(attacker, target, {distanceFt})   advantage and disadvantage sources for an attack roll between two
                                        creatures, plus whether a hit is an automatic Critical Hit
   Fable.status.speedFt(c, base)        speed after conditions (0 when grappled, restrained ...; Slowed takes 10 ft off)
   Fable.status.canAct(c), canReact(c)  false while Incapacitated (or defeated)
   Fable.status.describe(s, c, entry)   the tooltip text: what it does, who caused it and how long it lasts

   The mechanics of the conditions are the SRD ones (Rules Glossary); `includes` mirrors the registry data in
   rules-core/conditions.js and a test keeps the two in step. Conditions that need rules the game does not have yet
   (Charmed, Deafened, Invisible, Exhaustion levels) are named but have no effect on attack rolls here. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var St=Fable.status={};

/* attackBy      this creature's own attack rolls: 'dis' or 'adv'
   attackAgainst attack rolls against it: 'adv', 'dis', or 'prone' (advantage within 5 ft, otherwise disadvantage)
   autoCrit      a hit from within this many feet is a Critical Hit
   speed0        its Speed is 0           speedMod  feet added to its Speed (negative slows)
   consumedOnAttack  the entry ends after the creature makes an attack roll */
var DEFS={
  sapped:{name:'Sapped',kind:'effect',attackBy:'dis',consumedOnAttack:true,text:'Disadvantage on its next attack roll.'},
  slowed:{name:'Slowed',kind:'effect',speedMod:-10,text:'Speed reduced by 10 ft.'},
  dodging:{name:'Dodging',kind:'effect',attackAgainst:'dis',text:'Attack rolls against it have Disadvantage.'},
  disengaged:{name:'Disengaged',kind:'effect',text:'Its movement does not provoke Opportunity Attacks.'},
  blinded:{name:'Blinded',kind:'condition',attackBy:'dis',attackAgainst:'adv',text:'Its attack rolls have Disadvantage; attack rolls against it have Advantage.'},
  frightened:{name:'Frightened',kind:'condition',attackBy:'dis',text:'Disadvantage on attack rolls while the source of fear is in sight.'},
  grappled:{name:'Grappled',kind:'condition',speed0:true,text:'Speed 0.'},
  incapacitated:{name:'Incapacitated',kind:'condition',incapacitated:true,text:'It cannot take actions, Bonus Actions or Reactions.'},
  paralyzed:{name:'Paralyzed',kind:'condition',includes:['incapacitated'],attackAgainst:'adv',autoCrit:5,speed0:true,text:'Incapacitated, Speed 0. Attack rolls against it have Advantage, and a hit from within 5 ft is a Critical Hit.'},
  petrified:{name:'Petrified',kind:'condition',includes:['incapacitated'],attackAgainst:'adv',speed0:true,text:'Turned to stone: Incapacitated, Speed 0. Attack rolls against it have Advantage.'},
  poisoned:{name:'Poisoned',kind:'condition',attackBy:'dis',text:'Disadvantage on attack rolls.'},
  prone:{name:'Prone',kind:'condition',attackBy:'dis',attackAgainst:'prone',text:'Disadvantage on its attack rolls. Attacks against it have Advantage within 5 ft and Disadvantage from further away.'},
  restrained:{name:'Restrained',kind:'condition',attackBy:'dis',attackAgainst:'adv',speed0:true,text:'Speed 0. Its attack rolls have Disadvantage; attack rolls against it have Advantage.'},
  stunned:{name:'Stunned',kind:'condition',includes:['incapacitated'],attackAgainst:'adv',text:'Incapacitated. Attack rolls against it have Advantage.'},
  unconscious:{name:'Unconscious',kind:'condition',includes:['incapacitated','prone'],attackAgainst:'adv',autoCrit:5,speed0:true,text:'Incapacitated and Prone, Speed 0. Attack rolls against it have Advantage, and a hit from within 5 ft is a Critical Hit.'},
  charmed:{name:'Charmed',kind:'condition',text:'It cannot attack the charmer.'},
  deafened:{name:'Deafened',kind:'condition',text:'It cannot hear.'},
  invisible:{name:'Invisible',kind:'condition',attackBy:'adv',attackAgainst:'dis',text:'Its attack rolls have Advantage; attack rolls against it have Disadvantage.'},
  exhaustion:{name:'Exhaustion',kind:'condition',text:'Cumulative: D20 Tests and Speed suffer.'}
};
St.DEFS=DEFS;

function def(id){return DEFS[id]||null}
St.def=def;
function nameOf(id){
  var d=def(id);
  if(d)return d.name;
  var r=Fable.content&&Fable.content.conditions&&Fable.content.conditions.get&&Fable.content.conditions.get(id);
  return r?r.name:id.charAt(0).toUpperCase()+id.slice(1).replace(/-/g,' ');
}

/* Every status id in effect on the creature, with the ones included by others (Unconscious brings Incapacitated and Prone).
   Each is {id, name, direct:bool, via}. */
function effective(c){
  var out=[],seen={};
  function put(id,direct,via,entry){
    if(seen[id]){if(direct&&!seen[id].direct){seen[id].direct=true;seen[id].entry=entry}return}
    var o={id:id,name:nameOf(id),direct:direct,via:via||null,entry:entry||null};
    seen[id]=o;out.push(o);
    var d=def(id);
    (d&&d.includes||[]).forEach(function(i){put(i,false,id,null)});
  }
  (c.conditions||[]).forEach(function(e){put(e.id,true,null,e)});
  return out;
}
St.effective=effective;
St.has=function(c,id){return effective(c).some(function(x){return x.id===id})};
St.get=function(c,id){
  var list=c.conditions||[];
  for(var i=0;i<list.length;i++)if(list[i].id===id)return list[i];
  return null;
};
St.list=function(c){return (c.conditions||[]).slice()};

function emit(s,e){if(s&&Fable.combat&&Fable.combat.emit)Fable.combat.emit(s,e)}

/* spec: {id, name?, kind?, source?:{id, name, creature}, expires?:{creature, event}, note?, speedMod?}
   A creature has one entry per id: adding it again refreshes who caused it and how long it lasts. */
St.add=function(s,c,spec){
  if(!spec||typeof spec.id!=='string'||!spec.id)throw new Error('Status: add needs an id');
  var d=def(spec.id),list=c.conditions||(c.conditions=[]);
  var entry={
    id:spec.id,name:spec.name||nameOf(spec.id),kind:spec.kind||(d&&d.kind)||'condition',
    source:spec.source?{id:spec.source.id||null,name:spec.source.name||'',creature:spec.source.creature||null}:null,
    expires:spec.expires?{creature:spec.expires.creature,event:spec.expires.event}:null,
    note:spec.note||''
  };
  if(spec.speedMod!==undefined)entry.speedMod=spec.speedMod;
  var old=St.get(c,spec.id);
  if(old){
    /* Slowed never stacks: the reduction stays at its largest, and the end moves to the later of the two */
    list[list.indexOf(old)]=entry;
    emit(s,{type:'status',change:'refreshed',id:c.id,status:entry});
    return {entry:entry,added:false};
  }
  list.push(entry);
  emit(s,{type:'status',change:'added',id:c.id,status:entry});
  return {entry:entry,added:true};
};
St.remove=function(s,c,id,why){
  var e=St.get(c,id);
  if(!e)return false;
  c.conditions=c.conditions.filter(function(x){return x!==e});
  emit(s,{type:'status',change:'removed',id:c.id,status:e,why:why||''});
  return true;
};
/* Ends what expires at this creature's turn start or end. Returns the removed entries as [{creature, status}]. */
St.expire=function(s,creatureId,event){
  var removed=[];
  if(!s)return removed;
  s.creatures.forEach(function(c){
    (c.conditions||[]).slice().forEach(function(e){
      if(e.expires&&e.expires.creature===creatureId&&e.expires.event===event){
        St.remove(s,c,e.id,'expired');
        removed.push({creature:c.id,status:e});
      }
    });
  });
  return removed;
};

St.canAct=function(c){
  if(!c.alive)return false;
  return !effective(c).some(function(x){var d=def(x.id);return d&&d.incapacitated});
};
St.canReact=function(c){return St.canAct(c)&&!c.down};

St.speedFt=function(c,base){
  base=base===undefined?c.speedFt:base;
  var list=effective(c),v=base;
  if(list.some(function(x){var d=def(x.id);return d&&d.speed0}))return 0;
  (c.conditions||[]).forEach(function(e){
    var m=e.speedMod!==undefined?e.speedMod:(def(e.id)||{}).speedMod;
    if(m)v+=m;
  });
  return Math.max(0,v);
};

/* Sources for an attack roll from `attacker` against `target`, as label lists for the tooltip. distanceFt decides the
   Prone rule and the automatic critical hit. consume lists the attacker's own entries a roll uses up (Sapped). */
St.attackMods=function(attacker,target,opts){
  opts=opts||{};
  var dist=opts.distanceFt===undefined?5:opts.distanceFt;
  var adv=[],dis=[],autoCrit=false,consume=[];
  effective(attacker).forEach(function(x){
    var d=def(x.id);
    if(!d)return;
    if(d.attackBy==='dis')dis.push(x.direct?x.name:x.name+' ('+nameOf(x.via)+')');
    if(d.attackBy==='adv')adv.push(x.name);
    if(d.consumedOnAttack&&x.direct)consume.push(x.id);
  });
  effective(target).forEach(function(x){
    var d=def(x.id);
    if(!d)return;
    var label=x.direct?x.name:x.name+' ('+nameOf(x.via)+')';
    if(d.attackAgainst==='adv')adv.push('Target is '+label);
    else if(d.attackAgainst==='dis')dis.push('Target is '+label);
    else if(d.attackAgainst==='prone'){
      if(dist<=5)adv.push('Target is '+label+', within 5 ft');
      else dis.push('Target is '+label+', beyond 5 ft');
    }
    if(d.autoCrit&&dist<=d.autoCrit)autoCrit=true;
  });
  return {advantage:adv,disadvantage:dis,autoCrit:autoCrit,consume:consume};
};

St.describe=function(s,c,entry){
  var d=def(entry.id),lines=[entry.name];
  var text=entry.note||(d&&d.text)||'';
  if(entry.speedMod!==undefined&&entry.id==='slowed')text='Speed reduced by '+Math.abs(entry.speedMod)+' ft.';
  if(text)lines.push(text);
  if(entry.source&&entry.source.name){
    var who=entry.source.creature&&s&&s.byId&&s.byId[entry.source.creature];
    lines.push('From '+entry.source.name+(who?' ('+who.name+')':''));
  }
  if(entry.expires){
    var of=s&&s.byId&&s.byId[entry.expires.creature],nm=of?(of.team==='player'?'your':of.name+"'s"):'its';
    lines.push(entry.expires.event==='turnstart'?'Until the start of '+nm+' next turn':'Until the end of '+nm+' turn');
  }
  return lines.join('\n');
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
