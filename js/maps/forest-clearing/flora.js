/* Oaks, pines, bushes: the wooded section, a few lone trees and a tree line around the edge. */
(function(){
var FC=Fable.forestClearing;
FC.buildFlora=function(ctx){
  var r=ctx.rnd,S=ctx.solid,B=ctx.B;
  var bark=[0x5a3d22,0x4e3320,0x654529],leaf=[0x3f7a34,0x4c8c3c,0x2f6a2c,0x5a9a44],pine=[0x2a5a34,0x23502d,0x31683b];
  function pick(a){return a[(r()*a.length)|0]}
  function trunk(x,z,w,H,flare){for(var y=0;y<H;y+=4){var ww=(y<4&&flare)?w+2:w;S.add(x,y,z,ww,4,ww,pick(bark))}}
  function oak(x,z,solid,extra){
    var H=48+((r()*5)|0)*4+(extra||0);trunk(x,z,5,H,true);
    S.add(x+5,H-14,z,5,3,3,pick(bark));S.add(x-5,H-22,z+1,5,3,3,pick(bark));
    var cy=H+8,seen={};
    [[0,0,0,18],[12,-6,6,12],[-12,-6,-6,12],[0,-6,12,12],[-6,-6,-12,12]].forEach(function(bl){
      var R=bl[3];
      for(var gx=-R;gx<=R;gx+=6)for(var gy=-R;gy<=R;gy+=6)for(var gz=-R;gz<=R;gz+=6){
        if(gx*gx+gy*gy+gz*gz>R*R*(.8+r()*.3))continue;
        var px=bl[0]+gx,py=bl[1]+gy,pz=bl[2]+gz,key=px+','+py+','+pz;if(seen[key])continue;seen[key]=1;
        S.add(x+px,cy+py-3,z+pz,6,6,6,gy>R*.4?leaf[3]:gy<-R*.3?leaf[2]:leaf[(r()*2)|0]);
      }
    });
    if(solid)ctx.addCollider(x,z,5,5,H);
  }
  function conifer(x,z,solid,extra){
    var H=64+((r()*4)|0)*4+(extra||0);trunk(x,z,4,H,false);
    for(var y=12;y<H+4;y+=6){var w=Math.max(6,Math.round(34*(1-(y-12)/(H-6))/2)*2),c=pick(pine);
      S.add(x,y,z,w,6,w*.62,c);S.add(x,y+.3,z,w*.62,6,w,c)}
    if(solid)ctx.addCollider(x,z,4,4,H);
  }
  function bush(x,z){var c=pick(leaf),c2=pick(leaf);
    S.add(x,0,z,7,5,7,c);S.add(x+4,0,z+2,5,4,5,c2);S.add(x-3,3,z-1,5,4,5,c);
    if(r()<.25)S.add(x+1,5,z+3.6,1,1,1,0xc0392b);
    ctx.addCollider(x,z,6,6,5);
  }
  var placed=[];
  function tree(x,z,type,solid,extra){placed.push([x,z]);(type==='oak'?oak:conifer)(x,z,solid,extra)}
  function far(x,z,m){return placed.every(function(p){return Math.hypot(p[0]-x,p[1]-z)>=m})}
  // the woods: a ragged band around the edge of the square, with the middle left as open grass
  for(var t=0,n=0;t<20000&&n<210;t++){
    var x=(r()*2-1)*(B.x-6),z=(r()*2-1)*(B.z-6);
    if(FC.woodIn(x,z)<0||!ctx.isClear(x,z,4)||!far(x,z,20))continue;
    tree(x,z,r()<.5?'oak':'pine',true);n++;
  }
  // tree line: dense ring just outside the playable area, a taller sparse ring behind it
  function ring(off,step,types,extra){
    var w=B.x+off,d=B.z+off,per=2*(w+d)*2,s=0;
    while(s<per){var u=s%per,x,z;
      if(u<2*w){x=-w+u;z=-d}else if(u<2*w+2*d){x=w;z=-d+(u-2*w)}else if(u<4*w+2*d){x=w-(u-2*w-2*d);z=d}else{x=-w;z=d-(u-4*w-2*d)}
      tree(x+(r()-.5)*5,z+(r()-.5)*5,types[(r()*types.length)|0],false,extra);s+=step+r()*3;}
  }
  ring(9,16,['pine','pine','oak'],0);ring(30,24,['pine'],14);
  // undergrowth
  for(t=0,n=0;t<3000&&n<80;t++){var bx=(r()*2-1)*(B.x-6),bz=(r()*2-1)*(B.z-6);if(FC.woodIn(bx,bz)>-14&&ctx.isClear(bx,bz,3)){bush(bx,bz);n++}}
  for(var q=-B.x;q<B.x;q+=9+r()*3){S.add(q,0,-B.z-4,8,5,7,pick(leaf));S.add(q,0,B.z+4,8,5,7,pick(leaf))}
  for(q=-B.z;q<B.z;q+=9+r()*3){S.add(-B.x-4,0,q,7,5,8,pick(leaf));S.add(B.x+4,0,q,7,5,8,pick(leaf))}
};
})();
