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
  [[-44,36,1.3],[-66,14,1],[-25,-26,.8],[72,48,1.2],[86,-2,.9],[32,52,.6],[-10,-50,.8],[14,-40,.5],[-56,-52,1.1],[60,-6,.7]].forEach(function(a){if(ctx.isClear(a[0],a[1],2))rock(a[0],a[1],a[2])});
  for(var t=0,n=0;t<300&&n<16;t++){var x=(r()*2-1)*(ctx.B.x-6),z=(r()*2-1)*(ctx.B.z-6);if(ctx.isClear(x,z,2)){rock(x,z,.22+r()*.12);n++}}
  [[-30,40,26,'x'],[-48,-6,22,'z'],[-34,-44,28,'x'],[64,30,20,'z'],[30,28,16,'x']].forEach(function(a){if(ctx.isClear(a[0],a[1],2))log(a[0],a[1],a[2],a[3])});
  log(46,-45,22,'x');log(34,-34,16,'z');log(58,-34,16,'z');   // seats around the campfire
  log(-24,-10,24,'x');log(-24,-15,24,'x');log(-24,-12.5,22,'x',4.6);  // small log pile
  [[-20,50],[-52,-30],[-56,32],[40,40]].forEach(function(a){if(ctx.isClear(a[0],a[1],2))stump(a[0],a[1])});
};
})();
