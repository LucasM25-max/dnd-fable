/* Enemy AI, part 3: perception, goals, morale, tiers, and the entry points (implementation plan, section 16; Phase 8). Pure rules code.

   Fable.ai.resolveProfile(aiDef, monsterDef, override)  the profile a creature plays with: the named content profile, then the monster's own
                                                         fields, then the encounter's override (weights merge per term, tricks replace)
   Fable.ai.TIERS                                        instinct, cunning, tactician, mastermind: search size and how much they know
   Fable.ai.plan(s, c, opts)                             the best plan for creature c's turn, from the position in s; changes nothing.
                                                         opts.tier overrides the tier (the difficulty setting). Returns
                                                         {intents, tier, flee, morale:[events], mind, team, trace}
   Fable.ai.planFromData(data, actorId, opts)            the same from Fable.combat.serialize data (what the Web Worker runs)
   Fable.ai.commit(s, c, plan)                           stores what the plan decided to remember (morale, memory) and emits 'morale' events
   Fable.ai.finishTurn(s, c, summary)                    ends the creature's bookkeeping for the turn (idle rounds, the team's focus target)
   Fable.ai.legal(s, c, intent) / perform(s, c, intent)  checks and carries out one plan step through the normal rules
   Fable.ai.takeTurn(s, c, opts)                         plans and performs a whole turn (re-planning when a roll changes things); does not end the turn
   Fable.ai.explain(trace)                               the trace as text: the chosen plan, its score by term, and the runners up

   A plan step is plain data (see ai-planner.js), so a plan crosses a Worker boundary as JSON.

   Information (16.3). Fair tiers know what any observer would: positions they can see, last seen positions of what they cannot, a health bar
   (a quarter of the hit points at a time) and the visible Armor Class; Mastermind knows exact hit points. Nothing here reads the hero's hit
   points, resources or rolls except through those fair estimates. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var Ai=Fable.ai={};
var Cb=function(){return Fable.combat};
var Gr=function(){return Fable.grid};
var St=function(){return Fable.status};
var Se=function(){return Fable.senses};
var Cr=function(){return Fable.creature};

/* depth: steps per plan; beam: partial plans kept per depth; dests: candidate squares per move; nodes: search budget (a count, so a position
   always gives the same plan); reply: looks at the opponent's best answer; team: plans around what allies can still do; fair: limited information */
Ai.TIERS={
  instinct:{name:'Instinct',depth:2,beam:4,dests:4,nodes:90,reply:false,team:false,fair:true,nearestOnly:true,tricks:false},
  cunning:{name:'Cunning',depth:4,beam:6,dests:12,nodes:650,reply:true,team:false,fair:true,nearestOnly:false,tricks:true},
  tactician:{name:'Tactician',depth:4,beam:9,dests:16,nodes:1500,reply:true,team:true,fair:true,nearestOnly:false,tricks:true},
  mastermind:{name:'Mastermind',depth:4,beam:12,dests:22,nodes:3000,reply:true,team:true,fair:false,nearestOnly:false,tricks:true}
};
Ai.TIER_IDS=['instinct','cunning','tactician','mastermind'];
Ai.DEFAULT_TIER='cunning';

Ai.HEARING_FT=30;
var WEIGHT_KEYS=['damage','kill','risk','cover','retreatRoutes','resources'];
var FALLBACK={tier:'instinct',weights:{damage:1,kill:1.2,risk:0.5,cover:0,retreatRoutes:0,resources:0},riskAversion:0.2,
  morale:{fleeBelowHp:0,fleeIfAlone:false,fleeIfAllyDefeated:false},tricks:[],engagement:1};

function copy(o){return JSON.parse(JSON.stringify(o))}
function merge(base,over){
  var out=copy(base);
  if(!over)return out;
  if(over.tier!==undefined)out.tier=over.tier;
  if(over.weights)Object.keys(over.weights).forEach(function(k){out.weights[k]=over.weights[k]});
  if(over.riskAversion!==undefined)out.riskAversion=over.riskAversion;
  if(over.engagement!==undefined)out.engagement=over.engagement;
  if(over.morale)Object.keys(over.morale).forEach(function(k){out.morale[k]=over.morale[k]});
  if(over.tricks)out.tricks=over.tricks.slice();
  return out;
}
Ai.resolveProfile=function(aiDef,monsterDef,override){
  var C=Fable.content,base=FALLBACK;
  if(aiDef&&aiDef.profile){
    var p=C&&C.aiProfiles&&C.aiProfiles.get(aiDef.profile);
    if(!p)throw new Error('Monster "'+(monsterDef&&monsterDef.id)+'": AI profile "'+aiDef.profile+'" does not exist');
    base=copy(p);base.engagement=base.engagement===undefined?1:base.engagement;
  }
  var out=merge(base,aiDef);
  out.profile=aiDef&&aiDef.profile||'none';
  if(override)out=merge(out,override);
  if(Ai.TIER_IDS.indexOf(out.tier)<0)throw new Error('AI tier "'+out.tier+'" is not one of '+Ai.TIER_IDS.join(', '));
  return out;
};

/* ---------- information ---------- */
function barHp(f){
  var q=Math.ceil(f.hp.current/f.hp.max*4)/4;
  return Math.max(1,Math.ceil(q*f.hp.max));
}

/* ---------- morale (16.8) ---------- */
function mateCount(s,c){
  return s.creatures.filter(function(o){return o!==c&&o.team===c.team&&o.alive}).length;
}
/* A creature checks morale when something shakes it: it is Bloodied, an ally falls, or it is left alone. A check is a seeded Wisdom check
   against DC 10 (Disadvantage when alone), so a replay makes the same choice; failing it means it flees. fleeIfAllyDefeated true always
   flees. A creature that flees checks again every three rounds, and after round 10 nobody runs any more. */
function wisMod(c){var w=c.abilities&&c.abilities.wis;return w?(w.mod!==undefined?w.mod:w.modifier||0):0}
function moraleStep(s,c,P,mind){
  var events=[],M=P.morale||{},round=s.round||1,seed=s.seed||0;
  var hpFrac=c.hp.current/c.hp.max,mates=mateCount(s,c);
  if(mind.matesAlive===undefined)mind.matesAlive=mates;
  var triggers=[];
  if(M.fleeBelowHp>0&&hpFrac<=M.fleeBelowHp)triggers.push('bloodied');
  if(mates<mind.matesAlive&&M.fleeIfAllyDefeated)triggers.push('ally');
  if(M.fleeIfAlone&&mates===0&&mind.hadMates)triggers.push('alone');
  if(mates>0)mind.hadMates=true;
  mind.matesAlive=mates;
  mind.checked=mind.checked||{};
  function roll(tag,dis){
    var a=Fable.aiCore.unit(seed,'morale|'+c.id+'|'+tag+'|'+round+'|a'),b=Fable.aiCore.unit(seed,'morale|'+c.id+'|'+tag+'|'+round+'|b');
    var x=1+Math.floor(a*20),y=1+Math.floor(b*20);
    return {natural:dis?Math.min(x,y):x,rolls:dis?[x,y]:[x]};
  }
  if(round>=10){
    if(mind.fleeing){mind.fleeing=false;events.push({type:'morale',id:c.id,trigger:'desperate',result:'hold',round:round})}
    return events;
  }
  if(mind.fleeing){
    if(round-mind.fleeSince>=3){
      if(!triggers.length){mind.fleeing=false;events.push({type:'morale',id:c.id,trigger:'recovered',result:'hold',round:round})}
      else{
        var r=roll('again',triggers.indexOf('alone')>=0),total=r.natural+wisMod(c);
        mind.fleeSince=round;
        if(total>=10){mind.fleeing=false;events.push({type:'morale',id:c.id,trigger:triggers[0],result:'hold',roll:r.natural,total:total,dc:10,round:round})}
      }
    }
    return events;
  }
  for(var i=0;i<triggers.length;i++){
    var t=triggers[i],key=t==='ally'?'ally'+mind.matesAlive+'|'+round:t;
    if(mind.checked[key])continue;
    mind.checked[key]=true;
    if(t==='ally'&&M.fleeIfAllyDefeated===true){
      mind.fleeing=true;mind.fleeSince=round;
      events.push({type:'morale',id:c.id,trigger:t,result:'flee',auto:true,round:round});
      break;
    }
    var r2=roll(t,t==='alone'),tot=r2.natural+wisMod(c);
    var flee=tot<10;
    events.push({type:'morale',id:c.id,trigger:t,result:flee?'flee':'hold',roll:r2.natural,rolls:r2.rolls,mod:wisMod(c),total:tot,dc:10,round:round});
    if(flee){mind.fleeing=true;mind.fleeSince=round;break}
  }
  return events;
}

/* ---------- the planning context ---------- */
function prepare(s,c,opts){
  var n=Cb().clone(s);
  var actor=n.byId[c.id];
  if(!actor.economy)actor.economy=Cr().newEconomy(actor);
  if(n.phase!=='running'||Cb().active(n)!==actor){
    n.phase='running';
    if(n.order.indexOf(actor.id)<0)n.order.push(actor.id);
    n.turn=n.order.indexOf(actor.id);
    n.round=n.round||1;
  }
  return n;
}
function opponentsOf(ctx,who){
  return ctx.s.creatures.filter(function(o){return o.team!==who.team&&o.alive&&o.cell});
}
function sigOf(c){
  return (c.conditions||[]).map(function(e){return e.id}).sort().join('.')+'|'+c.ac.value+'|'+(c.economy&&c.economy.reaction?1:0);
}

Ai.plan=function(s,c,opts){
  opts=opts||{};
  var P=c.ai||FALLBACK;
  var tierName=opts.tier&&Ai.TIERS[opts.tier]?opts.tier:P.tier;
  var tier=Ai.TIERS[tierName];
  var n=prepare(s,c,opts),actor=n.byId[c.id];
  var mind=copy(c.mind||{});
  var Q=tier.tricks?P.tricks:[];
  var tricks={};Q.forEach(function(t){tricks[t]=true});
  var memo={focus:null,idle:mind.idle||0};
  var team=s.aiTeam&&s.aiTeam[c.team];
  if(team&&team.focus&&team.round===s.round&&n.byId[team.focus]&&n.byId[team.focus].alive&&!n.byId[team.focus].down)memo.focus=team.focus;

  /* morale first: it changes what this creature wants */
  var events=[];
  if(mind.moraleRound!==n.round){
    events=moraleStep(n,actor,P,mind);
    mind.moraleRound=n.round;
  }
  var flee=!!mind.fleeing;

  /* perception: who this creature knows about and where */
  mind.lastSeen=mind.lastSeen||{};
  var foesAll=n.creatures.filter(function(o){return o.team!==actor.team&&o.alive&&o.cell});
  var team1=n.creatures.filter(function(o){return o.team===actor.team&&o.alive&&o.cell});
  var foes=[];
  foesAll.forEach(function(f){
    /* a creature that moves within 30 feet is heard even when it cannot be seen (a Hidden one stays quiet, see senses.js) */
    var seen=!tier.fair||team1.some(function(m){return Se().sees(n,m,f)||(!Se().isHidden(f)&&Gr().distanceFt(m.cell,f.cell)<=Ai.HEARING_FT)});
    if(seen){mind.lastSeen[f.id]={c:f.cell.c,r:f.cell.r,round:n.round};foes.push(f)}
    else if(mind.lastSeen[f.id]){
      f.cell={c:mind.lastSeen[f.id].c,r:mind.lastSeen[f.id].r};
      foes.push(f);
    }else foes.push(f);
  });
  if(tier.nearestOnly&&foes.length>1){
    var best=null;
    foes.forEach(function(f){
      var d=Gr().distanceFt(actor.cell,f.cell);
      if(!best||d<best.d||(d===best.d&&f.hp.current<best.f.hp.current))best={f:f,d:d};
    });
    foes=[best.f];
  }

  var ctx={s:n,actorId:actor.id,profile:P,tier:tier,tierName:tierName,flee:flee,tricks:tricks,memo:memo,foes:foes,cache:{},
    seed:s.seed||0,counter:{n:0,evals:0},dashUseful:true,alternatives:opts.alternatives};
  ctx.mates=n.creatures.filter(function(o){return o.team===actor.team&&o!==actor&&o.alive&&o.cell});
  var idx=n.turn;
  ctx.laterMates=ctx.mates.filter(function(m){
    var i=n.order.indexOf(m.id);
    return i>idx&&!m.down;
  });
  ctx.sig=sigOf;
  ctx.opponentsOf=function(who){return opponentsOf(ctx,who)};
  ctx.hpOf=function(f){
    if(!tier.fair||f.team===actor.team||f.id===actor.id)return f.hp.current;
    return barHp(f);
  };
  /* what the foes could do to us from where we stand, and the distance we like to fight from */
  var meleeEv=0;
  foes.forEach(function(f){
    var o=Fable.aiCore.bestOption(ctx,f,actor);
    if(o)meleeEv=Math.max(meleeEv,o.expected);
  });
  ctx.foeMeleeEv=meleeEv;ctx.foeRangedEv=meleeEv;
  var ranged=(actor.attacks||[]).filter(function(a){return Fable.aiCore.usable(actor,a)&&a.mode!=='melee'});
  ctx.idealFt=ranged.length&&tricks['throw-from-cover']?Math.min.apply(null,ranged.map(function(a){return a.range.normal})):5;
  if(flee)ctx.idealFt=60;
  /* what allies that have not yet acted could still add against each foe (tactician and above) */
  ctx.mateDamage={};
  if(tier.team&&ctx.laterMates.length){
    foes.forEach(function(f){
      var bestPmf=null,bestE=0;
      ctx.laterMates.forEach(function(m){
        var cells=Fable.aiCore.reach(ctx,m).slice();cells.push({c:m.cell.c,r:m.cell.r,ft:0});
        (m.attacks||[]).forEach(function(a){
          if(!Fable.aiCore.usable(m,a))return;
          cells.forEach(function(q){
            var o=Fable.aiCore.optionAt(ctx,m,a,f,q);
            if(o&&o.expected>bestE){bestE=o.expected;bestPmf=Fable.aiCore.damagePmf(a,o.hit,o.crit)}
          });
        });
      });
      if(bestPmf)ctx.mateDamage[f.id]=bestPmf;
    });
  }

  var found=Fable.aiPlanner.search(ctx);
  var best=found.best;
  var result={
    actor:actor.id,tier:tierName,flee:flee,intents:best.steps.map(function(x){return copy(x)}),morale:events,
    mind:mind,team:null,
    trace:buildTrace(ctx,found)
  };
  /* the team's shared focus: the first thing the plan attacks */
  var first=best.steps.filter(function(x){return x.t==='attack'})[0];
  if(first)result.team={focus:first.target,round:n.round};
  result.mind.lastPlanRound=n.round;
  return result;
};

Ai.planFromData=function(data,actorId,opts){
  var s=Cb().deserialize(data);
  var c=s.byId[actorId];
  if(!c)throw new Error('AI: no creature "'+actorId+'" in the saved fight');
  /* a Worker has no content registry: the profile travels with the creature (see Fable.combat.serialize) */
  return Ai.plan(s,c,opts);
};

Ai.commit=function(s,c,plan){
  if(!plan)return;
  c.mind=plan.mind;
  if(plan.team){s.aiTeam=s.aiTeam||{};s.aiTeam[c.team]=plan.team}
  (plan.morale||[]).forEach(function(ev){Cb().emit(s,ev)});
};
Ai.finishTurn=function(s,c,summary){
  summary=summary||{};
  var m=c.mind=c.mind||{};
  m.idle=summary.attacked?0:(m.idle||0)+1;
};

/* ---------- carrying a plan out ---------- */
Ai.legal=function(s,c,it){
  if(it.t==='attack'){
    var a=Cb().findAttack(c,it.attack),t=s.byId[it.target];
    if(!a||!t)return {ok:false,reason:'Unknown attack or target'};
    var st=Cb().attackState(s,c,a,{});
    if(!st.ok)return st;
    return Cb().checkTarget(s,c,a,t,{});
  }
  if(it.t==='move')return Cb().planMove(s,c,it.to);
  if(it.t==='pickup')return Cb().pickupState(s,c);
  return Cb().actionState(s,c,it.id,{choice:it.choice});
};
Ai.perform=function(s,c,it,opts){
  opts=opts||{};
  if(it.t==='attack')return Cb().attack(s,c,it.attack,s.byId[it.target],{noReroll:true});
  if(it.t==='move')return Cb().move(s,c,it.to,{reactions:opts.reactions});
  if(it.t==='pickup')return Cb().pickup(s,c);
  return Cb().useAction(s,c,it.id,{choice:it.choice});
};
function diverged(it,res,c){
  if(!res||res.ok===false)return true;
  if(it.t==='move')return !!res.interrupted||(res.reactions&&res.reactions.length>0);
  if(it.t==='attack'){
    var d=res.damage&&res.damage.applied;
    return !!(d&&d.downed)||(res.statuses&&res.statuses.length>0)||false;
  }
  if(it.id==='hide'||(it.id==='nimble-escape'&&it.choice==='hide'))return !(res.hide&&res.hide.success);
  return false;
}
Ai.diverged=diverged;
Ai.takeTurn=function(s,c,opts){
  opts=opts||{};
  var out={plans:[],steps:[],attacked:false};
  var plan=Ai.plan(s,c,opts);Ai.commit(s,c,plan);out.plans.push(plan);
  var queue=plan.intents.slice(),guard=0,replans=0;
  function replan(){
    if(replans>=3){queue=[];return}
    replans++;
    plan=Ai.plan(s,c,opts);Ai.commit(s,c,plan);out.plans.push(plan);queue=plan.intents.slice();
  }
  while(queue.length&&guard++<16&&s.phase==='running'){
    var it=queue.shift();
    if(!Ai.legal(s,c,it).ok){replan();continue}
    var hpBefore=c.hp.current;
    var res=Ai.perform(s,c,it,opts);
    out.steps.push({intent:it,result:res});
    if(it.t==='attack')out.attacked=true;
    if(!c.alive||c.down)break;
    if(diverged(it,res,c)||c.hp.current<hpBefore)replan();
  }
  if(plan.team===null&&!out.attacked&&c.mind)c.mind.idle=(c.mind.idle||0);
  Ai.finishTurn(s,c,{attacked:out.attacked});
  return out;
};

/* ---------- the explain trace (16.10) ---------- */
function round2(x){return Math.round(x*100)/100}
function termsOf(n){var o={};Object.keys(n.terms).forEach(function(k){if(Math.abs(n.terms[k])>1e-9)o[k]=round2(n.terms[k])});return o}
function tricksIn(ctx,n){
  var out=[],st=n.steps;
  var melee=st.filter(function(x){return x.t==='attack'&&ctx.s.byId[ctx.actorId]&&((Fable.combat.findAttack(ctx.s.byId[ctx.actorId],x.attack)||{}).mode==='melee')});
  var hasEscape=st.some(function(x){return (x.id==='nimble-escape'&&x.choice==='disengage')||x.id==='disengage'});
  var lastMove=-1,firstAtk=-1;
  st.forEach(function(x,i){if(x.t==='move')lastMove=i;if(x.t==='attack'&&firstAtk<0)firstAtk=i});
  if(melee.length&&hasEscape&&lastMove>firstAtk)out.push('hit-and-run');
  if(st.some(function(x){return x.t==='attack'&&x.band&&x.cover>=1&&((Fable.combat.findAttack(ctx.s.byId[ctx.actorId],x.attack)||{}).mode!=='melee')}))out.push('throw-from-cover');
  if(st.some(function(x){return x.t==='attack'&&x.hidden}))out.push('hide-then-ambush');
  if(st.some(function(x){return x.t==='pickup'}))out.push('recover-daggers');
  if(ctx.memo.focus&&st.some(function(x){return x.t==='attack'&&x.target===ctx.memo.focus}))out.push('focus-fire');
  return out;
}
function row(ctx,n,rank){
  return {rank:rank,score:round2(n.score),steps:n.steps.map(function(x){return Fable.aiPlanner.describeStep(ctx,x)}),
    terms:termsOf(n),tricks:tricksIn(ctx,n),
    reply:{expected:round2(n.reply.expected),pDown:round2(n.reply.pDown),picks:(n.reply.picks||[]).map(function(p){return {foe:p.foe,target:p.target,attack:p.attack,p:round2(p.p),expected:round2(p.expected)}})},
    dealt:round2(n.raw.dealt),kill:round2(n.raw.kill)};
}
function buildTrace(ctx,found){
  var actor=ctx.s.byId[ctx.actorId];
  var list=found.candidates;
  var tr={actor:{id:actor.id,name:actor.name},tier:ctx.tierName,flee:ctx.flee,profile:ctx.profile.profile,nodes:found.nodes,evals:found.evals,
    tricks:Object.keys(ctx.tricks),focus:ctx.memo.focus,idle:ctx.memo.idle,
    chosen:row(ctx,list[0],1),alternatives:list.slice(1,6).map(function(n,i){return row(ctx,n,i+2)})};
  return tr;
}
Ai.explain=function(tr){
  var lines=[];
  lines.push(tr.actor.name+' ('+tr.tier+(tr.flee?', fleeing':'')+'): '+tr.nodes+' plans searched');
  function fmt(r){
    var t=Object.keys(r.terms).map(function(k){return k+' '+(r.terms[k]>=0?'+':'')+r.terms[k]}).join(', ');
    return '  #'+r.rank+' '+r.score+'  '+(r.steps.join(' > ')||'Stay put')+'\n       '+t+(r.tricks.length?'  ['+r.tricks.join(', ')+']':'');
  }
  lines.push(fmt(tr.chosen));
  tr.alternatives.forEach(function(r){lines.push(fmt(r))});
  return lines.join('\n');
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
