/* Attacks, damage and death (implementation plan, sections 10, 12 and 13.8; Phase 6). Pure rules code: no DOM, no Three.js, so the
   Node tests, the enemy AI and the browser resolve exactly the same fight. It extends Fable.combat (combat.js).

   Looking, which changes nothing (the HUD and the enemy AI use these too):
     Fable.combat.attackState(s, c, attack, opts)      {ok, reason, cost}: can this creature make the attack now, and what it spends
     Fable.combat.checkTarget(s, c, attack, t, opts)   {ok, reason, distanceFt, band}: reach or range, line of sight, hostility
     Fable.combat.targetsFor(s, c, attack, opts)       every hostile creature with its check
     Fable.combat.attackRollState(s, c, attack, t, tc) advantage and disadvantage with the source of each
     Fable.combat.previewAttack(s, c, attack, t, opts) the numbers on the attack preview card: hit chance, damage, masteries
     Fable.combat.hitChance(bonus, ac, state)          {hit, crit} as fractions

   Doing:
     Fable.combat.attack(s, c, attackId, t, opts)      roll and resolve in one go (the AI and the tests); opts.reroll(pending)
                                                       returns true to spend Heroic Inspiration on the d20
     Fable.combat.beginAttack(...) / completeAttack(s, pending, {reroll})   the same in two steps, so the player can be asked
                                                       whether to reroll between the d20 and the damage
     Fable.combat.opportunityAttack(s, reactor, mover, opts)   the Reaction attack when a creature leaves reach
     Fable.combat.applyDamage(s, source, t, amount, opts)      temporary hit points, dropping to 0, death saves and instant death

   Rules (SRD 5.2.1, "Playing the Game" and the Rules Glossary):
     - An attack roll is d20 + the attack bonus against the target's AC. A natural 1 misses and a natural 20 hits and is a Critical
       Hit; a hit on an Unconscious or Paralyzed target from within 5 feet is a Critical Hit too. A Critical Hit doubles the
       damage dice.
     - A thrown or ranged attack has Disadvantage beyond its normal range (up to the long range) and when an enemy that can act is
       within 5 feet. A thrown weapon leaves the hand: it is counted as thrown for the rest of the fight.
     - The Attack action allows one attack (attacksAllowed). A Light weapon attack opens the extra attack of the Light property:
       once a turn, with a Light weapon in each hand, as a Bonus Action, or as part of the Attack action when the Nick mastery
       applies. Its damage has no ability modifier (the sheet works that out).
     - A creature at 0 hit points: a monster is defeated; a hero falls Unconscious and rolls death saving throws. Damage at 0 hit
       points is a failed save (two for a Critical Hit) and ends being stable; damage of the maximum hit points or more past 0
       kills outright. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var Cb=Fable.combat;
var Grid=function(){return Fable.grid};
var St=function(){return Fable.status};
var H=function(){return Fable.handlers};
var Cr=function(){return Fable.creature};

var ATTACKS_PER_ACTION=1;
function attacksAllowed(){return ATTACKS_PER_ACTION}
function isLight(a){return !!a&&(a.properties||[]).indexOf('light')>=0}
function findAttack(c,id){
  var list=c.attacks||[];
  for(var i=0;i<list.length;i++)if(list[i].id===id)return list[i];
  return null;
}
Cb.findAttack=findAttack;
function remaining(c,item){return (c.stock[item]||0)-(c.thrown[item]||0)}
function heldCount(c,item){
  var h=c.sheet&&c.sheet.loadout&&c.sheet.loadout.hands;
  if(!h)return 1;
  return (h.mainhand===item?1:0)+(h.offhand===item?1:0);
}
function itemName(a){return a.name}

/* ---------- can it be done ---------- */
Cb.attackState=function(s,c,a,opts){
  opts=opts||{};
  var D=Cb.DENIALS,out={ok:false,reason:'',cost:null};
  function no(r){out.reason=r;return out}
  if(!a)return no('Unknown attack');
  if(s.phase!=='running')return no(D.over);
  if(s.pending)return no(D.pending);
  if(!c.alive||c.down)return no('Cannot act');
  if(St()&&!St().canAct(c))return no(D.incapacitated);
  if(!opts.reaction&&Cb.active(s)!==c)return no(D['not-active']);
  if(opts.reaction&&a.mode!=='melee')return no('An Opportunity Attack is a melee attack');
  if(a.available===false)return no(a.reason||'Not available');
  var e=c.economy;
  if(a.item){
    if(a.mode==='thrown'){
      if(remaining(c,a.item)<1)return no('No '+itemName(a)+' left to throw');
    }else if(a.mode==='melee'||a.mode==='light-extra'){
      if(!a.equipped)return no('Not in hand (swap loadout)');
      var need=a.mode==='light-extra'?Math.max(1,heldCount(c,a.item)):1;
      if(remaining(c,a.item)<need)return no(a.mode==='light-extra'?'A Light weapon was thrown':itemName(a)+' was thrown');
    }
  }
  if(a.mode==='light-extra'){
    if(!e.lightAttack)return no('Attack with a Light weapon first');
    if(e.extraUsed)return no('Extra attack already used this turn');
    var nick=a.mastery&&a.mastery.usable&&H().has(a.mastery.handler)?H().run(a.mastery.handler,{attack:a,creature:c,phase:'cost'}):null;
    if(nick&&nick.freeExtraAttack)out.cost='free';
    else{
      if(e.bonus)return no('Bonus Action already used');
      out.cost='bonus';
    }
  }else if(opts.reaction){
    if(e.reaction)return no('Reaction already used');
    out.cost='reaction';
  }else if(e.attackAction&&e.attacksUsed<attacksAllowed(c))out.cost='free';
  else if(!e.action)out.cost='action';
  else return no('Action already used');
  out.ok=true;
  return out;
};

/* Reach or range, then line of sight. band is 'reach' for a melee attack, 'normal' or 'long' for a thrown or ranged one. */
Cb.checkTarget=function(s,c,a,t,opts){
  opts=opts||{};
  var out={ok:false,reason:'',distanceFt:null,band:null};
  function no(r){out.reason=r;return out}
  if(!t||!t.cell||!c.cell)return no('No target');
  if(t===c)return no('Cannot target yourself');
  if(!t.alive)return no('Already defeated');
  if(!Cb.isHostile(c,t))return no('Not an enemy');
  if(Fable.senses&&Fable.senses.isHidden(t)&&!opts.ignoreHidden)return no('Cannot see '+t.name);
  var G=Grid(),dist=G.distanceFt(c.cell,t.cell);
  out.distanceFt=dist;
  if(a.mode==='melee'||a.mode==='light-extra'){
    var reach=a.reach||5;
    if(dist>reach)return no('Out of reach ('+dist+' ft away, reach '+reach+' ft)');
    out.band='reach';
  }else{
    var r=a.range||{normal:5,long:5};
    if(dist>r.long)return no('Out of range ('+dist+' ft away, range '+r.normal+'/'+r.long+' ft)');
    out.band=dist>r.normal?'long':'normal';
  }
  /* cover from the attacker's corners (grid.js): Total Cover cannot be targeted, half and three-quarters raise the target's AC */
  out.cover=Cb.coverFor(s,c,t);
  if(out.cover.level>=G.COVER.total)return no('Blocked');
  out.ok=true;
  return out;
};

/* The cover t has against c and the Armor Class it gives c to beat. */
Cb.coverFor=function(s,c,t){
  return Grid().coverBetween(s.grid,c.cell,t.cell);
};
Cb.targetAc=function(s,c,t,tc){
  var cv=(tc&&tc.cover)||Cb.coverFor(s,c,t);
  return t.ac.value+(cv.bonus||0);
};

Cb.targetsFor=function(s,c,a,opts){
  return s.creatures.filter(function(t){return t!==c&&Cb.isHostile(c,t)&&t.cell&&t.alive}).map(function(t){return {creature:t,check:Cb.checkTarget(s,c,a,t,opts)}});
};

function enemyAdjacent(s,c){
  return s.creatures.some(function(o){
    return o!==c&&o.alive&&!o.down&&o.cell&&Cb.isHostile(c,o)&&(!St()||St().canAct(o))&&Grid().chebyshev(c.cell,o.cell)<=1;
  });
}

/* {state, advantage:[source labels], disadvantage:[...], autoCrit, consume:[status ids the roll uses up]} */
Cb.attackRollState=function(s,c,a,t,tc){
  var adv=((a.rollState&&a.rollState.advantage)||[]).slice(),dis=((a.rollState&&a.rollState.disadvantage)||[]).slice();
  var mods=St()?St().attackMods(c,t,{distanceFt:tc.distanceFt}):{advantage:[],disadvantage:[],autoCrit:false,consume:[]};
  adv=adv.concat(mods.advantage);dis=dis.concat(mods.disadvantage);
  if(tc.band==='long')dis.push('Long range');
  /* a target in darkness the attacker cannot see through is unseen: Disadvantage (a Hidden attacker's Advantage is in Fable.status) */
  if(Fable.senses&&t&&t.cell&&c.cell&&Fable.senses.effectiveLight(s,c,t.cell)>=2)dis.push('Target in darkness');
  if((a.mode==='thrown'||a.mode==='ranged')&&enemyAdjacent(s,c))dis.push('Enemy within 5 ft');
  var rs=Fable.stats.rollState(adv,dis);
  rs.autoCrit=mods.autoCrit;rs.consume=mods.consume;
  return rs;
};

/* The chance to hit and to crit, as fractions. A natural 1 always misses and a natural 20 always hits, so the chance never
   leaves 5% to 95% (and 5% of a hit is always a crit). */
Cb.hitChance=function(bonus,ac,state){
  var need=Math.min(20,Math.max(2,ac-bonus)),p=(21-need)/20,crit=.05;
  if(state==='advantage'){p=1-(1-p)*(1-p);crit=1-.95*.95}
  else if(state==='disadvantage'){p=p*p;crit=.05*.05}
  return {hit:p,crit:crit,need:need};
};

function masteryText(m){
  if(!m)return null;
  var def=Fable.content&&Fable.content.weaponMasteries&&Fable.content.weaponMasteries.get(m.id);
  return def&&def.summary?def.summary:(def&&def.description)||'';
}

/* What the attack preview card shows (section 13.8). Always returns the numbers it can; ok says whether the attack can be made. */
Cb.previewAttack=function(s,c,a,t,opts){
  var st=Cb.attackState(s,c,a,opts),tc=Cb.checkTarget(s,c,a,t,opts);
  var out={ok:st.ok&&tc.ok,reason:st.ok?tc.reason:st.reason,cost:st.cost,
    attack:{id:a.id,name:a.name,mode:a.mode,item:a.item},target:{id:t.id,name:t.name},band:tc.band,distanceFt:tc.distanceFt,
    roll:null,damage:null,mastery:null,notes:[]};
  if(tc.distanceFt===null)return out;
  var rs=Cb.attackRollState(s,c,a,t,tc),ch=Cb.hitChance(a.bonus.value,Cb.targetAc(s,c,t,tc),rs.state);
  out.roll={bonus:a.bonus.value,bonusBreakdown:a.bonus.breakdown,state:rs.state,advantage:rs.advantage,disadvantage:rs.disadvantage,
    ac:Cb.targetAc(s,c,t,tc),acBreakdown:t.ac.breakdown,cover:tc.cover,need:ch.need,hit:ch.hit,crit:rs.autoCrit?ch.hit:ch.crit,autoCrit:rs.autoCrit};
  var expr=a.damage.expression;
  var n=Fable.dice.stats(expr),cr=Fable.dice.stats(expr,{crit:true});
  out.damage={expression:expr,type:a.damage.type,min:Math.max(0,n.min),max:n.max,average:n.average,critMin:Math.max(0,cr.min),critMax:cr.max,critAverage:cr.average,
    bonusBreakdown:a.damage.bonus&&a.damage.bonus.breakdown};
  if(a.mastery){
    out.mastery={id:a.mastery.id,name:a.mastery.name,text:masteryText(a.mastery),applies:!!a.mastery.usable,reason:a.mastery.reason||''};
  }
  var sav=(c.handlers||[]).some(function(h){return h.handler==='feat.savage-attacker'});
  var pool=c.resources&&c.resources['savage-attacker'];
  if(sav&&a.item&&(!pool||pool.current>0))out.notes.push('Savage Attacker: damage is rolled twice, the higher counts');
  return out;
};

/* ---------- rolling ---------- */
Cb.canReroll=function(s,c){
  return H().fire(s,c,'onRoll',{}).some(function(f){return f.result.reroll});
};

/* Rerolls the die a d20 roll kept (the higher with Advantage, the lower with Disadvantage) and works out the new total. */
function rerollKept(s,roll){
  var rolls=roll.rolls,idx=0;
  if(roll.mode==='advantage')idx=rolls[1]>rolls[0]?1:0;
  else if(roll.mode==='disadvantage')idx=rolls[1]<rolls[0]?1:0;
  var from=rolls[idx],to=Fable.dice.roll('1d20',s.rng).total;
  rolls[idx]=to;
  roll.natural=roll.mode==='advantage'?Math.max.apply(null,rolls):roll.mode==='disadvantage'?Math.min.apply(null,rolls):rolls[0];
  roll.total=roll.natural+roll.bonus;
  roll.rerolled={from:from,to:to,index:idx};
}
Cb.rerollKept=rerollKept;

Cb.beginAttack=function(s,c,attack,target,opts){
  opts=opts||{};
  var a=typeof attack==='string'?findAttack(c,attack):attack;
  var st=Cb.attackState(s,c,a,opts);
  if(!st.ok)return {ok:false,reason:st.reason};
  var tc=Cb.checkTarget(s,c,a,target,opts);
  if(!tc.ok)return {ok:false,reason:tc.reason};
  var e=c.economy;
  if(st.cost==='action'){e.action=true;e.attackAction=true;e.attacksUsed=0}
  else if(st.cost==='bonus')e.bonus=true;
  else if(st.cost==='reaction')e.reaction=true;
  if(a.mode==='light-extra')e.extraUsed=true;
  else if(!opts.reaction){
    e.attacksUsed++;
    if(isLight(a)&&(a.mode==='melee'||a.mode==='thrown'))e.lightAttack=true;
  }
  if(a.mode==='thrown'&&a.item)c.thrown[a.item]=(c.thrown[a.item]||0)+1;
  var rs=Cb.attackRollState(s,c,a,target,tc);
  var d=Fable.dice.d20(s.rng,{mode:rs.state,bonus:a.bonus.value});
  /* a Sapped creature's next attack roll is the one that uses it up, hit or miss */
  (rs.consume||[]).forEach(function(id){St().remove(s,c,id,'used')});
  var p={type:'attack',attacker:c.id,target:target.id,attackId:a.id,cost:st.cost,reaction:!!opts.reaction,silent:!!opts.silent,
    roll:{rolls:d.rolls.slice(),natural:d.natural,bonus:d.bonus,total:d.total,mode:d.mode,rerolled:null},
    state:{state:rs.state,advantage:rs.advantage,disadvantage:rs.disadvantage,autoCrit:rs.autoCrit},
    band:tc.band,distanceFt:tc.distanceFt,ac:Cb.targetAc(s,c,target,tc),cover:tc.cover?tc.cover.name:'none',canReroll:false};
  p.canReroll=!opts.noReroll&&c.alive&&Cb.canReroll(s,c);
  s.pending=p;
  return {ok:true,pending:p};
};

Cb.completeAttack=function(s,p,opts){
  opts=opts||{};
  if(!p||s.pending!==p)return {ok:false,reason:'There is no roll to finish'};
  var c=s.byId[p.attacker],t=s.byId[p.target],a=findAttack(c,p.attackId),G=Fable;
  if(opts.reroll&&p.canReroll){
    var pool=c.resources['heroic-inspiration'];
    Cr().setResource(c,'heroic-inspiration',pool.current-1);
    rerollKept(s,p.roll);
  }
  var nat=p.roll.natural,hit,crit=false;
  if(nat===1)hit=false;
  else if(nat===20){hit=true;crit=true}
  else hit=p.roll.total>=p.ac;
  if(hit&&p.state.autoCrit)crit=true;
  var result={ok:true,type:'attack',attacker:{id:c.id,name:c.name,team:c.team},target:{id:t.id,name:t.name,team:t.team},
    attack:{id:a.id,name:a.name,mode:a.mode,item:a.item,damageType:a.damage.type},cost:p.cost,reaction:p.reaction,
    roll:{rolls:p.roll.rolls.slice(),natural:nat,bonus:p.roll.bonus,total:p.roll.total,mode:p.roll.mode,
      advantage:p.state.advantage.slice(),disadvantage:p.state.disadvantage.slice(),rerolled:p.roll.rerolled,
      bonusBreakdown:a.bonus.breakdown},
    ac:p.ac,cover:p.cover,hit:hit,crit:crit,autoCrit:!!p.state.autoCrit,band:p.band,distanceFt:p.distanceFt,
    damage:null,effects:[],statuses:[]};
  if(hit){
    var expr=a.damage.expression;
    var first=Fable.dice.roll(expr,s.rng,{crit:crit}),used=first,second=null,savage=false;
    var fired=H().fire(s,c,'onDamageRoll',{attack:a,target:t,crit:crit,roll:first});
    if(fired.some(function(f){return f.result.rollTwice})){
      second=Fable.dice.roll(expr,s.rng,{crit:crit});savage=true;
      used=second.total>first.total?second:first;
    }
    var amount=Math.max(0,used.total);
    var applied=Cb.applyDamage(s,c,t,amount,{type:a.damage.type,crit:crit,attack:a});
    result.damage={expression:expr,type:a.damage.type,total:amount,crit:crit,terms:used.terms,first:first.total,second:second?second.total:null,
      savage:savage,applied:applied,bonusBreakdown:a.damage.bonus&&a.damage.bonus.breakdown};
    var m=a.mastery;
    if(m&&m.usable&&H().has(m.handler)&&t.alive&&!t.down&&(m.trigger==='hit'||(m.trigger==='hit-damage'&&applied.dealt>0))){
      var def=Fable.content&&Fable.content.weaponMasteries&&Fable.content.weaponMasteries.get(m.id);
      var res=H().run(m.handler,{state:s,attacker:c,target:t,attack:a,mastery:def||m,damageDealt:applied.dealt,hit:true,crit:crit});
      if(res&&res.used!==false){
        result.effects.push({id:m.id,name:m.name,text:res.text||''});
        (res.statuses||[]).forEach(function(x){
          var who=x.to==='target'?t:c,r=St().add(null,who,x.spec);
          result.statuses.push({creature:who.id,id:x.spec.id,change:r.added?'added':'refreshed',status:r.entry});
        });
      }
    }
  }
  s.pending=null;
  /* attacking gives the attacker away (the Hidden status is also used up as the roll's Advantage) */
  if(Fable.senses&&St()&&St().has(c,'hidden'))St().remove(s,c,'hidden','attacked');
  /* a thrown weapon ends up on the ground, at the target's square (Phase 8, plan 14.3) */
  if(a.mode==='thrown'&&a.item&&Cb.dropThrown)result.dropped=Cb.dropThrown(s,c,a,t.cell);
  if(!p.silent){
    Cb.emit(s,{type:'attack',id:c.id,result:result});
    Cb.followUps(s,result);
    Cb.checkOver(s);
  }
  return result;
};

/* The events that follow an attack result: the statuses it put on creatures, and anybody it dropped or killed. */
Cb.followUps=function(s,r){
  if(!r||r.type!=='attack')return;
  r.statuses.forEach(function(x){Cb.emit(s,{type:'status',change:x.change,id:x.creature,status:x.status})});
  var d=r.damage&&r.damage.applied;
  if(d&&d.downed)Cb.emit(s,{type:'down',id:r.target.id,defeated:!!d.defeated,by:r.attacker.id});
  if(d&&d.killed&&!d.defeated)Cb.emit(s,{type:'dead',id:r.target.id,by:r.attacker.id,instant:!!d.instant});
};

Cb.attack=function(s,c,attack,target,opts){
  opts=opts||{};
  var b=Cb.beginAttack(s,c,attack,target,opts);
  if(!b.ok)return b;
  var reroll=false;
  if(b.pending.canReroll&&typeof opts.reroll==='function')reroll=!!opts.reroll(b.pending);
  return Cb.completeAttack(s,b.pending,{reroll:reroll});
};

/* ---------- opportunity attacks ---------- */
/* The melee attack a creature would use for an Opportunity Attack, or null when it has none it can make: the main attack of a
   hero when it is a melee one, otherwise the one that deals the most on average. Does not look at where the target is. */
Cb.opportunityAttackFor=function(s,c){
  var best=null,main=c.sheet&&c.sheet.loadout&&c.sheet.loadout.mainAttack;
  (c.attacks||[]).forEach(function(a){
    if(a.mode!=='melee')return;
    if(!Cb.attackState(s,c,a,{reaction:true,ignoreActive:true}).ok)return;
    var key=(a.id===main?1000:0)+a.damage.stats.average;
    if(!best||key>best.key)best={a:a,key:key};
  });
  return best?best.a:null;
};
Cb.opportunityAttack=function(s,reactor,mover,opts){
  opts=opts||{};
  var a=Cb.opportunityAttackFor(s,reactor);
  if(!a)return {ok:false,reason:'No melee attack'};
  return Cb.attack(s,reactor,a.id,mover,{reaction:true,noReroll:true,silent:opts.silent});
};

/* ---------- damage and dying ---------- */
/* Applies damage to a creature. Returns {amount, type, hpBefore, hpAfter, absorbed (temporary hit points), dealt, downed, defeated,
   killed, instant, death}. dealt is the damage that was done, whether temporary hit points took it or not. */
Cb.applyDamage=function(s,source,t,amount,opts){
  opts=opts||{};
  amount=Math.max(0,amount|0);
  var out={amount:amount,type:opts.type||null,hpBefore:t.hp.current,tempBefore:t.hp.temp||0,absorbed:0,dealt:amount,hpAfter:t.hp.current,
    downed:false,defeated:false,killed:false,instant:false,death:null,deathFailures:0};
  if(amount<=0||!t.alive)return out;
  var left=amount;
  if(t.hp.temp>0&&!t.down){var ab=Math.min(t.hp.temp,left);t.hp.temp-=ab;left-=ab;out.absorbed=ab}
  var hero=t.kind==='hero';
  if(t.down){
    /* damage at 0 hit points: a failed death save (two for a Critical Hit), or death outright for the maximum or more */
    if(hero){
      if(left>=t.hp.max){kill(t,out,true)}
      else if(left>0){
        var f=opts.crit?2:1;
        t.death.stable=false;t.death.failures=Math.min(3,t.death.failures+f);out.deathFailures=f;
        if(t.death.failures>=3)kill(t,out,false);
      }
    }
    out.death=hero?snapshot(t):null;
    return out;
  }
  var before=t.hp.current,over=left-before;
  t.hp.current=Math.max(0,before-left);
  out.hpAfter=t.hp.current;
  if(t.hp.current===0){
    out.downed=true;
    if(hero){
      if(over>=t.hp.max)kill(t,out,true);
      else{
        t.down=true;t.death={successes:0,failures:0,stable:false,dead:false};
        t.conditions=[];
        St().add(null,t,{id:'unconscious',source:{name:'Dropped to 0 hit points'}});
      }
    }else{
      t.down=true;t.alive=false;t.conditions=[];
      out.defeated=true;out.killed=true;
    }
  }
  out.death=hero?snapshot(t):null;
  return out;
};
function snapshot(t){return {successes:t.death.successes,failures:t.death.failures,stable:t.death.stable,dead:t.death.dead}}
function kill(t,out,instant){
  t.down=true;t.alive=false;t.death.dead=true;t.death.stable=false;
  if(St()&&!St().has(t,'unconscious'))St().add(null,t,{id:'unconscious',source:{name:'Dead'}});
  out.killed=true;out.instant=!!instant;out.hpAfter=0;
}
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
