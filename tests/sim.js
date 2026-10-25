'use strict';
/* Headless fight simulator (implementation plan, section 16.10). Plays the tutorial encounter (a level 1 Human Fighter against two Goblin
   Minions) thousands of times with scripted hero behaviours and reports the win rate, rounds, hit points lost and Second Wind use. It is the
   tuning tool for the enemy AI and, through tests/suites/phase8-sim.test.js, a regression test: a sensible hero must stay inside the agreed bands.

   node tests/sim.js [fights] [policy|all] [tier]      policies: nearest, windy, kite   tiers: instinct cunning tactician mastermind */
const H=require('./harness');

let C=null;
async function init(){if(!C)C=await H.loadData({monsters:true,heroes:true});return C}

/* The clearing in grid form: open ground with a few trees (blocked squares) the goblins can use as cover. */
let GRID=null;
function makeGrid(seed){
  if(GRID)return GRID;
  const g=Fable.grid.create({cols:24,rows:24}),rnd=Fable.rng(seed*7+1);
  const trees=[[9,6],[9,7],[13,10],[13,11],[10,15],[11,15],[16,14],[6,12],[15,5],[17,18]];
  trees.forEach(([c,r])=>Fable.grid.setBlocked(g,c,r,true));
  GRID=g;return g;
}

function nearestFoe(s,c,filter){
  let best=null;
  s.creatures.forEach(o=>{
    if(o.team===c.team||!o.alive||o.down||!o.cell)return;
    if(filter&&!filter(o))return;
    const d=Fable.grid.distanceFt(c.cell,o.cell);
    if(!best||d<best.d)best={o,d};
  });
  return best&&best.o;
}
function visible(s,hero){return o=>Fable.senses.sees(s,hero,o)}

/* Moves c to the reachable square nearest to target that is within `within` feet of it (or as near as it can). */
function approach(s,c,target,within){
  const G=Fable.grid;
  if(G.distanceFt(c.cell,target.cell)<=within)return;
  let best=null;
  Fable.combat.reachable(s,c).forEach(q=>{
    const d=G.distanceFt(q,target.cell);
    const key=[d<=within?0:d,q.ft];
    if(!best||key[0]<best.key[0]||(key[0]===best.key[0]&&key[1]<best.key[1]))best={q,key};
  });
  if(best)Fable.combat.move(s,c,{c:best.q.c,r:best.q.r},{reactions:{[c.id]:true}});
}
function secondWind(s,hero,frac){
  if(hero.hp.current<=hero.hp.max*frac&&Fable.combat.actionState(s,hero,'second-wind').ok)Fable.combat.useAction(s,hero,'second-wind');
}
function swing(s,hero,target){
  const atk=Fable.combat.findAttack(hero,'longsword:melee');
  if(target&&Fable.combat.attackState(s,hero,atk,{}).ok&&Fable.combat.checkTarget(s,hero,atk,target,{}).ok)return Fable.combat.attack(s,hero,atk.id,target,{noReroll:true});
  return null;
}

/* A hero who saw a goblin slip out of sight knows roughly where it went: it walks there, and searches when it cannot see anything. */
function chase(s,hero,within){
  const t=nearestFoe(s,hero,visible(s,hero));
  if(t){approach(s,hero,t,within);swing(s,hero,t);return}
  const any=nearestFoe(s,hero);
  if(!any)return;
  approach(s,hero,any,5);
  if(Fable.combat.actionState(s,hero,'search').ok)Fable.combat.useAction(s,hero,'search');
  const t2=nearestFoe(s,hero,visible(s,hero));
  if(t2)swing(s,hero,t2);
}

const POLICIES={
  /* walks up to the nearest goblin it can see and hits it; never heals */
  nearest(s,hero){
    chase(s,hero,5);
  },
  /* the same, and uses Second Wind below half hit points */
  windy(s,hero){
    secondWind(s,hero,0.5);
    POLICIES.nearest(s,hero);
  },
  /* throws javelins while the goblins are not close, stays out of reach, and fights in melee when cornered or out of javelins */
  kite(s,hero){
    secondWind(s,hero,0.5);
    const t=nearestFoe(s,hero,visible(s,hero));
    if(!t){chase(s,hero,5);return}
    const jav=Fable.combat.findAttack(hero,'javelin:thrown');
    const left=Fable.aiCore.remaining(hero,'javelin');
    const d=Fable.grid.distanceFt(hero.cell,t.cell);
    if(left>0&&d>5&&Fable.combat.checkTarget(s,hero,jav,t,{}).ok){
      Fable.combat.attack(s,hero,jav.id,t,{noReroll:true});
      return;
    }
    approach(s,hero,t,5);swing(s,hero,t);
  }
};

async function runFight(opts){
  await init();
  const seed=opts.seed;
  const hero=Fable.creature.fromSheet(Fable.character.compute(C.characters.get('human-fighter').build),{id:'hero'});
  const gobs=[0,1].map(i=>Fable.creature.fromMonster(C.monsters.get('goblin-minion'),{index:i,rnd:undefined}));
  if(opts.profile)gobs.forEach(g=>{g.ai=Object.assign({},g.ai,opts.profile,{weights:Object.assign({},g.ai.weights,opts.profile.weights||{})})});
  const s=Fable.combat.create({grid:makeGrid(seed),seed:seed,creatures:[hero].concat(gobs)});
  Fable.combat.place(s,hero,{c:3,r:12});
  Fable.combat.place(s,gobs[0],{c:15,r:9});Fable.combat.place(s,gobs[1],{c:15,r:14});
  Fable.combat.start(s);
  const stats={rounds:0,windUsed:false,fled:0,hidden:0,trace:[]};
  let guard=0;
  while(s.phase==='running'&&guard++<400){
    const c=Fable.combat.active(s);
    if(!c.alive){Fable.combat.endTurn(s);continue}
    if(c.team==='player'){
      if(!c.down)POLICIES[opts.policy](s,c);
    }else if(!c.down){
      const r=Fable.ai.takeTurn(s,c,{tier:opts.tier,reactions:{hero:true}});
      if(opts.trace)stats.trace.push(Fable.ai.explain(r.plans[0].trace));
    }
    if(s.phase==='running')Fable.combat.endTurn(s);
    if(s.round>40)break;
  }
  stats.rounds=s.round;stats.winner=s.winner;
  stats.heroHpLost=hero.hp.max-Math.max(0,hero.hp.current);
  stats.heroDown=hero.down||!hero.alive;
  stats.windUsed=hero.resources['second-wind-uses']&&hero.resources['second-wind-uses'].current<hero.resources['second-wind-uses'].max;
  stats.goblinsLeft=gobs.filter(g=>g.alive).length;
  return stats;
}

async function batch(opts){
  const n=opts.fights||200,out={fights:n,wins:0,rounds:0,hp:0,wind:0,timeouts:0,downs:0,goblinsLeft:0};
  for(let i=0;i<n;i++){
    const r=await runFight(Object.assign({},opts,{seed:1000+i}));
    if(r.winner==='player')out.wins++;
    else if(r.winner===null||r.winner===undefined)out.timeouts++;
    out.rounds+=r.rounds;out.hp+=r.heroHpLost;if(r.windUsed)out.wind++;if(r.heroDown)out.downs++;out.goblinsLeft+=r.goblinsLeft;
  }
  return {policy:opts.policy,tier:opts.tier||'default',fights:n,winRate:out.wins/n,avgRounds:out.rounds/n,avgHpLost:out.hp/n,hpLostFrac:out.hp/n/12,
    secondWindRate:out.wind/n,heroDownRate:out.downs/n,timeoutRate:out.timeouts/n};
}

module.exports={init,runFight,batch,POLICIES};

if(require.main===module){
  (async()=>{
    const fights=parseInt(process.argv[2]||'200',10),pol=process.argv[3]||'all',tier=process.argv[4]||undefined;
    const list=pol==='all'?Object.keys(POLICIES):[pol];
    for(const p of list){
      const t=Date.now(),r=await batch({fights,policy:p,tier});
      console.log(p.padEnd(8),'win '+(r.winRate*100).toFixed(1)+'%','rounds '+r.avgRounds.toFixed(1),'hp lost '+r.avgHpLost.toFixed(1)+'/12','down '+(r.heroDownRate*100).toFixed(0)+'%',
        'second wind '+(r.secondWindRate*100).toFixed(0)+'%','timeouts '+(r.timeoutRate*100).toFixed(1)+'%',(Date.now()-t)+'ms');
    }
  })().catch(e=>{console.error(e);process.exit(1)});
}
