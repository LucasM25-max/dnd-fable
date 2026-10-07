/* Player controller: camera-relative movement, jump, simple box collisions and the walk animation. */
(function(){
Fable.createPlayer=function(world,fg){
  var F=fg.root,R=3.4,STEP=3.2,GRAV=200,JUMP=62,WALK=30,RUN=54;
  var cs=world.colliders,bx=world.B.x-R,bz=world.B.z-R;
  var P={x:world.spawn.x,y:0,z:world.spawn.z,vy:0,face:world.spawn.facing,k:0,phase:0,ground:true,moving:false};
  function blocked(x,z,y){for(var i=0;i<cs.length;i++){var c=cs[i];if(c.top>y+STEP&&x+R>c.x0&&x-R<c.x1&&z+R>c.z0&&z-R<c.z1)return true}return false}
  function floorAt(x,z,y){var h=0,r=R*.7;for(var i=0;i<cs.length;i++){var c=cs[i];if(c.top>h&&c.top<=y+STEP+.01&&x+r>c.x0&&x-r<c.x1&&z+r>c.z0&&z-r<c.z1)h=c.top}return h}
  P.update=function(dt,inp,t){
    var k=inp.keys,yaw=inp.cam.yaw;
    var f=(k.KeyW||k.ArrowUp?1:0)-(k.KeyS||k.ArrowDown?1:0),s=(k.KeyD||k.ArrowRight?1:0)-(k.KeyA||k.ArrowLeft?1:0);
    var dx=-Math.sin(yaw)*f+Math.cos(yaw)*s,dz=-Math.cos(yaw)*f-Math.sin(yaw)*s,len=Math.hypot(dx,dz),run=!!(k.ShiftLeft||k.ShiftRight);
    P.moving=len>0;
    if(P.moving){
      dx/=len;dz/=len;var sp=run?RUN:WALK,nx=P.x+dx*sp*dt,nz=P.z+dz*sp*dt;
      if(!blocked(nx,P.z,P.y))P.x=nx;if(!blocked(P.x,nz,P.y))P.z=nz;
      var d=Math.atan2(Math.sin(Math.atan2(dx,dz)-P.face),Math.cos(Math.atan2(dx,dz)-P.face));P.face+=d*Math.min(1,dt*14);
      P.phase+=dt*(run?13:9.5);
    }
    P.x=Math.max(-bx,Math.min(bx,P.x));P.z=Math.max(-bz,Math.min(bz,P.z));
    if(k.Space&&P.ground){P.vy=JUMP;P.ground=false}
    P.vy-=GRAV*dt;P.y+=P.vy*dt;
    var fl=floorAt(P.x,P.z,P.y);
    if(P.y<=fl&&P.vy<=0){P.y=fl;P.vy=0;P.ground=true}else if(P.y>fl+.05)P.ground=false;
    P.k+=((P.moving?(run?1:.7):0)-P.k)*Math.min(1,dt*10);
    var w=Math.sin(P.phase)*P.k,air=P.ground?0:1;
    fg.LL.rotation.x=air?-.6:w*.8;fg.LR.rotation.x=air?.35:-w*.8;
    fg.AL.rotation.x=-.3+(air?-.5:w*.5);fg.AR.rotation.x=-.9-(air?.1:w*.2);
    fg.C.rotation.x=.1+P.k*.3+air*.2+Math.sin(t*1.3)*.05;
    fg.H.rotation.y=0;fg.H.rotation.x=0;
    F.position.set(P.x,P.y+Math.abs(Math.sin(P.phase))*.4*P.k,P.z);F.rotation.y=P.face;
  };
  return P;
};
})();
