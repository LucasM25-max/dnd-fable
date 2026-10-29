/* Rewards: XP, difficulty tier, gold and what is dropped (implementation plan, section 17). Pure: no DOM, no Three.js, so the rules
   tests, the results screen and the hub all use the same numbers.

   One game is one encounter, so the reward is paid when it ends. XP comes from the stat blocks of the creatures defeated, the tier
   from the encounter's total XP against the party's XP budget, and gold from XP:

       gold = round( XP x goldPerXp x tierMultiplier x (1 + performanceBonus) )

   The constants are data (Fable.content.economies, js/content/economy/standard.js). Every number is turned into a whole number before it
   is multiplied, and a half rounds up, so the same fight always pays the same gold. Money is returned in copper (Fable.money).

   Fable.rewards.economy(id)                       the economy row ('standard' unless an id is given)
   Fable.rewards.enemies(state)                    [{id, name, defId, xp, status:'defeated'|'routed'|'standing', treasure}] from a combat state
   Fable.rewards.tier(economy, levels, totalXp)    {id, name, multiplier, index, totalXp, budgets:{low, moderate, high}}
   Fable.rewards.gold(economy, xp, tier, bonusPercent)   whole gold pieces
   Fable.rewards.bonuses(economy, spec, facts)     [{id, name, percent, earned, text, reason}] (facts: hpCurrent, hpMax, rounds, consumablesUsed)
   Fable.rewards.shares(enemies, cp)               [{id, cp}] the gold split among the defeated by their share of the XP; sums to cp exactly
   Fable.rewards.pieces(cp)                        how many coins to show for an amount, as a list of values that sums to it
   Fable.rewards.rollItems(list, rng)              the dropped items [{item, qty}] from a rewards.items list
   Fable.rewards.progress(xpBefore, gained)        {before, after, levelsGained, crossed:[levels]} for the XP bar
   Fable.rewards.compute(input)                    the whole result of a fight (below)
   Fable.rewards.estimate(encounter, levels)       what an encounter is worth, for the hub, before it is played

   compute({win, encounter, enemies, hero:{hp, hpMax}, rounds, consumablesUsed, levels, xpBefore, rng, economy})
     -> {win, economy, xp, enemies, tier, bonuses, bonusPercent, goldBase, gold, cp, shares, items, progress}
   A defeat gives no XP, no gold and no items. rewards.xp / rewards.gold may each be 'auto' (computed) or a number (a story reward, paid
   as written: a number of gold is not changed by the tier or the bonuses). */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable,R=Fable.rewards={};

function isInt(n){return typeof n==='number'&&isFinite(n)&&Math.floor(n)===n}
function pct(n){return Math.round(n*100)}

R.economy=function(id){
  var reg=Fable.content&&Fable.content.economies,e=reg&&reg.get(id||'standard');
  if(!e)throw new Error('Rewards: there is no economy "'+(id||'standard')+'" (is the economy group loaded?)');
  return e;
};

/* ---------- who was defeated ---------- */
R.enemies=function(s){
  return s.creatures.filter(function(c){return c.team!=='player'}).map(function(c){
    var xp=c.statblock&&c.statblock.challenge&&isInt(c.statblock.challenge.xp)?c.statblock.challenge.xp:0;
    var def=Fable.content&&Fable.content.monsters&&c.defId?Fable.content.monsters.get(c.defId):null;
    return {id:c.id,name:c.name,defId:c.defId||null,xp:xp,treasure:(def&&def.treasure)||[],
      status:c.fled||c.routed?'routed':(c.alive===false||c.down)?'defeated':'standing'};
  });
};

/* ---------- difficulty ---------- */
function budget(eco,level,col){
  var row=null,i;
  for(i=0;i<eco.budgets.length;i++)if(eco.budgets[i].level===level)row=eco.budgets[i];
  if(!row){
    /* a level the table does not list uses the nearest one it does */
    var best=null;
    eco.budgets.forEach(function(b){if(best===null||Math.abs(b.level-level)<Math.abs(best.level-level))best=b});
    row=best;
  }
  return row[col];
}
R.budgets=function(eco,levels){
  var out={low:0,moderate:0,high:0};
  levels.forEach(function(l){['low','moderate','high'].forEach(function(k){out[k]+=budget(eco,l,k)})});
  return out;
};
R.tier=function(eco,levels,totalXp){
  var b=R.budgets(eco,levels),idx=eco.tiers.length-1;
  for(var i=0;i<eco.tiers.length-1;i++){if(totalXp<=b[eco.tiers[i].budget]){idx=i;break}}
  var t=eco.tiers[idx];
  return {id:t.id,name:t.name,multiplier:t.multiplier,index:idx,totalXp:totalXp,budgets:b};
};

/* ---------- gold ---------- */
R.gold=function(eco,xp,tier,bonusPercent){
  var a=pct(eco.goldPerXp),m=pct(tier.multiplier),b=100+(bonusPercent||0);
  var num=xp*a*m*b,den=100*100*100;
  return Math.floor((2*num+den)/(2*den)); /* round half up, in whole numbers */
};
R.bonuses=function(eco,spec,facts){
  if(!spec||spec.bonuses!==true)return [];
  var out=[];
  eco.bonuses.forEach(function(b){
    var earned=false,reason='';
    if(b.rule==='hp-above'){
      var f=facts.hpMax>0?facts.hpCurrent/facts.hpMax:0;
      earned=f>b.fraction;reason='Finished with '+facts.hpCurrent+' of '+facts.hpMax+' hit points';
    }else if(b.rule==='rounds-within-par'){
      var par=spec.par&&spec.par.rounds;
      if(!isInt(par))return; /* an encounter without a par has no Swift bonus to earn */
      earned=facts.rounds<=par;reason='Won in '+facts.rounds+' round'+(facts.rounds===1?'':'s')+' (par '+par+')';
    }else if(b.rule==='no-consumables'){
      earned=!(facts.consumablesUsed>0);reason=earned?'No consumables used':facts.consumablesUsed+' consumable'+(facts.consumablesUsed===1?'':'s')+' used';
    }
    out.push({id:b.id,name:b.name,percent:b.percent,earned:earned,text:b.text,reason:reason});
  });
  return out;
};

/* ---------- who gets which coins ---------- */
/* The gold is split among the defeated by their share of the XP (largest remainder, so the pieces always add up to the total).
   When nobody carries any XP it is split evenly. */
R.shares=function(enemies,cp){
  var dead=enemies.filter(function(e){return e.status!=='standing'});
  if(!dead.length||cp<=0)return dead.map(function(e){return {id:e.id,cp:0}});
  var total=dead.reduce(function(n,e){return n+e.xp},0),weight=function(e){return total>0?e.xp:1},sum=total>0?total:dead.length;
  var out=dead.map(function(e,i){var raw=cp*weight(e)/sum;return {id:e.id,cp:Math.floor(raw),rem:raw-Math.floor(raw),i:i}});
  var left=cp-out.reduce(function(n,o){return n+o.cp},0);
  out.slice().sort(function(a,b){return b.rem-a.rem||a.i-b.i}).slice(0,left).forEach(function(o){o.cp++});
  return out.map(function(o){return {id:o.id,cp:o.cp}});
};
/* Coins to show for an amount: more money is more coins, up to a handful that still reads as a burst. Values sum to cp. */
R.pieces=function(cp){
  if(!(cp>0))return [];
  var n=Math.min(14,Math.max(2,Math.ceil(Math.sqrt(cp/100)*2.2)));
  if(cp<n)n=cp;
  var base=Math.floor(cp/n),extra=cp-base*n,out=[];
  for(var i=0;i<n;i++)out.push(base+(i<extra?1:0));
  return out;
};

/* ---------- items ---------- */
R.rollItems=function(list,rng){
  var out=[];
  (list||[]).forEach(function(e){
    var chance=e.chance===undefined?100:e.chance;
    if(chance>=100||(rng||Math.random)()*100<chance)out.push({item:e.item,qty:e.qty===undefined?1:e.qty});
  });
  return out;
};

/* ---------- the XP bar ---------- */
R.progress=function(xpBefore,gained){
  var T=Fable.tables,before=T.xpProgress(xpBefore),after=T.xpProgress(xpBefore+gained),crossed=[];
  for(var l=before.level+1;l<=after.level;l++)crossed.push(l);
  return {before:before,after:after,levelsGained:after.level-before.level,crossed:crossed};
};

/* ---------- the whole result ---------- */
function auto(v){return v===undefined||v==='auto'}
R.compute=function(inp){
  var enc=inp.encounter||{},spec=enc.rewards||{},eco=inp.economy||R.economy(spec.economy),levels=inp.levels&&inp.levels.length?inp.levels:[1];
  var enemies=(inp.enemies||[]).map(function(e){return Object.assign({},e)});
  var win=!!inp.win;
  var encounterXp=enemies.reduce(function(n,e){return n+e.xp},0);
  var tier=R.tier(eco,levels,encounterXp);
  var res={win:win,economy:eco.id,enemies:enemies,tier:tier,encounterXp:encounterXp,xp:0,bonuses:[],bonusPercent:0,goldBase:0,gold:0,cp:0,shares:[],items:[],
    progress:null,spec:{xp:auto(spec.xp)?'auto':spec.xp,gold:auto(spec.gold)?'auto':spec.gold,bonuses:spec.bonuses===true}};
  var xpBefore=isInt(inp.xpBefore)?inp.xpBefore:0;
  if(win){
    var earnedXp=enemies.filter(function(e){return e.status!=='standing'}).reduce(function(n,e){return n+e.xp},0);
    res.xp=auto(spec.xp)?earnedXp:spec.xp;
    if(auto(spec.gold)){
      res.bonuses=R.bonuses(eco,spec,{hpCurrent:inp.hero?inp.hero.hp:0,hpMax:inp.hero?inp.hero.hpMax:1,rounds:inp.rounds||0,consumablesUsed:inp.consumablesUsed||0});
      res.bonusPercent=res.bonuses.reduce(function(n,b){return n+(b.earned?b.percent:0)},0);
      res.goldBase=R.gold(eco,res.xp,tier,0);
      res.gold=R.gold(eco,res.xp,tier,res.bonusPercent);
    }else{res.goldBase=res.gold=spec.gold}
    res.cp=res.gold*100;
    res.shares=R.shares(enemies,res.cp);
    res.items=R.rollItems(spec.items,inp.rng);
  }
  res.progress=R.progress(xpBefore,res.xp);
  return res;
};

/* What an encounter is worth, before it is played: every creature defeated, none of the bonuses. The hub shows it. */
R.estimate=function(enc,levels){
  var spec=(enc&&enc.rewards)||{},eco=R.economy(spec.economy),xp=0,mons=Fable.content&&Fable.content.monsters;
  ((enc&&enc.enemies)||[]).forEach(function(g){
    var m=mons&&mons.get(g.monster);
    if(m&&m.challenge)xp+=m.challenge.xp*g.count;
  });
  var tier=R.tier(eco,levels&&levels.length?levels:[1],xp),gp=auto(spec.gold)?R.gold(eco,auto(spec.xp)?xp:spec.xp,tier,0):spec.gold;
  var top=0;
  if(auto(spec.gold)&&spec.bonuses===true)top=R.gold(eco,auto(spec.xp)?xp:spec.xp,tier,R.bonuses(eco,{bonuses:spec.bonuses,par:spec.par},{hpCurrent:1,hpMax:1,rounds:0,consumablesUsed:0}).reduce(function(n,b){return n+b.percent},0));
  return {xp:auto(spec.xp)?xp:spec.xp,tier:tier,gold:gp,maxGold:top||gp};
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
