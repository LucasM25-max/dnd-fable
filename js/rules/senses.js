/* Senses, light, cover, Hide and Search (implementation plan, sections 14.3 and 16.3; Phase 8). Pure rules code: no DOM, no
   Three.js, so the Node tests, the enemy AI (and its Web Worker) and the browser all see the same world.

   Seeing
     Fable.senses.cover(s, from, to)            the cover `to` has against `from` (Fable.grid.coverBetween)
     Fable.senses.effectiveLight(s, who, cell)  0 bright, 1 dim, 2 dark as `who` sees it: Darkvision makes dim light bright and
                                                darkness dim, out to its range (a Goblin sees 60 ft)
     Fable.senses.seesPlain(s, who, target)     who could see target ignoring Hidden: awake, not Blinded, some line between the
                                                squares (not Total Cover), and the target's square is not dark to them
     Fable.senses.sees(s, who, target)          who knows where target is: seesPlain, and the target is not Hidden from them
   Hiding (SRD 5.2.1, the Hide action): a DC 15 Dexterity (Stealth) check, possible only when no enemy can see you and you are
   Heavily Obscured or tucked behind a solid square (Total Cover); a creature is never made invisible, it is just not seen
     Fable.senses.hideCheck(s, c)               {ok, reason, seenBy}: could c try to hide here, now
     Fable.senses.hide(s, c)                    roll it; on a success c is Hidden, with its Stealth total kept as the DC to find it
     Fable.senses.searchTargets(s, c)           hidden enemies within 30 ft that c could find
     Fable.senses.search(s, c)                  the Search action: one Wisdom (Perception) check against every hidden enemy in range
     Fable.senses.revalidate(s, {except})       reveals Hidden creatures an enemy can now see (see below)
   Tactical Mind (Fighter level 2): a failed Hide or Search carries res.tacticalMind, an offer {kind, dice, resource, total, dc}, when
   the creature has the feature and a Second Wind use left
     Fable.senses.useTacticalMind(s, c, res)   roll the 1d10, add it to the check, and spend the Second Wind use only if that turns the
                                               failure into a success; emits a 'tactical-mind' event
   A Hidden creature cannot be targeted, and its first attack roll has Advantage (Fable.status). It stays Hidden when it moves, so a
   goblin can step out of cover and strike; it is found by a Search, by attacking, and by being seen: revalidate runs when an enemy
   finishes a move and when a creature's turn ends, but never for the creature that is moving now. Noise and Invisibility spells
   are not modelled. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var Se=Fable.senses={};
var St=function(){return Fable.status};
var Gr=function(){return Fable.grid};
var Cb=function(){return Fable.combat};

Se.HIDE_DC=15;
Se.SEARCH_RANGE_FT=30;
var DARK=2;

function hostile(a,b){return a.team!==b.team}
function standing(c){return !!c&&c.alive&&!c.down&&!!c.cell}

/* ---------- light and cover ---------- */
Se.darkvisionFt=function(c){return (c&&c.senses&&c.senses.darkvision)||0};
Se.lightAt=function(s,cell){return Gr().lightAt(s.grid,cell.c,cell.r)};
Se.effectiveLight=function(s,who,cell){
  var l=Se.lightAt(s,cell),dv=Se.darkvisionFt(who);
  if(l>0&&dv>0&&who&&who.cell&&Gr().distanceFt(who.cell,cell)<=dv)l-=1;
  return l;
};
Se.cover=function(s,from,to){
  return Gr().coverBetween(s.grid,from.cell||from,to.cell||to);
};

/* ---------- sight ---------- */
Se.isHidden=function(c){return !!St()&&St().has(c,'hidden')};
Se.seesPlain=function(s,who,target){
  if(who===target)return true;
  if(!who||!target||!who.cell||!target.cell)return false;
  if(!who.alive||who.down)return false;
  if(St()&&St().has(who,'blinded'))return false;
  if(Se.cover(s,who,target).level>=Gr().COVER.total)return false;
  if(Se.effectiveLight(s,who,target.cell)>=DARK)return false;
  return true;
};
Se.sees=function(s,who,target){
  if(!Se.seesPlain(s,who,target))return false;
  if(who!==target&&hostile(who,target)&&Se.isHidden(target))return false;
  return true;
};

/* ---------- ability bonuses a check uses ---------- */
function modOf(c,ab){var a=c.abilities&&c.abilities[ab];return a?(a.mod!==undefined?a.mod:a.modifier||0):0}
function skillBonus(c,id,ability){
  var sb=c.statblock&&c.statblock.skills&&c.statblock.skills[id];
  if(sb)return sb.value;
  var sk=c.sheet&&c.sheet.skills&&c.sheet.skills[id];
  if(sk)return sk.value;
  return modOf(c,ability);
}
Se.stealthBonus=function(c){return skillBonus(c,'stealth','dex')};
Se.perceptionBonus=function(c){return skillBonus(c,'perception','wis')};
var NORMAL={state:'normal',advantage:[],disadvantage:[]};
Se.stealthState=function(c){return (c.sheet&&c.sheet.rollStates&&c.sheet.rollStates['skill:stealth'])||NORMAL};
Se.perceptionState=function(c){return (c.sheet&&c.sheet.rollStates&&c.sheet.rollStates['skill:perception'])||NORMAL};

/* ---------- Hide ---------- */
/* Enemies that could notice c: awake, on the map, and not blind. */
function watchers(s,c){
  return s.creatures.filter(function(o){return o!==c&&hostile(c,o)&&standing(o)});
}
Se.hideCheck=function(s,c){
  var out={ok:false,reason:'',seenBy:[]};
  if(!c||!c.cell){out.reason='Nowhere to hide';return out}
  if(Se.isHidden(c)){out.reason='Already hidden';return out}
  var foes=watchers(s,c);
  if(!foes.length){out.reason='Nobody to hide from';return out}
  foes.forEach(function(o){if(Se.seesPlain(s,o,c))out.seenBy.push(o.id)});
  if(out.seenBy.length){
    var best=0;
    foes.forEach(function(o){if(out.seenBy.indexOf(o.id)>=0)best=Math.max(best,Se.cover(s,o,c).level)});
    out.reason=best>=1?'Not enough cover: '+s.byId[out.seenBy[0]].name+' can still see you':'Nothing to hide behind';
    return out;
  }
  /* SRD 5.2.1: Heavily Obscured, or behind Three-Quarters or Total Cover. In the open, with nothing beside you, you are only unseen in the dark. */
  if(!Se.hasShelter(s,c,foes)){out.reason='Nothing to hide behind';return out}
  out.ok=true;
  return out;
};
/* A hiding place: every enemy's view of c is dark, or a solid square (a tree, a wall, a crate) is right beside c. */
Se.hasShelter=function(s,c,foes){
  var g=s.grid;
  if(foes.length&&foes.every(function(o){return Se.effectiveLight(s,o,c.cell)>=DARK}))return true;
  for(var dr=-1;dr<=1;dr++)for(var dc=-1;dc<=1;dc++){
    if(!dr&&!dc)continue;
    if(Gr().isBlocked(g,c.cell.c+dc,c.cell.r+dr)&&Gr().inBounds(g,c.cell.c+dc,c.cell.r+dr))return true;
  }
  return false;
};
Se.hide=function(s,c){
  var chk=Se.hideCheck(s,c);
  if(!chk.ok)return {ok:false,reason:chk.reason};
  var rs=Se.stealthState(c),bonus=Se.stealthBonus(c);
  var d=Fable.dice.d20(s.rng,{mode:rs.state||'normal',bonus:bonus});
  var success=d.total>=Se.HIDE_DC;
  var res={ok:true,success:success,dc:Se.HIDE_DC,roll:{rolls:d.rolls.slice(),natural:d.natural,bonus:bonus,total:d.total,mode:d.mode,
    advantage:(rs.advantage||[]).slice(),disadvantage:(rs.disadvantage||[]).slice()},status:null};
  if(success){
    var r=St().add(s,c,{id:'hidden',source:{id:'hide',name:'Hide',creature:c.id},data:{stealth:d.total}});
    res.status={creature:c.id,id:'hidden',change:r.added?'added':'refreshed',status:r.entry};
  }else res.tacticalMind=Se.tacticalMindOffer(s,c,{kind:'hide',skill:'Stealth',total:d.total,dc:Se.HIDE_DC});
  return res;
};
/* The offer a failed ability check carries when the creature has Tactical Mind (the handler decides) and the pool it spends is not empty. */
Se.tacticalMindOffer=function(s,c,info){
  if(!Fable.handlers||!c||!c.handlers||!c.handlers.length)return null;
  var fired=Fable.handlers.fire(s,c,'onAbilityCheck',{check:info}).filter(function(f){return f.result&&f.result.dice})[0];
  if(!fired)return null;
  return Object.assign({dice:fired.result.dice,resource:fired.result.resource,done:false},info);
};
/* The chance a hide attempt succeeds, for the planner (exact: 20 sided die with Advantage or Disadvantage). */
Se.hideChance=function(c){
  var rs=Se.stealthState(c),need=Se.HIDE_DC-Se.stealthBonus(c),p=Math.max(0,Math.min(1,(21-need)/20));
  if(rs.state==='advantage')return 1-(1-p)*(1-p);
  if(rs.state==='disadvantage')return p*p;
  return p;
};

/* ---------- Search ---------- */
Se.searchTargets=function(s,c){
  if(!standing(c))return [];
  return watchers(s,c).filter(function(o){
    return Se.isHidden(o)&&Gr().distanceFt(c.cell,o.cell)<=Se.SEARCH_RANGE_FT&&Se.cover(s,c,o).level<Gr().COVER.total;
  });
};
Se.search=function(s,c){
  var targets=Se.searchTargets(s,c);
  var rs=Se.perceptionState(c),bonus=Se.perceptionBonus(c);
  var d=Fable.dice.d20(s.rng,{mode:rs.state||'normal',bonus:bonus});
  var found=[],missed=[],statuses=[];
  targets.forEach(function(t){
    var e=St().get(t,'hidden'),dc=e&&e.data&&e.data.stealth!==undefined?e.data.stealth:Se.HIDE_DC;
    if(d.total>=dc){
      St().remove(s,t,'hidden','found');
      found.push(t.id);statuses.push({creature:t.id,id:'hidden',change:'removed',status:e});
    }else missed.push(t.id);
  });
  var out={ok:true,roll:{rolls:d.rolls.slice(),natural:d.natural,bonus:bonus,total:d.total,mode:d.mode},found:found,missed:missed,statuses:statuses};
  /* a Search that finds a hidden creature has not failed; only one that left somebody hidden can be pushed with Tactical Mind */
  if(missed.length){
    var need=Math.min.apply(null,missed.map(function(id){return hiddenDc(s.byId[id])}));
    out.tacticalMind=Se.tacticalMindOffer(s,c,{kind:'search',skill:'Perception',total:d.total,dc:need});
  }
  return out;
};
function hiddenDc(t){
  var e=St().get(t,'hidden');
  return e&&e.data&&e.data.stealth!==undefined?e.data.stealth:Se.HIDE_DC;
}
/* Tactical Mind: roll the die, add it to the failed check, and spend the Second Wind use only when the check now succeeds. */
Se.useTacticalMind=function(s,c,res){
  var chk=res&&(res.hide||res.search),offer=chk&&chk.tacticalMind;
  if(!offer||offer.done)return {ok:false,reason:'There is no failed check to push'};
  var pool=c.resources&&c.resources[offer.resource];
  if(!pool||pool.current<1)return {ok:false,reason:'No uses of Second Wind left'};
  var roll=Fable.dice.roll(offer.dice,s.rng),total=offer.total+roll.total,Cb_=Cb();
  var out={ok:true,kind:offer.kind,skill:offer.skill,die:roll.total,expression:offer.dice,base:offer.total,total:total,dc:offer.dc,success:false,spent:false,statuses:[],found:[]};
  offer.done=true;
  if(offer.kind==='hide'){
    if(total>=Se.HIDE_DC){
      var r=St().add(s,c,{id:'hidden',source:{id:'hide',name:'Hide',creature:c.id},data:{stealth:total}});
      out.success=true;
      var st={creature:c.id,id:'hidden',change:r.added?'added':'refreshed',status:r.entry};
      out.statuses.push(st);
      chk.success=true;chk.status=st;
      Cb_.emit(s,{type:'status',change:st.change,id:c.id,status:st.status});
    }
  }else{
    chk.missed.slice().forEach(function(id){
      var t=s.byId[id],e=St().get(t,'hidden'),dc=hiddenDc(t);
      if(total<dc)return;
      St().remove(s,t,'hidden','found');
      chk.missed.splice(chk.missed.indexOf(id),1);chk.found.push(id);out.found.push(id);
      chk.statuses.push({creature:id,id:'hidden',change:'removed',status:e});
      out.statuses.push({creature:id,id:'hidden',change:'removed',status:e});
      Cb_.emit(s,{type:'status',change:'removed',id:id,status:e});
    });
    out.success=out.found.length>0;
  }
  if(out.success){Fable.creature.setResource(c,offer.resource,pool.current-1);out.spent=true}
  out.text=(out.success?'Tactical Mind: '+offer.skill+' '+offer.total+' + '+roll.total+' = '+total+' against DC '+offer.dc+', Second Wind spent'
    :'Tactical Mind: '+offer.skill+' '+offer.total+' + '+roll.total+' = '+total+' against DC '+offer.dc+', still a failure, Second Wind kept');
  Cb_.emit(s,{type:'tactical-mind',id:c.id,result:out});
  return out;
};

/* ---------- being seen ---------- */
Se.revalidate=function(s,opts){
  opts=opts||{};
  var out=[];
  s.creatures.forEach(function(h){
    if(!h.alive||h.id===opts.except||!Se.isHidden(h))return;
    var seen=watchers(s,h).some(function(o){return Se.seesPlain(s,o,h)});
    if(seen){St().remove(s,h,'hidden','seen');out.push(h.id)}
  });
  return out;
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
