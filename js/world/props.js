/* Rocks, boulders, fallen logs and stumps lying around the clearing and the woods. */
(function(){
Fable.buildProps=function(ctx){
  var r=ctx.rnd,S=ctx.solid,greys=[0x7b756c,0x6a645c,0x8a8378,0x5d5851],bark=[0x5a3d22,0x4e3320,0x654529];
  function rock(x,z,s){
    var w=14*s,h=5*s,y=0;
    [[w,h,w*.9],[w*.74,h*.9,w*.66],[w*.46,h*.8,w*.4]].forEach(function(L,i){
      S.add(x+(r()-.5)*s*2,y,z+(r()-.5)*s*2,L[0],L[1],L[2],i===2&&r()<.5?0x5f7a4a:greys[(r()*4)|0]);y+=L[1]});
    ctx.addCollider(x,z,w*.9,w*.8,h*1.9);
  }
  function log(x,z,len,ax,y0){
    y0=y0||0;var X=ax==='x',c=bark[(r()*3)|0];
    S.add(x,y0,z,X?len:3,4.6,X?3:len,c);S.add(x,y0+.8,z,X?len:4.6,3,X?4.6:len,c);
    [-1,1].forEach(function(s){var o=s*(len/2+.1);S.add(X?x+o:x,y0+.6,X?z:z+o,X?.2:3.4,3.4,X?3.4:.2,0xb89860)});
    S.add(x+(X?r()*len/2-len/4:2.6),y0+1.6,z+(X?2.6:r()*len/2-len/4),1.4,1.4,3,c);
    ctx.addCollider(x,z,X?len:4.6,X?4.6:len,y0+4.6);
  }
  function stump(x,z){S.add(x,0,z,5.6,4,5.6,bark[0]);S.add(x,4,z,4.6,.4,4.6,0xb89860);ctx.addCollider(x,z,5.6,5.6,4.4)}
  var ox=ctx.outpost.x,oz=ctx.outpost.z,placed=[];
  function spot(m){for(var t=0;t<60;t++){var x=(r()*2-1)*(ctx.B.x-10),z=(r()*2-1)*(ctx.B.z-10);
    if(ctx.isClear(x,z,3)&&placed.every(function(p){return Math.hypot(p[0]-x,p[1]-z)>=m})){placed.push([x,z]);return [x,z]}}return null}
  // big boulders, spread out
  for(var i=0;i<22;i++){var p=spot(44);if(p)rock(p[0],p[1],.5+r()*.9)}
  // small rocks
  for(i=0;i<90;i++){var q=spot(9);if(q)rock(q[0],q[1],.22+r()*.12)}
  // fallen logs
  for(i=0;i<20;i++){var l=spot(24);if(l&&Fable.woodIn(l[0],l[1])>-30)log(l[0],l[1],16+((r()*4)|0)*4,r()<.5?'x':'z')}
  // stumps
  for(i=0;i<40;i++){var s2=spot(14);if(s2&&Fable.woodIn(s2[0],s2[1])>-20)stump(s2[0],s2[1])}
  // seats around the outpost campfire
  log(46+ox,-45+oz,22,'x');log(34+ox,-34+oz,16,'z');log(58+ox,-34+oz,16,'z');
  // small log pile beside the path
  log(-28,70,24,'x');log(-28,65,24,'x');log(-28,67.5,22,'x',4.6);
};
})();
