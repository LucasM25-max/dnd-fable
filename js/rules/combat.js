/* Turn based combat core (implementation plan, sections 12 and 13; Phase 5). Pure rules code: no DOM, no Three.js, so the
   Node tests, a Web Worker and the browser all run exactly the same fight.

   A fight is a plain state object, changed only through these functions, each of which returns what happened:

     var s = Fable.combat.create({grid, seed, creatures:[...]})   creatures from Fable.creature
     Fable.combat.place(s, c, {c, r}, facing)                     put a creature on a square
     Fable.combat.start(s)                                        roll initiative (d20 + bonus, each creature on its own),
                                                                  sort, begin round 1 with the first creature
     Fable.combat.active(s)                                       whose turn it is
     Fable.combat.planMove(s, c, cell)                            what a move would do, or why it is denied; changes nothing
     Fable.combat.move(s, c, cell)                                walks the planned path and spends movement
     Fable.combat.reachable(s, c)                                 every square it can still reach this turn, with the cost
     Fable.combat.dash(s, c)                                      spends the Action to add the speed to the movement budget
     Fable.combat.interact(s, c)                                  one free object interaction per turn, then Utilize (an Action)
     Fable.combat.endTurn(s)                                      next creature; a new round after the last one
     Fable.combat.on(s, fn)                                       fn(event) for start, turnstart, turnend, round, move, dash, interact, over

   Movement: a creature walks through squares its allies stand in, never through an enemy, and never ends in an occupied
   square. A square costs 5 ft, 10 ft when it is difficult terrain, and a diagonal step costs 5 ft (the plan's rule), with no
   cutting corners (handled by the grid). The budget is the speed, plus the speed again for each Dash. Attacks, damage and
   Opportunity Attacks are resolved by the Phase 6 rules; nothing here rolls anything but initiative. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var Cb=Fable.combat={};
var Grid=function(){return Fable.grid};
var Cr=function(){return Fable.creature};

var DENIALS={
  'not-active':'Not your turn',
  'no-movement':'No movement left',
  'blocked':'Blocked terrain',
  'occupied':'Occupied',
  'no-path':'No path',
  'too-far':'Too far',
  'same':'Already here',
  'down':'Cannot move',
  'over':'The fight is over'
};
Cb.DENIALS=DENIALS;

function emit(s,e){
  e.round=s.round;
  s.log.push(e);
  s.listeners.slice().forEach(function(fn){fn(e)});
  return e;
}

Cb.create=function(opts){
  opts=opts||{};
  if(!opts.grid)throw new Error('Combat: create needs a grid');
  var s={
    grid:opts.grid,creatures:[],byId:{},order:[],turn:-1,round:0,phase:'setup',winner:null,
    rng:Fable.rng(typeof opts.seed==='number'?opts.seed:Fable.rng.hash(String(opts.seed||'combat'))),
    log:[],listeners:[],initiativeRolls:[]
  };
  (opts.creatures||[]).forEach(function(c){Cb.add(s,c)});
  return s;
};

Cb.add=function(s,c){
  if(s.byId[c.id])throw new Error('Combat: two creatures share the id "'+c.id+'"');
  s.creatures.push(c);s.byId[c.id]=c;
  return c;
};
Cb.on=function(s,fn){s.listeners.push(fn);return function(){s.listeners=s.listeners.filter(function(f){return f!==fn})}};
Cb.get=function(s,id){return s.byId[id]||null};

/* ---------- squares ---------- */
Cb.occupant=function(s,cell,ignore){
  if(!cell)return null;
  for(var i=0;i<s.creatures.length;i++){
    var c=s.creatures[i];
    if(c===ignore||!c.cell||!c.alive)continue;
    if(c.cell.c===cell.c&&c.cell.r===cell.r)return c;
  }
  return null;
};
Cb.place=function(s,c,cell,facing){
  var g=s.grid;
  if(!Grid().inBounds(g,cell.c,cell.r)||Grid().isBlocked(g,cell.c,cell.r))throw new Error('Combat: '+c.name+' cannot be placed on blocked square ('+cell.c+', '+cell.r+')');
  var o=Cb.occupant(s,cell,c);
  if(o)throw new Error('Combat: '+c.name+' cannot be placed on '+o.name+"'s square");
  c.cell={c:cell.c,r:cell.r};
  if(typeof facing==='number')c.facing=facing;
  return c;
};
Cb.isHostile=function(a,b){return a.team!==b.team};

/* ---------- initiative and turns ---------- */
Cb.active=function(s){return s.phase==='running'&&s.turn>=0?s.byId[s.order[s.turn]]:null};

function rollInitiative(s,c,index){
  var rs=c.initiative.rollState||{state:'normal'};
  var r=Fable.dice.d20(s.rng,{mode:rs.state||'normal',bonus:c.initiative.value});
  return {id:c.id,index:index,natural:r.natural,rolls:r.rolls,mode:r.mode,bonus:c.initiative.value,total:r.total};
}

/* Highest total first. Ties go to the higher modifier, then to the player side, then to the order the creatures were added. */
function compare(a,b,s){
  if(b.total!==a.total)return b.total-a.total;
  if(b.bonus!==a.bonus)return b.bonus-a.bonus;
  var ta=s.byId[a.id].team==='player'?0:1,tb=s.byId[b.id].team==='player'?0:1;
  if(ta!==tb)return ta-tb;
  return a.index-b.index;
}

Cb.start=function(s){
  if(s.phase!=='setup')throw new Error('Combat: start can only be called once');
  s.creatures.forEach(function(c){
    if(!c.cell)throw new Error('Combat: '+c.name+' has not been placed');
  });
  var rolls=s.creatures.map(function(c,i){return rollInitiative(s,c,i)});
  rolls.sort(function(a,b){return compare(a,b,s)});
  s.initiativeRolls=rolls;
  s.order=rolls.map(function(r){return r.id});
  s.phase='running';s.round=1;s.turn=-1;
  emit(s,{type:'start',order:s.order.slice(),rolls:rolls.map(function(r){return Object.assign({},r)})});
  beginTurn(s,0);
  return s;
};

function livingTeams(s){
  var t={};
  s.creatures.forEach(function(c){if(c.alive&&!c.down)t[c.team]=1});
  return Object.keys(t);
}
function checkOver(s){
  var teams=livingTeams(s);
  if(teams.length<=1){
    s.phase='over';s.winner=teams[0]||null;s.turn=-1;
    emit(s,{type:'over',winner:s.winner});
    return true;
  }
  return false;
}

function beginTurn(s,index){
  s.turn=index;
  var c=s.byId[s.order[index]];
  c.economy=Cr().newEconomy(c);
  emit(s,{type:'turnstart',id:c.id,index:index});
}

Cb.endTurn=function(s){
  if(s.phase!=='running')return {ok:false,reason:DENIALS.over};
  var cur=Cb.active(s);
  emit(s,{type:'turnend',id:cur.id,index:s.turn});
  if(checkOver(s))return {ok:true,over:true};
  var n=s.order.length,i=s.turn,wrapped=false;
  for(var guard=0;guard<=n;guard++){
    i++;
    if(i>=n){i=0;wrapped=true}
    var c=s.byId[s.order[i]];
    if(c.alive&&!c.down)break;
  }
  if(wrapped){s.round++;emit(s,{type:'round',round:s.round})}
  beginTurn(s,i);
  return {ok:true,id:s.order[i],round:s.round};
};

/* ---------- movement ---------- */
function enterRule(s,c){
  return function(col,row){
    var o=Cb.occupant(s,{c:col,r:row},c);
    return !o||!Cb.isHostile(c,o);
  };
}

/* What moving the creature to a square would do. Never changes the state.
   {ok, reason, code, path, costFt, leftFt (movement left before), afterFt (after the move), squares}
   When the destination is too far, costFt is still the real cost of the cheapest path, so the preview can say "40 ft". */
Cb.planMove=function(s,c,cell,opts){
  opts=opts||{};
  var g=s.grid,out={ok:false,code:'',reason:'',path:[],costFt:0,leftFt:0,afterFt:0,squares:0};
  function deny(code){out.code=code;out.reason=DENIALS[code];return out}
  if(s.phase!=='running')return deny('over');
  if(!opts.ignoreTurn&&Cb.active(s)!==c)return deny('not-active');
  if(c.down||!c.alive)return deny('down');
  out.leftFt=Cr().movementLeftFt(c);
  if(!cell||!Grid().inBounds(g,cell.c,cell.r)||Grid().isBlocked(g,cell.c,cell.r))return deny('blocked');
  if(Grid().same(c.cell,cell))return deny('same');
  if(Cb.occupant(s,cell,c))return deny('occupied');
  var res=Grid().findPath(g,c.cell,cell,{enter:enterRule(s,c)});
  if(!res.found)return deny('no-path');
  out.path=res.path;out.costFt=res.cost;out.squares=res.squares;
  if(out.leftFt<=0)return deny('no-movement');
  if(res.cost>out.leftFt)return deny('too-far');
  out.ok=true;out.afterFt=out.leftFt-res.cost;
  return out;
};

/* Every square the creature can still walk to this turn, [{c, r, ft}], excluding its own square and occupied squares. */
Cb.reachable=function(s,c){
  if(s.phase!=='running'||c.down||!c.alive||!c.cell)return [];
  var left=Cr().movementLeftFt(c);
  if(left<=0)return [];
  return Grid().reachable(s.grid,c.cell,left,{enter:enterRule(s,c)}).filter(function(q){
    return q.ft>0&&!Cb.occupant(s,q,c);
  });
};

Cb.move=function(s,c,cell){
  var plan=Cb.planMove(s,c,cell);
  if(!plan.ok)return plan;
  var from={c:c.cell.c,r:c.cell.r};
  c.cell={c:cell.c,r:cell.r};
  c.economy.movedFt+=plan.costFt;
  if(plan.path.length>1){
    var a=plan.path[plan.path.length-2],b=plan.path[plan.path.length-1];
    var p=Grid().center(s.grid,a.c,a.r),q=Grid().center(s.grid,b.c,b.r);
    c.facing=Math.atan2(q.x-p.x,q.z-p.z);
  }
  emit(s,{type:'move',id:c.id,from:from,to:{c:cell.c,r:cell.r},path:plan.path,costFt:plan.costFt,leftFt:Cr().movementLeftFt(c)});
  return plan;
};

/* ---------- action economy ---------- */
function mine(s,c){return s.phase==='running'&&Cb.active(s)===c}

Cb.dash=function(s,c){
  if(!mine(s,c))return {ok:false,reason:DENIALS['not-active']};
  if(c.economy.action)return {ok:false,reason:'Action already used'};
  c.economy.action=true;c.economy.dashes++;
  emit(s,{type:'dash',id:c.id,movementFt:Cr().movementMaxFt(c)});
  return {ok:true,movementFt:Cr().movementMaxFt(c)};
};

/* One free object interaction per turn (draw or stow a weapon, open a door). Anything beyond that is the Utilize action,
   which is how a shield is doffed and donned. */
Cb.interact=function(s,c){
  if(!mine(s,c))return {ok:false,reason:DENIALS['not-active']};
  if(!c.economy.object){c.economy.object=true;emit(s,{type:'interact',id:c.id,cost:'free'});return {ok:true,cost:'free'}}
  if(!c.economy.action){c.economy.action=true;emit(s,{type:'interact',id:c.id,cost:'action'});return {ok:true,cost:'action'}}
  return {ok:false,reason:'No free interaction or Action left'};
};
Cb.canInteract=function(s,c){
  if(!mine(s,c))return {ok:false,cost:null};
  if(!c.economy.object)return {ok:true,cost:'free'};
  if(!c.economy.action)return {ok:true,cost:'action'};
  return {ok:false,cost:null};
};

/* A one line state for tests and logs. */
Cb.summary=function(s){
  return {round:s.round,phase:s.phase,active:(Cb.active(s)||{}).id||null,order:s.order.slice()};
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
