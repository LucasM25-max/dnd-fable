/* The combat grid (implementation plan, sections 12, 13.7 and Phase 5). Pure: no DOM, no Three.js, so combat, the enemy AI
   (later in a Web Worker) and the Node tests share it.

   One square is 5 ft. The world scale is 1 unit = 10 cm, so a square is 15.24 units (5 ft = 1.524 m). A grid is plain data:
     {cols, rows, cell, x0, z0, blocked:Uint8Array, cost:Uint8Array}
   x0 and z0 are the world coordinates of the grid's top left corner, and square (c, r) covers x0 + c * cell ... x0 + (c + 1) * cell
   in x (and the same in z). `blocked` is 1 where terrain stops movement (a wall, a tree trunk, a boulder). `cost` is what
   it costs to enter a square in squares: 1 for normal ground, 2 for difficult terrain (10 ft). Creatures never change
   either array; they only decide who may stop where (see combat.js).

   Movement rules implemented here (SRD 5.2.1, "Playing the Game", movement):
     - Diagonal steps cost 5 ft, the same as orthogonal ones, so the distance between squares is the larger of the column
       and row difference times 5 ft.
     - A diagonal step cannot cut the corner of a blocked square: both squares beside the step must be open.
     - Difficult terrain costs an extra 5 ft per square.
   Paths are the cheapest in feet; among equal cost paths the one nearest the straight line wins, so a move looks like a
   line and not a staircase.

   Cover (Phase 8, SRD 5.2.1 "Cover"): Fable.grid.coverBetween(g, a, b) works out how much of a target square an attacker's
   square can reach, with the usual corner method: take the best corner of the attacker's square and trace lines to the four
   corners of the target's square; a line that passes through a blocked square (a tree, a boulder, a wall) is covered. One or
   two covered lines is Half Cover (+2 AC), three is Three-Quarters Cover (+5 AC), four is Total Cover (no line at all, so it
   cannot be targeted and cannot be seen). Squares next to each other never have cover.
   Light (Phase 8): an optional layer, 0 bright, 1 dim, 2 dark. Squares are bright unless setLight says otherwise.
   Change terrain with setBlocked once cover has been asked for: it clears the cover cache. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var Grid=Fable.grid={};

Grid.FEET_PER_CELL=5;
Grid.CELL=15.24;
Grid.UNITS_PER_FOOT=Grid.CELL/Grid.FEET_PER_CELL;
/* How high an obstacle must be (world units) to block a square. This is the step height creatures can climb. */
Grid.BLOCK_HEIGHT=3.2;

Grid.feetToUnits=function(ft){return ft*Grid.UNITS_PER_FOOT};
Grid.unitsToFeet=function(u){return u/Grid.UNITS_PER_FOOT};

function isInt(n){return typeof n==='number'&&isFinite(n)&&Math.floor(n)===n}

/* ---------- construction ---------- */

Grid.create=function(opts){
  opts=opts||{};
  var cols=opts.cols,rows=opts.rows,cell=opts.cell===undefined?Grid.CELL:opts.cell;
  if(!isInt(cols)||cols<1||!isInt(rows)||rows<1)throw new Error('Grid: cols and rows must be whole numbers of 1 or more');
  if(typeof cell!=='number'||!isFinite(cell)||cell<=0)throw new Error('Grid: cell must be a positive number of world units');
  var g={
    cols:cols,rows:rows,cell:cell,
    x0:opts.x0===undefined?-cols*cell/2:opts.x0,
    z0:opts.z0===undefined?-rows*cell/2:opts.z0,
    blocked:new Uint8Array(cols*rows),
    cost:new Uint8Array(cols*rows)
  };
  g.cost.fill(1);
  return g;
};

/* A grid over a map's playable square (bounds are the half extents) with squares blocked wherever a collider taller than
   opts.blockHeight overlaps them. Colliders are {x0, x1, z0, z1, top} as the world builder records them. The grid is centred
   on the map origin, so the middle square is centred on (0, 0). */
Grid.fromMap=function(bounds,colliders,opts){
  opts=opts||{};
  if(!bounds||typeof bounds.x!=='number'||typeof bounds.z!=='number'||bounds.x<=0||bounds.z<=0)throw new Error('Grid: fromMap needs bounds {x, z} (half extents above 0)');
  var cell=opts.cell===undefined?Grid.CELL:opts.cell,height=opts.blockHeight===undefined?Grid.BLOCK_HEIGHT:opts.blockHeight;
  var g=Grid.create({cols:Math.floor(bounds.x*2/cell),rows:Math.floor(bounds.z*2/cell),cell:cell});
  (colliders||[]).forEach(function(k){
    if(!(k.top>height))return;
    var c0=Math.max(0,Math.floor((k.x0-g.x0)/cell)),c1=Math.min(g.cols-1,Math.ceil((k.x1-g.x0)/cell)-1);
    var r0=Math.max(0,Math.floor((k.z0-g.z0)/cell)),r1=Math.min(g.rows-1,Math.ceil((k.z1-g.z0)/cell)-1);
    for(var r=r0;r<=r1;r++)for(var c=c0;c<=c1;c++)g.blocked[r*g.cols+c]=1;
  });
  return g;
};

/* ---------- squares ---------- */

Grid.inBounds=function(g,c,r){return c>=0&&r>=0&&c<g.cols&&r<g.rows&&isInt(c)&&isInt(r)};
Grid.index=function(g,c,r){return r*g.cols+c};
/* Outside the grid counts as blocked. */
Grid.isBlocked=function(g,c,r){return !Grid.inBounds(g,c,r)||g.blocked[r*g.cols+c]===1};
Grid.setBlocked=function(g,c,r,v){
  if(!Grid.inBounds(g,c,r))throw new Error('Grid: square ('+c+', '+r+') is outside the grid');
  g.blocked[r*g.cols+c]=v?1:0;
  g.coverCache=null;g.blockSat=null;
};
/* Cost to enter a square, in squares (1 normal, 2 difficult terrain). */
Grid.stepCost=function(g,c,r){return Grid.inBounds(g,c,r)?g.cost[r*g.cols+c]:0};
Grid.setCost=function(g,c,r,cost){
  if(!Grid.inBounds(g,c,r))throw new Error('Grid: square ('+c+', '+r+') is outside the grid');
  if(!isInt(cost)||cost<1||cost>4)throw new Error('Grid: a square costs 1 to 4 squares to enter, got '+cost);
  g.cost[r*g.cols+c]=cost;
};
/* World position of the middle of a square. */
Grid.center=function(g,c,r){return {x:g.x0+(c+.5)*g.cell,z:g.z0+(r+.5)*g.cell}};
/* The square that holds a world position, or null outside the grid. */
Grid.cellAt=function(g,x,z){
  var c=Math.floor((x-g.x0)/g.cell),r=Math.floor((z-g.z0)/g.cell);
  return Grid.inBounds(g,c,r)?{c:c,r:r}:null;
};
Grid.same=function(a,b){return !!a&&!!b&&a.c===b.c&&a.r===b.r};

/* ---------- distance ---------- */

/* Squares between two squares when diagonals cost the same as straight steps. */
Grid.chebyshev=function(a,b){return Math.max(Math.abs(a.c-b.c),Math.abs(a.r-b.r))};
Grid.distanceFt=function(a,b){return Grid.chebyshev(a,b)*Grid.FEET_PER_CELL};
/* Is b within reach (feet) of a? Reach ignores walls: it is about what a creature can touch, not where it can walk. */
Grid.inReach=function(a,b,reachFt){return Grid.distanceFt(a,b)<=reachFt};

/* The squares a straight line from the middle of one square to the middle of another passes through, in order, without the two
   end squares. Used for line of sight: a ranged attack is blocked when any of them is solid ground (a tree, a wall). */
Grid.lineCells=function(g,a,b){
  var p=Grid.center(g,a.c,a.r),q=Grid.center(g,b.c,b.r),out=[],seen={};
  var dist=Math.hypot(q.x-p.x,q.z-p.z),n=Math.max(1,Math.ceil(dist/(g.cell/8)));
  for(var i=1;i<n;i++){
    var t=i/n,cell=Grid.cellAt(g,p.x+(q.x-p.x)*t,p.z+(q.z-p.z)*t);
    if(!cell||Grid.same(cell,a)||Grid.same(cell,b))continue;
    var k=cell.r*g.cols+cell.c;
    if(seen[k])continue;
    seen[k]=1;out.push(cell);
  }
  return out;
};
/* True when no solid square lies between the two squares. Neighbouring squares are always clear. */
Grid.lineClear=function(g,a,b){
  if(Grid.chebyshev(a,b)<=1)return true;
  return !Grid.lineCells(g,a,b).some(function(c){return Grid.isBlocked(g,c.c,c.r)});
};

/* ---------- cover ---------- */

Grid.COVER={none:0,half:1,threeQuarters:2,total:3};
Grid.COVER_NAMES=['none','half','three-quarters','total'];
/* The Armor Class bonus Half and Three-Quarters Cover give (Total Cover cannot be targeted at all). */
Grid.COVER_BONUS=[0,2,5,0];
var CORNER=.42;

/* Does the straight line between two world points pass through a blocked square other than the two end squares? */
function lineBlocked(g,x0,z0,x1,z1,a,b){
  var dist=Math.hypot(x1-x0,z1-z0),n=Math.max(2,Math.ceil(dist/(g.cell/6)));
  for(var i=1;i<n;i++){
    var t=i/n,cell=Grid.cellAt(g,x0+(x1-x0)*t,z0+(z1-z0)*t);
    if(!cell||Grid.same(cell,a)||Grid.same(cell,b))continue;
    if(g.blocked[cell.r*g.cols+cell.c]===1)return true;
  }
  return false;
}

var NO_COVER={level:0,name:'none',blocked:0,bonus:0};
/* A summed area table of the blocked squares (built when first needed, dropped when a square changes): is anything solid in the box around
   two squares, one square wider on every side? When nothing is, nothing can give cover and the sixty four line traces are skipped. */
function anyBlockedNear(g,a,b){
  var sat=g.blockSat;
  if(!sat){
    var w=g.cols+1,h=g.rows+1;
    sat=g.blockSat=new Int32Array(w*h);
    for(var r=0;r<g.rows;r++)for(var c=0;c<g.cols;c++)
      sat[(r+1)*w+c+1]=g.blocked[r*g.cols+c]+sat[r*w+c+1]+sat[(r+1)*w+c]-sat[r*w+c];
  }
  var W=g.cols+1,c0=Math.max(0,Math.min(a.c,b.c)-1),c1=Math.min(g.cols-1,Math.max(a.c,b.c)+1),r0=Math.max(0,Math.min(a.r,b.r)-1),r1=Math.min(g.rows-1,Math.max(a.r,b.r)+1);
  return sat[(r1+1)*W+c1+1]-sat[r0*W+c1+1]-sat[(r1+1)*W+c0]+sat[r0*W+c0]>0;
}

/* {level: 0 none, 1 half, 2 three-quarters, 3 total, name, blocked (covered lines of the best corner, 0 to 4), bonus (AC)}. The
   level a creature gets against an attacker standing on square `a` when it stands on square `b`. Cached per grid. */
var COVER_BY_BEST=[0,1,2,3,4].map(function(best){
  var level=best===0?0:best<=2?1:best===3?2:3;
  return Object.freeze({level:level,name:Grid.COVER_NAMES[level],blocked:best,bonus:Grid.COVER_BONUS[level]});
});
Grid.coverBetween=function(g,a,b){
  if(!a||!b||Grid.chebyshev(a,b)<=1)return NO_COVER;
  if(!anyBlockedNear(g,a,b))return NO_COVER;
  var cells=g.cols*g.rows,key=(a.r*g.cols+a.c)*cells+(b.r*g.cols+b.c),cache=g.coverCache,hit;
  if(!cache)cache=g.coverCache=cells<=4096?{big:false,t:new Uint8Array(cells*cells)}:{big:true,t:new Map()};
  hit=cache.big?cache.t.get(key):cache.t[key];
  if(hit)return COVER_BY_BEST[hit-1];
  var pa=Grid.center(g,a.c,a.r),pb=Grid.center(g,b.c,b.r),e=g.cell*CORNER,best=4;
  for(var i=0;i<4&&best>0;i++){
    var ax=pa.x+(i&1?e:-e),az=pa.z+(i&2?e:-e),n=0;
    for(var j=0;j<4;j++){
      var bx=pb.x+(j&1?e:-e),bz=pb.z+(j&2?e:-e);
      if(lineBlocked(g,ax,az,bx,bz,a,b))n++;
    }
    if(n<best)best=n;
  }
  if(cache.big)cache.t.set(key,best+1);else cache.t[key]=best+1;
  return COVER_BY_BEST[best];
};

/* ---------- light ---------- */

Grid.LIGHT={bright:0,dim:1,dark:2};
Grid.setLight=function(g,c,r,level){
  if(!Grid.inBounds(g,c,r))throw new Error('Grid: square ('+c+', '+r+') is outside the grid');
  if(!isInt(level)||level<0||level>2)throw new Error('Grid: light is 0 (bright), 1 (dim) or 2 (dark), got '+level);
  if(!g.light)g.light=new Uint8Array(g.cols*g.rows);
  g.light[r*g.cols+c]=level;
};
Grid.lightAt=function(g,c,r){return g.light&&Grid.inBounds(g,c,r)?g.light[r*g.cols+c]:0};

/* ---------- search ---------- */

var STEPS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
var KEY_SCALE=1000000;

function Heap(){this.k=[];this.v=[]}
Heap.prototype.push=function(key,val){
  var k=this.k,v=this.v,i=k.length;
  k.push(key);v.push(val);
  while(i>0){
    var p=(i-1)>>1;
    if(k[p]<=k[i])break;
    var tk=k[p],tv=v[p];k[p]=k[i];v[p]=v[i];k[i]=tk;v[i]=tv;i=p;
  }
};
Heap.prototype.pop=function(){
  var k=this.k,v=this.v,top={key:k[0],val:v[0]},lk=k.pop(),lv=v.pop(),n=k.length;
  if(n){
    k[0]=lk;v[0]=lv;
    var i=0;
    for(;;){
      var l=i*2+1,r=l+1,m=i;
      if(l<n&&k[l]<k[m])m=l;
      if(r<n&&k[r]<k[m])m=r;
      if(m===i)break;
      var tk=k[m],tv=v[m];k[m]=k[i];v[m]=v[i];k[i]=tk;v[i]=tv;i=m;
    }
  }
  return top;
};
Heap.prototype.size=function(){return this.k.length};

/* Cheapest routes from one square. Options:
     enter(c, r)   false stops a creature entering the square (an enemy standing there); terrain is always checked first
     maxCost       do not go beyond this many squares of cost
     target        stop as soon as this square is settled
     line          {from, to}: among equal cost routes prefer the one closest to this straight line
   Returns {prim, prev}: prim is the cost in squares to each square (-1 when not reached), prev the square before it. */
function search(g,from,opts){
  opts=opts||{};
  var n=g.cols*g.rows,prim=new Int32Array(n).fill(-1),prev=new Int32Array(n).fill(-1),key=new Float64Array(n).fill(Infinity);
  var done=new Uint8Array(n),heap=new Heap(),enter=opts.enter,maxCost=opts.maxCost,target=opts.target,line=opts.line;
  var lx=0,lz=0,llen=0;
  if(line){lx=line.to.c-line.from.c;lz=line.to.r-line.from.r;llen=Math.sqrt(lx*lx+lz*lz)}
  function deviation(c,r){
    if(!llen)return 0;
    var cross=(c-line.from.c)*lz-(r-line.from.r)*lx,d=cross/llen;
    return d*d;
  }
  var s=from.r*g.cols+from.c;
  prim[s]=0;key[s]=0;heap.push(0,s);
  var tIdx=target?target.r*g.cols+target.c:-1;
  while(heap.size()){
    var top=heap.pop(),i=top.val;
    if(done[i])continue;
    done[i]=1;
    if(i===tIdx)break;
    var c=i%g.cols,r=(i-c)/g.cols;
    for(var k=0;k<STEPS.length;k++){
      var dc=STEPS[k][0],dr=STEPS[k][1],nc=c+dc,nr=r+dr;
      if(Grid.isBlocked(g,nc,nr))continue;
      if(dc!==0&&dr!==0&&(Grid.isBlocked(g,c+dc,r)||Grid.isBlocked(g,c,r+dr)))continue;
      if(enter&&!enter(nc,nr))continue;
      var ni=nr*g.cols+nc;
      if(done[ni])continue;
      var step=g.cost[ni],np=prim[i]+step;
      if(maxCost!==undefined&&np>maxCost)continue;
      var nk=key[i]+step*KEY_SCALE+deviation(nc,nr);
      if(nk<key[ni]){key[ni]=nk;prim[ni]=np;prev[ni]=i;heap.push(nk,ni)}
    }
  }
  return {prim:prim,prev:prev};
}

/* The cheapest path between two squares: {found, path:[{c,r}, ... from ... to], cost (feet), squares (cost in squares)}.
   path includes both ends. Unknown or blocked squares, or a destination enter() refuses, give {found:false}. */
Grid.findPath=function(g,from,to,opts){
  opts=opts||{};
  var none={found:false,path:[],cost:0,squares:0};
  if(!from||!to||!Grid.inBounds(g,from.c,from.r)||!Grid.inBounds(g,to.c,to.r))return none;
  if(Grid.same(from,to))return {found:true,path:[{c:from.c,r:from.r}],cost:0,squares:0};
  if(Grid.isBlocked(g,to.c,to.r))return none;
  if(opts.enter&&!opts.enter(to.c,to.r))return none;
  var res=search(g,from,{enter:opts.enter,target:to,maxCost:opts.maxCost,line:{from:from,to:to}});
  var ti=to.r*g.cols+to.c;
  if(res.prim[ti]<0)return none;
  var path=[],i=ti;
  while(i>=0){path.push({c:i%g.cols,r:Math.floor(i/g.cols)});i=res.prev[i]}
  path.reverse();
  return {found:true,path:path,cost:res.prim[ti]*Grid.FEET_PER_CELL,squares:res.prim[ti]};
};

/* Every square reachable within maxFeet, as [{c, r, ft}] including the start (ft 0). enter() works as in findPath. */
Grid.reachable=function(g,from,maxFeet,opts){
  opts=opts||{};
  if(!from||!Grid.inBounds(g,from.c,from.r)||!(maxFeet>=0))return [];
  var res=search(g,from,{enter:opts.enter,maxCost:Math.floor(maxFeet/Grid.FEET_PER_CELL)}),out=[];
  for(var i=0;i<res.prim.length;i++)if(res.prim[i]>=0)out.push({c:i%g.cols,r:Math.floor(i/g.cols),ft:res.prim[i]*Grid.FEET_PER_CELL});
  return out;
};

/* Steps (not feet) from a square to every other square over open terrain, ignoring creatures and difficult terrain;
   -1 where unreachable. The enemy AI uses it to see how far it still is from a target. */
Grid.distanceField=function(g,from){
  var n=g.cols*g.rows,dist=new Int32Array(n).fill(-1);
  if(!from||!Grid.inBounds(g,from.c,from.r))return dist;
  var queue=[from.r*g.cols+from.c],head=0;
  dist[queue[0]]=0;
  while(head<queue.length){
    var i=queue[head++],c=i%g.cols,r=(i-c)/g.cols;
    for(var k=0;k<STEPS.length;k++){
      var dc=STEPS[k][0],dr=STEPS[k][1],nc=c+dc,nr=r+dr;
      if(Grid.isBlocked(g,nc,nr))continue;
      if(dc!==0&&dr!==0&&(Grid.isBlocked(g,c+dc,r)||Grid.isBlocked(g,c,r+dr)))continue;
      var ni=nr*g.cols+nc;
      if(dist[ni]>=0)continue;
      dist[ni]=dist[i]+1;queue.push(ni);
    }
  }
  return dist;
};

/* The open square nearest to a wanted one (by straight distance, then by position) that taken(c, r) does not refuse, or null.
   Used to place creatures whose spawn point landed on a tree or on each other. */
Grid.nearestFree=function(g,cell,taken){
  var max=Math.max(g.cols,g.rows);
  for(var radius=0;radius<=max;radius++){
    var best=null,bestD=Infinity;
    for(var dr=-radius;dr<=radius;dr++)for(var dc=-radius;dc<=radius;dc++){
      if(Math.max(Math.abs(dc),Math.abs(dr))!==radius)continue;
      var c=cell.c+dc,r=cell.r+dr;
      if(Grid.isBlocked(g,c,r)||(taken&&taken(c,r)))continue;
      var d=dc*dc+dr*dr;
      if(d<bestD){bestD=d;best={c:c,r:r}}
    }
    if(best)return best;
  }
  return null;
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
