/* Building blocks for map packages (js/content/maps/<id>/): the things every map does, so a map file is only the part that makes it itself.
   Units: 1 = 10 cm. A map's build(ctx) receives the batches from js/engine/world.js (ground, deco, solid, glow); the kit draws on them.
     K.noise(x,z)                  smooth value noise in 0..1, the same everywhere for the same point
     K.pick(r,list)                one of a list, chosen with the map's random function
     K.ground(ctx,fn,step)         tiles the whole square; fn(x,z,r) returns a colour, or null to leave the tile out
     K.scatter(ctx,o,fn)           calls fn(x,z) at up to o.count clear points at least o.spacing apart; o.pad keeps clear of spawns, o.where(x,z) filters
     K.border(ctx,o,fn)            calls fn(x,z,i) around the edge of the square, o.off units outside it, every o.step units
     K.blob(batch,x,y,z,rx,ry,rz,cell,col)   an ellipsoid of cubes (rocks, canopies, hills, coral); col(r,dy) picks each cube's colour
     K.cone(batch,x,y0,z,R,H,cell,col)       a stepped cone (pines, spires, tents); col(r,y)
     K.column(batch,x,y0,z,w,H,col)          a stacked pillar of 4-unit blocks
     K.wall(ctx,x,z,len,axis,H,thick,col)    a wall that blocks movement, built of staggered stones
     K.box(ctx,x,z,w,d,H,col,block)           a solid block of building (collides unless block===false)
   Nothing here knows a map; a map passes its own colours and shapes. */
(function(){
var K=Fable.mapKit={};
function h2(x,z){var s=Math.sin(x*127.1+z*311.7)*43758.5453;return s-Math.floor(s)}
K.noise=function(x,z){
  var xi=Math.floor(x),zi=Math.floor(z),xf=x-xi,zf=z-zi,u=xf*xf*(3-2*xf),v=zf*zf*(3-2*zf);
  var a=h2(xi,zi),b=h2(xi+1,zi),c=h2(xi,zi+1),d=h2(xi+1,zi+1);
  return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;
};
K.pick=function(r,a){return a[(r()*a.length)|0]};
K.ground=function(ctx,fn,step){
  step=step||3;var B=ctx.B,r=ctx.rnd;
  for(var x=-B.x-9;x<B.x+10;x+=step)for(var z=-B.z-9;z<B.z+10;z+=step){
    var c=fn(x,z,r);if(c!==null&&c!==undefined)ctx.ground.add(x,-1,z,step,1,step,c);
  }
};
K.scatter=function(ctx,o,fn){
  var r=ctx.rnd,B=ctx.B,placed=[],m=o.margin===undefined?10:o.margin,n=0;
  for(var t=0;t<(o.tries||o.count*40)&&n<o.count;t++){
    var x=(r()*2-1)*(B.x-m),z=(r()*2-1)*(B.z-m);
    if(!ctx.isClear(x,z,o.pad===undefined?4:o.pad))continue;
    if(o.where&&!o.where(x,z))continue;
    var ok=true;for(var i=0;i<placed.length;i++)if(Math.hypot(placed[i][0]-x,placed[i][1]-z)<(o.spacing||20)){ok=false;break}
    if(!ok)continue;
    placed.push([x,z]);n++;fn(x,z,n-1);
  }
  return placed;
};
K.border=function(ctx,o,fn){
  var B=ctx.B,r=ctx.rnd,w=B.x+o.off,d=B.z+o.off,per=4*(w+d),s=0,i=0;
  while(s<per){
    var u=s,x,z;
    if(u<2*w){x=-w+u;z=-d}else if(u<2*w+2*d){x=w;z=-d+(u-2*w)}else if(u<4*w+2*d){x=w-(u-2*w-2*d);z=d}else{x=-w;z=d-(u-4*w-2*d)}
    fn(x+(r()-.5)*(o.jitter||0),z+(r()-.5)*(o.jitter||0),i++);
    s+=o.step+r()*(o.vary||0);
  }
};
K.blob=function(b,x,y,z,rx,ry,rz,cell,col){
  for(var gx=-rx;gx<=rx;gx+=cell)for(var gy=-ry;gy<=ry;gy+=cell)for(var gz=-rz;gz<=rz;gz+=cell){
    var q=(gx*gx)/(rx*rx)+(gy*gy)/(ry*ry)+(gz*gz)/(rz*rz);
    if(q>1)continue;
    b.add(x+gx,y+gy-cell/2,z+gz,cell,cell,cell,col(Math.sqrt(q),gy/ry));
  }
};
K.cone=function(b,x,y0,z,R,H,cell,col){
  for(var y=0;y<H;y+=cell){
    var k=1-y/H,w=Math.max(cell,Math.round(R*2*k/cell)*cell);
    b.add(x,y0+y,z,w,cell,w,col(k,y));
  }
};
K.column=function(b,x,y0,z,w,H,col){for(var y=0;y<H;y+=4)b.add(x,y0+y,z,w,4,w,col(y))};
K.wall=function(ctx,x,z,len,axis,H,thick,col){
  var X=axis==='x',r=ctx.rnd,n=Math.ceil(len/6);
  for(var i=0;i<n;i++){
    var o=-len/2+(i+.5)*len/n;
    for(var y=0;y<H;y+=4)ctx.solid.add(X?x+o+((y/4)%2?1.5:0):x,y,X?z:z+o+((y/4)%2?1.5:0),X?len/n+.4:thick,4,X?thick:len/n+.4,col(r));
  }
  ctx.addCollider(x,z,X?len:thick,X?thick:len,H);
};
K.box=function(ctx,x,z,w,d,H,col,block){
  var r=ctx.rnd;
  for(var y=0;y<H;y+=4)ctx.solid.add(x,y,z,w,Math.min(4,H-y),d,col(r,y));
  if(block!==false)ctx.addCollider(x,z,w,d,H);
};
})();
