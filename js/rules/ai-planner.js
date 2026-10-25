/* Enemy AI, part 2: the planner and the evaluator (implementation plan, sections 16.4 to 16.7; Phase 8). Pure rules code.

   A creature's turn is searched, not scripted. Starting from the real position the planner builds sequences of legal intents (move, attack,
   Dash, Disengage, Dodge, Hide, pick up a weapon, Nimble Escape), at most `depth` of them, with a beam search that keeps the best partial
   plans at every depth. Every state the search reaches is scored by the evaluator (damage dealt, kill chance, risk from the opponent's best
   reply, position, resources, team play), using exact probabilities from ai-core.js, and the best plan is returned with a trace of the
   others. The search is bounded by a count of nodes, not by time, so the same position always gives the same plan.

   Fable.aiPlanner.search(ctx)   {best, candidates, nodes}; ctx is built by Fable.ai (ai.js)

   A plan step is plain data: {t:'move', to:{c,r}}, {t:'attack', attack:id, target:id}, {t:'action', id, choice?},
   {t:'bonus', id:'nimble-escape', choice}, {t:'pickup'}. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var Pl=Fable.aiPlanner={};
var Cb=function(){return Fable.combat};
var Cr=function(){return Fable.creature};
var Gr=function(){return Fable.grid};
var St=function(){return Fable.status};
var Se=function(){return Fable.senses};
var Core=function(){return Fable.aiCore};

/* ---------- nodes: a state the search has reached ---------- */
function makeRoot(ctx){
  var a=ctx.s.byId[ctx.actorId];
  return {s:ctx.s,a:a,steps:[],dealt:{},taken:Core().dist.start(Math.max(1,Math.ceil(a.hp.current))),hideP:1,hideTried:false,moves:0,lastMove:false,attacks:0,tags:{}};
}
function child(ctx,n){
  var s=Cb().clone(n.s);
  return {s:s,a:s.byId[n.a.id],steps:n.steps.slice(),dealt:Object.assign({},n.dealt),taken:n.taken,hideP:n.hideP,hideTried:n.hideTried,
    moves:n.moves,lastMove:false,attacks:n.attacks,tags:Object.assign({},n.tags)};
}
function capOf(ctx,f){
  if(f.down&&f.death)return Math.max(1,3-(f.death.failures||0));
  return Math.max(1,Math.ceil(ctx.hpOf(f)));
}
function dealtOf(ctx,n,f){return n.dealt[f.id]||Core().dist.start(capOf(ctx,f))}

/* ---------- applying a step in expectation ---------- */
/* Each applier returns a new node or null when the step is not legal. Dice are never rolled for the plan: the effects that depend on a roll
   are carried as distributions (damage) or as a chance (Hide), and the rules code is used only for what it decides without chance. */
function applyAttack(ctx,n,step){
  var c=child(ctx,n),a=c.a,atk=Cb().findAttack(a,step.attack),t=c.s.byId[step.target];
  if(!atk||!t)return null;
  var st=Cb().attackState(c.s,a,atk,{});
  if(!st.ok)return null;
  var tc=Cb().checkTarget(c.s,a,atk,t,{});
  if(!tc.ok)return null;
  var o=Core().odds(c.s,a,atk,t,tc),dmg;
  step=Object.assign({},step,{cover:tc.cover?tc.cover.level:0,band:tc.band,from:{c:a.cell.c,r:a.cell.r},hidden:St().has(a,'hidden'),hit:o.hit,state:o.state});
  if(t.down&&t.death)dmg=[1-o.hit,o.hit-o.crit,o.crit];
  else dmg=Core().damagePmf(atk,o.hit,o.crit);
  var f=ctx.s.byId[t.id];
  c.dealt[t.id]=Core().dist.add(dealtOf(ctx,n,f),dmg);
  var b=Cb().beginAttack(c.s,a,atk.id,t,{noReroll:true,silent:true});
  if(!b.ok)return null;
  c.s.pending=null;
  if(atk.mode==='thrown'&&atk.item)Cb().dropThrown(c.s,a,atk,t.cell);
  c.attacks++;
  c.steps.push(step);
  c.lastOdds=o;
  /* attacking from hiding gives the actor away; the Advantage was in the odds above */
  return c;
}
function applyMove(ctx,n,step){
  var c=child(ctx,n),a=c.a;
  var plan=Cb().planMove(c.s,a,step.to);
  if(!plan.ok)return null;
  var taken=c.taken;
  (plan.provokes||[]).forEach(function(p){
    var foe=c.s.byId[p.id],atk=Cb().opportunityAttackFor(c.s,foe);
    if(!atk)return;
    var save=a.cell;a.cell={c:p.from.c,r:p.from.r};
    var o=Core().odds(c.s,foe,atk,a,{distanceFt:5,band:'reach',cover:{level:0,name:'none',blocked:0,bonus:0}});
    a.cell=save;
    taken=Core().dist.add(taken,Core().damagePmf(atk,o.hit,o.crit));
  });
  c.taken=taken;
  a.cell={c:step.to.c,r:step.to.r};
  a.economy.movedFt+=plan.costFt;
  c.moves=n.moves+1;c.lastMove=true;
  c.steps.push(Object.assign({},step,{ft:plan.costFt,provokes:(plan.provokes||[]).map(function(p){return p.id})}));
  return c;
}
function applyHide(ctx,n,step,cost){
  var c=child(ctx,n),a=c.a;
  var chk=Se().hideCheck(c.s,a);
  if(!chk.ok)return null;
  if(cost==='bonus'){if(a.economy.bonus)return null;a.economy.bonus=true}
  else{if(a.economy.action)return null;a.economy.action=true}
  var p=Se().hideChance(a);
  c.hideP=p;c.hideTried=true;
  if(p>=0.5)St().add(null,a,{id:'hidden',source:{id:'hide',name:'Hide',creature:a.id},data:{stealth:15}});
  c.steps.push(Object.assign({},step,{p:p}));
  return c;
}
function applyAction(ctx,n,step){
  if(step.id==='hide')return applyHide(ctx,n,step,'action');
  if(step.id==='nimble-escape'&&step.choice==='hide')return applyHide(ctx,n,step,'bonus');
  var c=child(ctx,n);
  var r=Cb().useAction(c.s,c.a,step.id,{choice:step.choice});
  if(!r.ok)return null;
  c.steps.push(step);
  return c;
}
function applyPickup(ctx,n,step){
  var c=child(ctx,n);
  var r=Cb().pickup(c.s,c.a);
  if(!r.ok)return null;
  c.steps.push(step);
  return c;
}
function apply(ctx,n,step){
  ctx.counter.n++;
  if(step.t==='attack')return applyAttack(ctx,n,step);
  if(step.t==='move')return applyMove(ctx,n,step);
  if(step.t==='pickup')return applyPickup(ctx,n,step);
  return applyAction(ctx,n,step);
}

/* ---------- candidate steps ---------- */
function allowed(ctx,trick){return ctx.flee||ctx.tricks[trick]===true}

function threatGrid(ctx){
  if(ctx.threatMap)return ctx.threatMap;
  var g=ctx.s.grid,G=Gr(),m=new Uint8Array(g.cols*g.rows);
  ctx.foes.forEach(function(f){
    if(!f.alive||f.down||!f.cell)return;
    var reachFt=0;
    (f.attacks||[]).forEach(function(a){if(a.mode==='melee'&&Core().usable(f,a))reachFt=Math.max(reachFt,a.reach||f.reachFt||5)});
    if(!reachFt)return;
    var k=Math.floor(reachFt/5),cells=Core().reach(ctx,f).slice();
    cells.push({c:f.cell.c,r:f.cell.r});
    cells.forEach(function(q){
      for(var dr=-k;dr<=k;dr++)for(var dc=-k;dc<=k;dc++){
        var c=q.c+dc,r=q.r+dr;
        if(G.inBounds(g,c,r))m[r*g.cols+c]=1;
      }
    });
  });
  ctx.threatMap=m;
  return m;
}

function nearestFoeFt(ctx,cell){
  var d=1e9;
  ctx.foes.forEach(function(f){if(f.cell)d=Math.min(d,Gr().distanceFt(cell,f.cell))});
  return d;
}

/* The squares worth walking to from this state: where something can be attacked from, where the foes cannot reach, where there is cover, where
   a retreat is open, a hiding place, and where a thrown weapon of ours lies. About tier.dests of them. */
function pickDestinations(ctx,n){
  var G=Gr(),a=n.a,K=ctx.tier.dests;
  var sqs=Cb().reachable(n.s,a);
  if(!sqs.length)return [];
  var mt=threatGrid(ctx),g=n.s.grid;
  var attacks=(a.attacks||[]).filter(function(x){return Core().usable(a,x)});
  var meleeEv=ctx.foeMeleeEv,rangedEv=ctx.foeRangedEv;
  var ideal=ctx.idealFt;
  var rows=sqs.map(function(q){
    var ev=0,i,j;
    for(i=0;i<attacks.length;i++)for(j=0;j<ctx.foes.length;j++){
      var f=n.s.byId[ctx.foes[j].id];
      if(!f.cell||Se().isHidden(f))continue;
      var o=Core().optionAt(ctx,a,attacks[i],f,q);
      if(o&&o.expected>ev)ev=o.expected;
    }
    var exposed=mt[q.r*g.cols+q.c]?meleeEv:0;
    var d=nearestFoeFt(ctx,q);
    var cover=0,total=true;
    ctx.foes.forEach(function(f){
      if(!f.cell)return;
      var cv=G.coverBetween(g,f.cell,q);
      cover=Math.max(cover,cv.level);
      if(cv.level<G.COVER.total)total=false;
    });
    var h=ev-ctx.profile.riskAversion*ctx.profile.weights.risk*exposed+(ctx.tricks['throw-from-cover']?0.4*Math.min(2,cover):0)-0.02*Math.abs(d-ideal)/5;
    return {q:q,ev:ev,h:h,exposed:exposed,d:d,cover:cover,total:total};
  });
  var chosen={},out=[];
  function take(list,count){
    var k=0;
    for(var i=0;i<list.length&&k<count;i++){
      var key=list[i].q.c+','+list[i].q.r;
      if(chosen[key])continue;
      chosen[key]=1;out.push({c:list[i].q.c,r:list[i].q.r,ft:list[i].q.ft});k++;
    }
  }
  function by(f){return function(x,y){return f(y)-f(x)||x.q.r-y.q.r||x.q.c-y.q.c}}
  var share=function(x){return Math.max(1,Math.round(K*x))};
  take(rows.filter(function(r){return r.ev>0}).sort(by(function(r){return r.h})),share(0.4));
  take(rows.filter(function(r){return !r.exposed}).sort(function(x,y){return Math.abs(x.d-ideal)-Math.abs(y.d-ideal)||x.q.r-y.q.r||x.q.c-y.q.c}),share(0.25));
  if(ctx.tricks['throw-from-cover']||ctx.flee)take(rows.filter(function(r){return r.cover>=1&&r.cover<G.COVER.total}).sort(by(function(r){return r.h})),share(0.15));
  take(rows.slice().sort(by(function(r){return r.d-r.exposed*10})),2);
  if(allowed(ctx,'hide-then-ambush')||ctx.flee)take(rows.filter(function(r){return r.total}).sort(by(function(r){return r.h})),2);
  if(allowed(ctx,'recover-daggers')){
    var own=n.s.ground.filter(function(x){return x.owner===a.id}).map(function(x){return x.cell.c+','+x.cell.r});
    if(own.length)take(rows.filter(function(r){return own.indexOf(r.q.c+','+r.q.r)>=0}),2);
  }
  return out.slice(0,K+4);
}

function expand(ctx,n){
  var a=n.a,s=n.s,out=[],e=a.economy,i,j;
  var targets=ctx.foes.filter(function(f){var t=s.byId[f.id];return t&&t.alive&&t.cell});
  /* attacks */
  (a.attacks||[]).forEach(function(atk){
    if(!Core().usable(a,atk))return;
    targets.forEach(function(f){
      var t=s.byId[f.id];
      if(!Cb().attackState(s,a,atk,{}).ok)return;
      if(!Cb().checkTarget(s,a,atk,t,{}).ok)return;
      out.push({t:'attack',attack:atk.id,target:t.id});
    });
  });
  /* standard actions that do not need a target */
  function act(id,choice,when){
    if(when===false)return;
    if(Cb().actionState(s,a,id,{choice:choice}).ok)out.push(choice?{t:id==='nimble-escape'?'bonus':'action',id:id,choice:choice}:{t:'action',id:id});
  }
  if(!e.action){
    act('dodge');
    if(ctx.dashUseful)act('dash');
    if(allowed(ctx,'hit-and-run'))act('disengage');
    if(allowed(ctx,'hide-then-ambush'))act('hide');
  }
  if(!e.bonus&&Cb().findAction(a,'nimble-escape')){
    if(allowed(ctx,'hit-and-run'))act('nimble-escape','disengage');
    if(allowed(ctx,'hide-then-ambush')||ctx.flee)act('nimble-escape','hide');
  }
  if(allowed(ctx,'recover-daggers')&&Cb().pickupState(s,a).ok)out.push({t:'pickup'});
  /* moves, at most two per turn and never two in a row (the second would be one longer move) */
  if(n.moves<2&&!n.lastMove&&Cr().movementLeftFt(a)>0){
    pickDestinations(ctx,n).forEach(function(q){out.push({t:'move',to:{c:q.c,r:q.r}})});
  }
  return out;
}

/* ---------- the evaluator ---------- */
var FLEE={damage:0.3,kill:0.3,risk:2.2};

function killValue(ctx,f){
  var last=ctx.foes.filter(function(o){return o.alive&&!o.down}).length<=1;
  return (3+0.5*f.hp.max)*(last?1.5:1);
}

/* Free squares around c that are not closer to the nearest foe than c is now: the ways out. */
function retreatFraction(ctx,n){
  var G=Gr(),a=n.a,g=n.s.grid,here=nearestFoeFt(ctx,a.cell),open=0,total=0;
  for(var dr=-1;dr<=1;dr++)for(var dc=-1;dc<=1;dc++){
    if(!dr&&!dc)continue;
    total++;
    var q={c:a.cell.c+dc,r:a.cell.r+dr};
    if(G.isBlocked(g,q.c,q.r)||Cb().occupant(n.s,q,a))continue;
    if(nearestFoeFt(ctx,q)>=here)open++;
  }
  return open/total;
}

function replyFor(ctx,n,hidden){
  n.hiddenEnd=hidden;
  return Core().reply(ctx,n);
}

function evaluate(ctx,n){
  ctx.counter.evals++;
  var P=ctx.profile,w=P.weights,a=n.a,s=n.s,D=Core().dist;
  var flee=ctx.flee,mult=function(k){return flee&&FLEE[k]?FLEE[k]:1};
  /* a stalemate wears the creature down: every idle round after the second makes staying in the fight worth more */
  var eng=P.engagement*(1+0.25*Math.max(0,(ctx.memo.idle||0)-2));
  var t={damage:0,kill:0,risk:0,cover:0,retreatRoutes:0,resources:0,position:0,team:0,focus:0,survival:0,steps:0};
  var dealtSum=0,killSum=0;
  ctx.foes.forEach(function(f){
    var d=n.dealt[f.id];
    if(!d)return;
    dealtSum+=D.mean(d);
    killSum+=D.dropped(d)*killValue(ctx,f);
  });
  t.damage=w.damage*eng*mult('damage')*dealtSum;
  t.kill=w.kill*eng*mult('kill')*killSum;
  /* focus fire: the team prefers the same target (basic: the target the last ally hit; tactician and above add the combined kill chance) */
  if(ctx.tricks['focus-fire']&&ctx.memo.focus&&n.dealt[ctx.memo.focus]){
    t.focus=0.35*w.kill*D.mean(n.dealt[ctx.memo.focus]);
  }
  if(ctx.tier.team&&ctx.laterMates.length){
    ctx.foes.forEach(function(f){
      var d=n.dealt[f.id];
      if(!d)return;
      var best=ctx.mateDamage[f.id];
      if(!best)return;
      var combined=D.add(d,best);
      t.team+=0.5*w.kill*(D.dropped(combined)-D.dropped(d))*killValue(ctx,f);
    });
  }
  /* what the opposing side can do to us next (section 16.6): a visible actor takes the full reply, a hidden one none */
  var seen=true;
  var isHid=Se().isHidden(a);
  if(isHid)seen=ctx.foes.some(function(f){return f.cell&&Se().seesPlain(s,s.byId[f.id]||f,a)});
  var rep;
  if(!ctx.tier.reply)rep={expected:0,pDown:0,allies:0,picks:[]};
  else if(isHid&&!seen){
    rep=replyFor(ctx,n,true);
    if(n.hideP<1){
      var vis=replyFor(ctx,n,false);
      rep={expected:n.hideP*rep.expected+(1-n.hideP)*vis.expected,pDown:n.hideP*rep.pDown+(1-n.hideP)*vis.pDown,allies:n.hideP*rep.allies+(1-n.hideP)*vis.allies,picks:vis.picks};
    }
  }else rep=replyFor(ctx,n,false);
  var deathCost=1.5+0.6*a.hp.max;
  var raw=rep.expected+0.5*rep.allies+rep.pDown*deathCost;
  /* a creature that is pressing the fight (engagement above 1) weighs its own safety less */
  t.risk=-w.risk*P.riskAversion*mult('risk')*raw/Math.max(0.5,eng);
  if(n.hideTried&&n.hideP<1)t.steps-=(1-n.hideP)*0.8;
  /* position */
  if(ctx.tricks['throw-from-cover']||flee){
    var lvl=0,cnt=0;
    ctx.foes.forEach(function(f){if(f.cell){lvl+=Math.min(2,Gr().coverBetween(s.grid,f.cell,a.cell).level);cnt++}});
    t.cover=w.cover*(cnt?lvl/cnt/2:0);
  }
  t.retreatRoutes=w.retreatRoutes*0.6*retreatFraction(ctx,n);
  /* resources: daggers in hand, weapons that can be picked up again, being unarmed */
  var res=0;
  (Object.keys(a.stock||{})).forEach(function(item){
    var isWeapon=(a.attacks||[]).some(function(x){return x.item===item&&x.damage&&x.damage.stats.average>0});
    if(!isWeapon)return;
    var left=Core().remaining(a,item);
    var ground=s.ground.filter(function(g){return g.owner===a.id&&g.item===item});
    res+=0.4*left+0.12*ground.length;
    if(left<=0)res-=ground.length?0.6:1.4;
  });
  t.resources=w.resources*res;
  /* tempo: a creature that is out of reach of everything wastes the fight; pull toward its attack distance grows with every idle round */
  var d=nearestFoeFt(ctx,a.cell);
  if(!flee&&d<1e8){
    var pull=eng*(0.16+0.07*(ctx.memo.idle||0));
    t.position-=pull*Math.max(0,d-ctx.idealFt)/5;
  }
  if(flee){
    var away=Math.min(8,d/5);
    t.survival=0.35*away+(isHid&&!seen?2:0)+(rep.expected<=0.01?1.5:0);
  }
  t.steps-=0.02*n.steps.length;
  var score=0;
  Object.keys(t).forEach(function(k){score+=t[k]});
  n.terms=t;n.score=score;n.reply=rep;n.raw={dealt:dealtSum,kill:killSum,riskRaw:raw};
  return score;
}

/* ---------- search ---------- */
function setupKind(n){
  var st=n.steps[n.steps.length-1];
  if(!st||st.t==='attack'||st.t==='move')return 'other';
  return st.t==='pickup'?'pickup':(st.id+(st.choice?':'+st.choice:''));
}
function sigOf(n){
  var a=n.a,e=a.economy;
  var dealt=Object.keys(n.dealt).sort().map(function(k){return k+Math.round(Core().dist.mean(n.dealt[k])*100)}).join(',');
  return a.cell.c+','+a.cell.r+'|'+(e.action?1:0)+(e.bonus?1:0)+(e.object?1:0)+'|'+Math.round(e.movedFt)+'|'+dealt+'|'+n.hideP+'|'+n.s.ground.length+'|'+n.attacks+'|'+Object.keys(a.thrown).map(function(k){return a.thrown[k]}).join('');
}

Pl._expand=function(){return expand.apply(null,arguments)};Pl._apply=function(){return apply.apply(null,arguments)};Pl._root=function(){return makeRoot.apply(null,arguments)};
Pl.search=function(ctx){
  var root=makeRoot(ctx),cands=[],tier=ctx.tier;
  ctx.counter={n:0,evals:0};
  evaluate(ctx,root);
  cands.push(root);
  var beam=[root];
  for(var depth=1;depth<=tier.depth&&beam.length;depth++){
    var next=[],seen={};
    for(var bi=0;bi<beam.length;bi++){
      var steps=expand(ctx,beam[bi]);
      for(var si=0;si<steps.length;si++){
        if(ctx.counter.n>=tier.nodes)break;
        var c=apply(ctx,beam[bi],steps[si]);
        if(!c)continue;
        evaluate(ctx,c);
        var sg=sigOf(c);
        if(seen[sg]){
          if(seen[sg].score>=c.score)continue;
          cands.splice(cands.indexOf(seen[sg]),1);
          next.splice(next.indexOf(seen[sg]),1);
        }
        seen[sg]=c;
        cands.push(c);next.push(c);
      }
    }
    next.sort(function(x,y){return y.score-x.score});
    beam=next.slice(0,tier.beam);
    /* a setup step (Disengage, Hide, Dodge, a pick up) earns nothing by itself and would be cut, though it is what makes the next move good: the
       best node ending in each kind of setup step always stays in the beam */
    var kept={};
    beam.forEach(function(x){kept[setupKind(x)]=1});
    for(var ni=0;ni<next.length;ni++){
      var k=setupKind(next[ni]);
      if(k!=='other'&&!kept[k]){kept[k]=1;beam.push(next[ni])}
    }
  }
  /* a repeatable tie-break: a tiny seeded jitter, so two equal plans are always ordered the same way */
  cands.forEach(function(n){
    n.jitter=Core().unit(ctx.seed,ctx.actorId+'|'+ctx.s.round+'|'+describePlan(ctx,n))*1e-4;
  });
  cands.sort(function(x,y){return (y.score+y.jitter)-(x.score+x.jitter)});
  return {best:cands[0],candidates:cands,nodes:ctx.counter.n,evals:ctx.counter.evals};
};

/* ---------- text ---------- */
function nameOf(ctx,id){var c=ctx.s.byId[id];return c?c.name:id}
Pl.describeStep=function(ctx,st){
  if(st.t==='move')return 'Move to ('+st.to.c+', '+st.to.r+')'+(st.ft?' ['+st.ft+' ft]':'');
  if(st.t==='attack'){
    var a=ctx.s.byId[ctx.actorId],atk=Cb().findAttack(a,st.attack);
    return (atk&&atk.mode==='melee'?'Stab ':atk&&atk.mode==='thrown'?'Throw at ':'Attack ')+nameOf(ctx,st.target)+(atk?' with '+atk.name:'');
  }
  if(st.t==='pickup')return 'Pick up weapon';
  if(st.id==='nimble-escape')return 'Nimble Escape ('+(st.choice==='hide'?'Hide':'Disengage')+')';
  return st.id.charAt(0).toUpperCase()+st.id.slice(1);
};
function describePlan(ctx,n){
  return n.steps.map(function(st){return Pl.describeStep(ctx,st)}).join(' > ')||'Stay put';
}
Pl.describePlan=describePlan;
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
