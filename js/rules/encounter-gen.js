/* The encounter generator (gameplay vision, section 3): what happens between "Play" and the first turn of an ordinary fight.
   Pure rules code, no DOM and no Three.js, and fully seeded, so the same inputs always give the same encounter.

     Fable.encounterGen.generate({levels, difficulty, seed, recent, maps, monsters, economy, playerCharacter, maxPerPlayer})
        -> {ok:true, encounter, meta} | {ok:false, reason}
     Fable.encounterGen.DIFFICULTIES      [{id:'low', name:'Low'}, {id:'moderate', ...}, {id:'high', ...}]
     Fable.encounterGen.budget(levels, difficulty, economyId)   the XP budget of a party at a difficulty
     Fable.encounterGen.key(encounter)    the "map plus enemies" key used to remember what was played recently

   How it chooses:
     1. The budget is the 2024 XP budget for the party's levels at the chosen difficulty (Fable.rewards.budgets). No 2014 multiplier.
     2. Maps are those with an enemy spawn zone. A monster fits a map when one of its `environments` tags is among the map's
        `environments` (a monster with no tag fits anywhere, at a lower score).
     3. Enemy groups are every mix of up to two kinds of monster, at most `maxPerPlayer` (default 2) per player character, whose XP
        fits the budget. Only groups that cannot take one more creature without going over are kept, so the budget is spent as fully as
        it can be; what is left over is recorded in meta.unused.
     4. Each (map, group) is scored: budget fit, how well the monsters belong in the map, theme (one family reads better than a
        random mix), tactical variety (different roles), and a penalty for what was played recently. A seeded jitter breaks ties.
     5. A group has to fit its spawn zone (the line formation needs a cell per creature). When nothing is valid the generator falls
        back to one of the cheapest creature that fits, says so in meta.fallback, and still returns something playable.

   The encounter it returns has the same shape as a registered encounter (map, enemies, rewards, ai) plus generated:true, so the
   game scene, the combat controller and the rewards code treat it exactly like authored content. It never has a dialogue script. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable,EG=Fable.encounterGen={};
var CELL=15;                      /* world units in one 5 ft square (a map unit is 10 cm) */
EG.DIFFICULTIES=[{id:'low',name:'Low'},{id:'moderate',name:'Moderate'},{id:'high',name:'High'}];
var W={fit:5,env:1.2,theme:1.1,variety:.6,recent:2.4,jitter:.25};

function diff(id){return EG.DIFFICULTIES.filter(function(d){return d.id===id})[0]||null}
function eco(id){return Fable.rewards.economy(id)}
EG.budget=function(levels,difficulty,economyId){return Fable.rewards.budgets(eco(economyId),levels)[difficulty]};

function monsterXp(m){return m&&m.challenge&&m.challenge.xp>0?m.challenge.xp:0}
function listOf(reg){return Array.isArray(reg)?reg:reg&&reg.list?reg.list():[]}
function overlap(a,b){return (a||[]).filter(function(x){return (b||[]).indexOf(x)>=0})}

/* the zones of a map that can hold n creatures in a line */
function zoneCols(z){return Math.max(0,Math.floor((z.w||0)/CELL))}
function zoneRows(z){return Math.max(0,Math.floor((z.d||0)/CELL))}
function zoneCapacity(z){return zoneCols(z)*zoneRows(z)}
function pickZone(map,count){
  var best=null;
  (map.enemySpawns||[]).forEach(function(z){
    var cap=zoneCapacity(z);
    if(cap>=count&&(!best||cap<zoneCapacity(best)))best=z;   /* the snuggest zone that still fits */
  });
  return best;
}
EG.key=function(enc){
  var g=(enc.enemies||[]).map(function(e){return e.monster+':'+e.count}).sort().join(',');
  return enc.map+'|'+g;
};

/* every mix of up to two monster kinds with at most maxCount creatures in all and a total XP of at most budget */
function groups(mons,budget,maxCount){
  var out=[],n=mons.length,i,j,a,b;
  function add(list){
    var xp=0,count=0;
    list.forEach(function(e){xp+=monsterXp(e.m)*e.n;count+=e.n});
    if(count>=1&&xp<=budget)out.push({list:list,xp:xp,count:count});
  }
  for(i=0;i<n;i++){
    for(a=1;a<=maxCount;a++){
      add([{m:mons[i],n:a}]);
      for(j=i+1;j<n;j++)for(b=1;a+b<=maxCount;b++)add([{m:mons[i],n:a},{m:mons[j],n:b}]);
    }
  }
  return out;
}
/* a group is "full" when no compatible creature can be added: the budget or the head count is used up */
function isFull(g,mons,budget,maxCount){
  if(g.count>=maxCount)return true;
  var kinds=g.list.length;
  for(var i=0;i<mons.length;i++){
    var x=monsterXp(mons[i]);
    if(g.xp+x>budget)continue;
    var present=g.list.some(function(e){return e.m.id===mons[i].id});
    if(present||kinds<2)return false;
  }
  return true;
}

function envFit(m,map){
  if(!m.environments||!m.environments.length)return .5;
  return overlap(m.environments,map.environments).length?1:0;
}
function themeOf(g){
  if(g.list.length===1)return 1;
  var a=g.list[0].m,b=g.list[1].m;
  return a.family&&a.family===b.family?.85:.35;
}
function varietyOf(g){
  var roles={};g.list.forEach(function(e){roles[e.m.role||e.m.id]=1});
  return Math.min(1,(Object.keys(roles).length-1+.5)/2+(g.count>1?.25:0));
}
function recency(key,recent){
  var idx=(recent||[]).lastIndexOf(key);
  if(idx<0)return 0;
  var age=recent.length-idx;                  /* 1 = the fight just played */
  return 1/age;
}

function summary(list){
  return list.map(function(e){return e.n+' '+e.m.name+(e.n>1&&!/s$/.test(e.m.name)?'s':'')}).join(', ');
}

/* the AI tier per difficulty. The balance sim shows no real gradient between tiers, so every difficulty plays 'cunning' for now;
   the table is the one place to change that once the tiers differ */
var AI_BY_DIFFICULTY={low:'cunning',moderate:'cunning',high:'cunning'};
EG.AI_BY_DIFFICULTY=AI_BY_DIFFICULTY;

/* par: the rounds a party deals the group's total hit points in at about 6 damage per player a round, plus one for closing in */
function parRounds(g,players){
  var hp=0;
  g.list.forEach(function(e){var h=e.m.hp;hp+=((typeof h==='number'?h:h&&h.average)||5)*e.n});
  return Math.max(2,Math.ceil(hp/(6*Math.max(1,players)))+1);
}
EG.parRounds=parRounds;

function build(o,map,zone,g,meta){
  var xpRounds=parRounds(g,o.levels.length);
  return {
    id:'generated-'+o.difficulty+'-'+o.seed,
    name:summary(g.list),
    description:summary(g.list)+', '+map.name,
    map:map.id,
    playerCharacter:o.playerCharacter||'human-fighter',
    generated:true,difficulty:o.difficulty,seed:o.seed,
    /* the knowledge policy for an ordinary fight: armor class and hit points stay hidden (plan 13.9) */
    reveal:{ac:false,hp:false},
    ai:{tier:AI_BY_DIFFICULTY[o.difficulty]||'cunning',tricks:['throw-from-cover','hit-and-run','focus-fire']},
    rewards:{xp:'auto',gold:'auto',bonuses:true,par:{rounds:xpRounds},items:[]},
    enemies:(function(){
      var start=0,rows=Math.max(1,zoneRows(zone));
      return g.list.map(function(e){
        var f={type:'grid',columns:Math.max(1,zoneCols(zone)),rows:rows,spacing:12,start:start,offsetZ:5};
        start+=e.n;
        return {monster:e.m.id,spawnZone:zone.id,count:e.n,formation:f};
      });
    })(),
    meta:meta
  };
}

EG.generate=function(o){
  o=o||{};
  var levels=o.levels&&o.levels.length?o.levels.slice():[1];
  if(!diff(o.difficulty))return {ok:false,reason:'Unknown difficulty "'+o.difficulty+'"'};
  if(!levels.every(function(l){return Number.isInteger(l)&&l>=1&&l<=20}))return {ok:false,reason:'Character levels must be whole numbers from 1 to 20'};
  var seed=Number.isInteger(o.seed)?o.seed:1;
  o=Object.assign({},o,{levels:levels,seed:seed});
  var rnd=Fable.rng(seed),budget=EG.budget(levels,o.difficulty,o.economy),maxCount=Math.max(1,(o.maxPerPlayer||2)*levels.length);
  var maps=(o.maps||listOf(Fable.content.maps)).filter(function(m){return m&&(m.enemySpawns||[]).length}),
      all=(o.monsters||listOf(Fable.content.monsters)).filter(function(m){return monsterXp(m)>0});
  if(!maps.length)return {ok:false,reason:'No map has an enemy spawn zone'};
  if(!all.length)return {ok:false,reason:'No monster has an XP value'};

  var best=null,seen=0;
  maps.forEach(function(map){
    var mons=all.filter(function(m){return envFit(m,map)>0});
    var gs=groups(mons,budget,maxCount),full=gs.filter(function(g){return isFull(g,mons,budget,maxCount)});
    (full.length?full:gs).forEach(function(g){
      var zone=pickZone(map,g.count);
      if(!zone)return;                                           /* spawn validity: a line of that many has to fit the zone */
      var envs=g.list.reduce(function(n,e){return n+envFit(e.m,map)},0)/g.list.length;
      var key=EG.key({map:map.id,enemies:g.list.map(function(e){return {monster:e.m.id,count:e.n}})});
      var score=W.fit*(budget?g.xp/budget:0)+W.env*envs+W.theme*themeOf(g)+W.variety*varietyOf(g)-W.recent*recency(key,o.recent)+W.jitter*rnd();
      seen++;
      if(!best||score>best.score)best={score:score,map:map,zone:zone,g:g,key:key};
    });
  });
  var fallback=false;
  if(!best){
    /* nothing fits the budget (a party too weak for any creature we have): one of the cheapest, flagged so nobody is surprised */
    fallback=true;
    var map=maps[0],pool=all.filter(function(m){return envFit(m,map)>0});
    if(!pool.length)pool=all;
    pool.sort(function(a,b){return monsterXp(a)-monsterXp(b)});
    var zone=pickZone(map,1);
    if(!zone)return {ok:false,reason:'The map "'+map.id+'" has no spawn zone that holds a creature'};
    best={score:0,map:map,zone:zone,g:{list:[{m:pool[0],n:1}],xp:monsterXp(pool[0]),count:1},key:''};
  }
  var meta={difficulty:o.difficulty,budget:budget,spent:best.g.xp,unused:Math.max(0,budget-best.g.xp),maxEnemies:maxCount,
    fallback:fallback,candidates:seen,score:Math.round(best.score*100)/100,key:EG.key({map:best.map.id,enemies:best.g.list.map(function(e){return {monster:e.m.id,count:e.n}})}),
    levels:levels.slice(),mapName:best.map.name,zone:best.zone.id};
  return {ok:true,encounter:build(o,best.map,best.zone,best.g,meta),meta:meta};
};
})(typeof window!=='undefined'?window:globalThis);
