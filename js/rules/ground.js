/* Things on the ground: thrown weapons (implementation plan, sections 12 and 14.3; Phase 8). Pure rules code.

   Fable.combat.dropThrown(s, c, attack, cell)    a thrown weapon lands: hit or miss it ends on the target's square, or on the
                                                  nearest open square beside it while a creature stands there or it is solid
   Fable.combat.groundAt(s, cell)                 the items lying on that square
   Fable.combat.pickupState(s, c)                 {ok, reason, cost, items}: can c pick up what is on its square now
   Fable.combat.pickup(s, c)                      pick every item up from c's own square: a free object interaction, or the Action
                                                  when that was already used this turn. Emits a 'pickup' event
   Fable.combat.recoverThrown(s)                  when the fight is over every thrown weapon goes back to its owner
   An item on the ground is {id, item, name, owner, cell:{c,r}}. A picked up item stops counting as thrown for its owner. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var Cb=Fable.combat;
var St=function(){return Fable.status};
var Grid=function(){return Fable.grid};

function same(a,b){return a.c===b.c&&a.r===b.r}

Cb.groundAt=function(s,cell){
  return (s.ground||[]).filter(function(g){return same(g.cell,cell)});
};

Cb.dropThrown=function(s,c,a,cell){
  var G=Grid(),at={c:cell.c,r:cell.r};
  /* a weapon cannot lie under a creature or inside a tree: it ends on the nearest square that is open (first the target's own, then beside it) */
  function open(q){return !G.isBlocked(s.grid,q.c,q.r)&&!Cb.occupant(s,q,null)}
  if(!open(at)){
    var best=null;
    for(var rad=1;rad<=3&&!best;rad++){
      for(var dr=-rad;dr<=rad;dr++)for(var dc=-rad;dc<=rad;dc++){
        if(Math.max(Math.abs(dr),Math.abs(dc))!==rad)continue;
        var n={c:at.c+dc,r:at.r+dr};
        if(!open(n))continue;
        /* nearer to the thrower first, so the weapon lands on the side it can be reached from */
        var key=[G.chebyshev(n,c.cell),Math.abs(dr)+Math.abs(dc),n.r,n.c];
        if(!best||cmp(key,best.key)<0)best={n:n,key:key};
      }
    }
    if(best)at=best.n;
  }
  s.groundSeq=(s.groundSeq||0)+1;
  var item={id:'ground-'+s.groundSeq,item:a.item,name:a.name,owner:c.id,cell:at};
  s.ground.push(item);
  Cb.emit(s,{type:'drop',id:c.id,item:Object.assign({},item,{cell:{c:at.c,r:at.r}})});
  return item;
};
function cmp(a,b){for(var i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0}

Cb.pickupState=function(s,c){
  var D=Cb.DENIALS,out={ok:false,reason:'',cost:null,items:[]};
  function no(r){out.reason=r;return out}
  if(s.phase!=='running')return no(D.over);
  if(s.pending)return no(D.pending);
  if(!c.alive||c.down||!c.cell)return no('Cannot act');
  if(St()&&!St().canAct(c))return no(D.incapacitated);
  if(Cb.active(s)!==c)return no(D['not-active']);
  out.items=Cb.groundAt(s,c.cell).filter(function(g){return g.owner===c.id});
  if(!out.items.length)return no('Nothing of yours here');
  var e=c.economy;
  if(!e.object)out.cost='object';
  else if(!e.action)out.cost='action';
  else return no('No free hand: the object interaction and the Action are used');
  out.ok=true;
  return out;
};

Cb.pickup=function(s,c){
  var st=Cb.pickupState(s,c);
  if(!st.ok)return {ok:false,reason:st.reason};
  var e=c.economy;
  if(st.cost==='object')e.object=true;else e.action=true;
  var taken=[];
  st.items.forEach(function(g){
    var i=s.ground.indexOf(g);
    if(i>=0)s.ground.splice(i,1);
    c.thrown[g.item]=Math.max(0,(c.thrown[g.item]||0)-1);
    taken.push({id:g.id,item:g.item,name:g.name});
  });
  var res={ok:true,type:'pickup',creature:{id:c.id,name:c.name,team:c.team},cost:st.cost,items:taken};
  Cb.emit(s,{type:'pickup',id:c.id,result:res});
  return res;
};

Cb.recoverThrown=function(s){
  var back=[];
  (s.ground||[]).forEach(function(g){
    var o=s.byId[g.owner];
    if(o)o.thrown[g.item]=Math.max(0,(o.thrown[g.item]||0)-1);
    back.push(g.id);
  });
  s.ground=[];
  if(back.length)Cb.emit(s,{type:'recovered',ids:back});
  return back;
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
