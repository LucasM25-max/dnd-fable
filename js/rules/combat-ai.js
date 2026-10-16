/* Enemy turns for Phase 5 (implementation plan, section 16 describes the full planner that arrives in Phase 8).
   Pure rules code. The rule is deliberately plain: pick the nearest hostile creature by walking distance, move as close
   as the movement budget allows (stopping once within reach), then end the turn. Attacks come with the Phase 6 resolver.

   Fable.combatAI.planTurn(s, c)   {target, destination, move (a planMove result) or null, note}: changes nothing
   Fable.combatAI.takeTurn(s, c)   plans and performs the move; returns the plan. Does not end the turn. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var AI=Fable.combatAI={};

function foes(s,c){
  return s.creatures.filter(function(o){return o.alive&&!o.down&&o.cell&&o.team!==c.team});
}

AI.planTurn=function(s,c){
  var Grid=Fable.grid,Cb=Fable.combat;
  var out={target:null,destination:null,move:null,note:''};
  var list=foes(s,c);
  if(!list.length){out.note='no targets';return out}

  /* nearest by walking steps over open terrain; ties by straight distance, then by order in the fight */
  var best=null;
  list.forEach(function(o){
    var field=Grid.distanceField(s.grid,o.cell);
    var d=field[c.cell.r*s.grid.cols+c.cell.c];
    var key=[d<0?1e9:d,Grid.chebyshev(c.cell,o.cell)];
    if(!best||key[0]<best.key[0]||(key[0]===best.key[0]&&key[1]<best.key[1]))best={o:o,key:key,field:field};
  });
  out.target=best.o;
  if(best.key[0]>=1e9){out.note='target unreachable';return out}

  if(Grid.inReach(c.cell,best.o.cell,c.reachFt)){out.note='already in reach';return out}

  var left=Fable.creature.movementLeftFt(c);
  var reach=Grid.reachable(s.grid,c.cell,left,{enter:function(col,row){
    var o=Cb.occupant(s,{c:col,r:row},c);
    return !o||o.team===c.team;
  }});
  var pick=null;
  reach.forEach(function(sq){
    if(sq.ft===0)return;
    if(Cb.occupant(s,sq,c))return;
    var d=best.field[sq.r*s.grid.cols+sq.c];
    if(d<0)return;
    /* closest to the target first; being within reach counts as arrived, so then the cheaper walk wins */
    var inReach=Grid.inReach(sq,best.o.cell,c.reachFt);
    var key=[inReach?0:d,sq.ft,sq.r,sq.c];
    if(!pick||cmp(key,pick.key)<0)pick={sq:sq,key:key};
  });
  if(!pick){out.note='no square to move to';return out}
  var plan=Cb.planMove(s,c,{c:pick.sq.c,r:pick.sq.r});
  if(!plan.ok){out.note=plan.reason;return out}
  out.destination={c:pick.sq.c,r:pick.sq.r};out.move=plan;out.note='advance on '+best.o.name;
  return out;
};
function cmp(a,b){for(var i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0}

AI.takeTurn=function(s,c){
  var plan=AI.planTurn(s,c);
  if(plan.move)Fable.combat.move(s,c,plan.destination);
  return plan;
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
