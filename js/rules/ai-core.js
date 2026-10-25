/* Enemy AI, part 1: the numbers (implementation plan, sections 16.1, 16.5 and 16.6; Phase 8). Pure rules code: no DOM, no Three.js, so the
   planner can run in a Web Worker and in the Node tests unchanged.

   Everything here uses the same legality, attack probability and cover code as the player's hover previews (Fable.combat), so the AI
   can never cheat on the rules, and every probability is exact (convolved dice distributions), never sampled.

   Fable.aiCore.odds(s, c, a, t, tc)             {hit, crit, state, ac, need, advantage, disadvantage} for an attack roll
   Fable.aiCore.damagePmf(a, hit, crit)          chances of 0, 1, 2 ... points of damage from one attack (misses count as 0)
   Fable.aiCore.usable(c, a)                     whether a creature could make that attack at all (has a weapon, ammunition, deals damage)
   Fable.aiCore.dist.*                           damage distributions capped at a creature's hit points (the last entry is "dropped")
   Fable.aiCore.reach(ctx, c)                    the squares a creature could stand on after moving a full turn (cached per planning run)
   Fable.aiCore.reply(ctx, n)                    what the opposing side's best answer costs the actor in state n (section 16.6 expectimax) */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var Core=Fable.aiCore={};
var Cb=function(){return Fable.combat};
var Gr=function(){return Fable.grid};
var St=function(){return Fable.status};
var Se=function(){return Fable.senses};

/* ---------- damage distributions ---------- */
var pmfCache=Object.create(null);
function pmf(expr,crit){
  var key=expr+'|'+(crit?1:0);
  if(pmfCache[key])return pmfCache[key];
  var d=Fable.dice.pmf(expr,{crit:!!crit}),out=[],i;
  for(i=0;i<d.p.length;i++){var v=d.min+i;if(v<0)v=0;out[v]=(out[v]||0)+d.p[i]}
  for(i=0;i<out.length;i++)if(out[i]===undefined)out[i]=0;
  pmfCache[key]=out;
  return out;
}
Core.pmf=pmf;

/* The damage one attack does as a distribution: a miss does 0, a hit rolls the damage, a Critical Hit rolls the doubled dice. */
Core.damagePmf=function(a,hit,crit){
  var n=pmf(a.damage.expression,false),c=pmf(a.damage.expression,true),len=Math.max(n.length,c.length),out=new Array(len),i;
  for(i=0;i<len;i++)out[i]=0;
  out[0]+=1-hit;
  for(i=0;i<n.length;i++)out[i]+=(hit-crit)*n[i];
  for(i=0;i<c.length;i++)out[i]+=crit*c[i];
  return out;
};

var D=Core.dist={};
/* A damage distribution for a creature with `cap` hit points: dist[i] is the chance of exactly i damage so far, and dist[cap] is the chance
   it has been dropped (at or past cap). It starts as certainty of nothing. */
D.start=function(cap){var d=new Array(cap+1),i;for(i=0;i<=cap;i++)d[i]=0;d[0]=1;return d};
D.add=function(dist,dmg){
  var cap=dist.length-1,out=new Array(cap+1),i,j;
  for(i=0;i<=cap;i++)out[i]=0;
  out[cap]=dist[cap];
  for(i=0;i<cap;i++){
    if(!dist[i])continue;
    for(j=0;j<dmg.length;j++){
      if(!dmg[j])continue;
      var k=i+j;if(k>cap)k=cap;
      out[k]+=dist[i]*dmg[j];
    }
  }
  return out;
};
D.mean=function(dist){var m=0,i;for(i=0;i<dist.length;i++)m+=i*dist[i];return m};
D.dropped=function(dist){return dist[dist.length-1]};

/* ---------- attack odds ---------- */
/* tc is what Fable.combat.checkTarget returns ({distanceFt, band, cover}). */
Core.odds=function(s,c,a,t,tc){
  var rs=Cb().attackRollState(s,c,a,t,tc);
  var ac=Cb().targetAc(s,c,t,tc);
  var ch=Cb().hitChance(a.bonus.value,ac,rs.state);
  return {hit:ch.hit,crit:rs.autoCrit?ch.hit:ch.crit,state:rs.state,ac:ac,need:ch.need,advantage:rs.advantage,disadvantage:rs.disadvantage,autoCrit:!!rs.autoCrit};
};

function remaining(c,item){return ((c.stock&&c.stock[item])||0)-((c.thrown&&c.thrown[item])||0)}
Core.remaining=remaining;
/* Could this creature make this attack in a turn of its own: it deals damage, the weapon is in hand (or thrown from the pack) and there is stock. */
Core.usable=function(c,a){
  if(!a||!a.damage||!a.damage.stats||a.damage.stats.average<=0)return false;
  if(a.available===false)return false;
  if(a.mode==='light-extra')return false;
  if(a.mode==='melee'){
    if(a.item&&(!a.equipped||remaining(c,a.item)<1))return false;
    return true;
  }
  if(a.item&&remaining(c,a.item)<1)return false;
  return true;
};
Core.maxRange=function(c){
  var m=c.reachFt||5;
  (c.attacks||[]).forEach(function(a){if(Core.usable(c,a)&&a.range)m=Math.max(m,a.range.long)});
  return m;
};

/* ---------- movement reach (cached per planning run) ---------- */
/* Every square c could stand on after a full turn of walking from where it is, by terrain only (creatures in the way are ignored: a
   forecast, not a path). ctx.cache holds the result under the creature, square and speed. */
Core.reach=function(ctx,c,speedFt){
  var sp=speedFt===undefined?St().speedFt(c,c.speedFt):speedFt;
  var key='r|'+c.id+'|'+c.cell.c+','+c.cell.r+'|'+sp;
  var hit=ctx.cache[key];
  if(hit)return hit;
  var list=Gr().reachable(ctx.s.grid,c.cell,sp);
  var out=list.map(function(q){return {c:q.c,r:q.r,ft:q.ft}});
  ctx.cache[key]=out;
  return out;
};

/* ---------- what the other side can do next (the reply) ---------- */
/* The roll for attack a by `who` against T with the position terms left out (Long range, an enemy within 5 feet): the conditions on both
   sides, Dodge, Hidden, Sapped, darkness. Found with `who` far from everybody, then cached. */
function baseFor(ctx,who,a,T){
  var key='b|'+who.id+'|'+a.id+'|'+T.id+'|'+ctx.sig(who)+'|'+ctx.sig(T)+'|'+T.cell.c+','+T.cell.r;
  var hit=ctx.cache[key];
  if(hit)return hit;
  var save=who.cell,ranged=a.mode!=='melee';
  who.cell={c:-99,r:-99};
  var o;
  try{o=Core.odds(ctx.s,who,a,T,{distanceFt:5,band:ranged?'normal':'reach',cover:{level:0,name:'none',blocked:0,bonus:0}})}
  finally{who.cell=save}
  var b={advN:o.advantage.length,disN:o.disadvantage.length,autoCrit:o.autoCrit,avg:a.damage.stats.average,critExtra:Core.critExtra(a)};
  ctx.cache[key]=b;
  return b;
}
/* What attack a would do from square q against T, with every position term: range band, cover, an enemy within 5 feet for a ranged
   attack. null when q is out of range or T has Total Cover from it. */
Core.optionAt=function(ctx,who,a,T,q){
  var G=Gr(),ranged=a.mode!=='melee',s=ctx.s,band,d=G.distanceFt(q,T.cell);
  if(ranged){
    var rng=a.range;
    if(!rng||d>rng.long)return null;
    band=d>rng.normal?'long':'normal';
  }else{
    if(!G.inReach(q,T.cell,a.reach||who.reachFt||5))return null;
    band='reach';
  }
  var cover=G.coverBetween(s.grid,q,T.cell);
  if(cover.level>=G.COVER.total)return null;
  var b=baseFor(ctx,who,a,T),dis=b.disN+(band==='long'?1:0);
  if(ranged){
    var adj=G.chebyshev(q,T.cell)<=1;
    if(!adj)ctx.opponentsOf(who).forEach(function(o){if(o.cell&&o.alive&&!o.down&&G.chebyshev(q,o.cell)<=1)adj=true});
    if(adj)dis++;
  }
  var state=b.advN&&!dis?'advantage':dis&&!b.advN?'disadvantage':'normal';
  var ac=T.ac.value+cover.bonus;
  var ch=Cb().hitChance(a.bonus.value,ac,state);
  var crit=b.autoCrit?ch.hit:ch.crit;
  return {expected:ch.hit*b.avg+crit*b.critExtra,hit:ch.hit,crit:crit,attack:a,from:{c:q.c,r:q.r},band:band,state:state,ac:ac,cover:cover.level,distanceFt:d};
};

/* The best attack option the foe has against target T from anywhere it can reach, as {expected, hit, dmg (pmf), attack, from, band, ...}. */
function bestOption(ctx,foe,T){
  var key='o|'+foe.id+'|'+T.id+'|'+T.cell.c+','+T.cell.r+'|'+ctx.sig(T)+'|'+ctx.sig(foe);
  if(ctx.cache[key]!==undefined)return ctx.cache[key];
  var cells=Core.reach(ctx,foe).slice(),best=null;
  cells.push({c:foe.cell.c,r:foe.cell.r,ft:0});
  (foe.attacks||[]).forEach(function(a){
    if(!Core.usable(foe,a))return;
    cells.forEach(function(q){
      var o=Core.optionAt(ctx,foe,a,T,q);
      if(o&&(!best||o.expected>best.expected+1e-9))best=o;
    });
  });
  if(best)best.dmg=Core.damagePmf(best.attack,best.hit,best.crit);
  ctx.cache[key]=best||null;
  return best||null;
}
Core.bestOption=bestOption;

/* The opposing side's answer to the position in node n, from the actor's point of view. Every foe that can act picks (softly, so that a
   target who is not the only juicy one is not always chosen) among our creatures it can attack, the way a sensible opponent would.
   Returns {actor:{expected, pDown, dist}, allies:expected damage to the others, picks:[...] for the trace}. */
Core.reply=function(ctx,n){
  var a=n.a,s=n.s,out={expected:0,pDown:0,allies:0,picks:[],dist:n.taken};
  var hidden=!!n.hiddenEnd;
  var mates=ctx.mates.filter(function(m){return m.alive&&!m.down&&m.cell});
  var targets=[a].concat(mates.map(function(m){return s.byId[m.id]||m}));
  var dist=n.taken,cap=dist.length-1;
  /* Opportunity Attacks the plan provokes are already in n.taken */
  out.expected=D.mean(dist);
  ctx.foes.forEach(function(f0){
    var foe=s.byId[f0.id]||f0;
    if(!foe.alive||foe.down||!foe.cell)return;
    var rows=[];
    targets.forEach(function(T){
      if(!T.cell||!T.alive)return;
      if(T===a&&hidden)return;
      if(T!==a&&Se().isHidden(T))return;
      var opt=bestOption(ctx,foe,T);
      if(!opt)return;
      var pk=0,j,need=Math.max(1,Math.ceil(T.hp.current));
      for(j=need;j<opt.dmg.length;j++)pk+=opt.dmg[j];
      var score=opt.expected+(1+0.35*T.hp.max)*pk;
      rows.push({T:T,opt:opt,score:score});
    });
    if(!rows.length)return;
    var tau=2,w=0,i;
    var mx=rows.reduce(function(m,r){return Math.max(m,r.score)},-1e9);
    rows.forEach(function(r){r.w=Math.exp((r.score-mx)/tau);w+=r.w});
    rows.forEach(function(r){
      var p=r.w/w;
      r.opt.expected=r.opt.dmg.reduce(function(m,v,j){return m+j*v},0);
      if(r.T===a){
        var before=D.mean(dist);
        var next=D.add(dist,r.opt.dmg);
        out.expected+=p*(D.mean(next)-before);
        out.pDown+=p*(D.dropped(next)-D.dropped(dist));
        out.picks.push({foe:foe.id,target:a.id,attack:r.opt.attack.id,p:p,expected:r.opt.expected,from:r.opt.from,band:r.opt.band,hit:r.opt.hit});
      }else{
        out.allies+=p*r.opt.expected;
        out.picks.push({foe:foe.id,target:r.T.id,attack:r.opt.attack.id,p:p,expected:r.opt.expected,from:r.opt.from,band:r.opt.band,hit:r.opt.hit});
      }
    });
  });
  out.pDown+=D.dropped(dist);
  return out;
};

/* ---------- small helpers ---------- */
var critCache=Object.create(null);
/* How much more a Critical Hit adds on average than a plain hit (the extra dice). */
Core.critExtra=function(a){
  var e=a.damage.expression;
  if(critCache[e]===undefined)critCache[e]=Fable.dice.stats(e,{crit:true}).average-Fable.dice.stats(e).average;
  return critCache[e];
};
/* A repeatable number in [0, 1) from the fight's seed and some text, for tie-breaks and morale checks (never the rules dice). */
Core.unit=function(seed,text){
  var h=Fable.rng.hash(String(seed)+'|'+text);
  return Fable.rng(h)();
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
