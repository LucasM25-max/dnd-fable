/* Camera direction (implementation plan, section 15.6). Pure maths, no Three.js: the game scene gives it the camera it would use
   anyway (a target point, yaw, pitch and distance) and gets back the camera it should use, so the player's own orbit and zoom stay
   the base and the cinematic moves are layered on top and fade away.

   Fable.camera.frame(points, view, safe)   the focus point and distance that keep every point inside the safe rectangle of the
                                            screen. view = {yaw, pitch, dist, fov (radians), aspect, minDist, maxDist, target};
                                            safe = {top, bottom, left, right} as fractions of the screen kept clear for the HUD.
   Fable.camera.project(point, view)        {x, y, depth} in normalised device coordinates, to check framing
   var cd = Fable.camera.createDirector({rng, reduced})
     cd.shot({focus, dist, yaw, pitch, fov, spin, in, hold, out, tag, abs, force, sticky})   a move: eases in, holds, eases out (hold:Infinity until released)
                          dist, yaw and pitch are changes to the player's own camera (dist a multiple); abs:{yaw, pitch, dist} instead aims the camera
                          exactly there while the shot is in (the victory and defeat shots frame the hero low and close that way). fov widens the lens
                          (radians) while it is in. force: start even when the player has just moved the camera. sticky: the player moving the camera
                          afterwards does not cancel it (the shot of the end of the fight stays until it is released).
     cd.release(tag)      start easing out the shots with this tag      cd.cancel()    the player took the camera back
     cd.shake(amp, dur)   cd.punch(fovRadians, dur)
     cd.update(dt)        real time seconds
     cd.modify(view)      -> the camera to use {target:{x,y,z}, yaw, pitch, dist}
     cd.offset()          -> {x, y, z} shake to add to the final position and look point     cd.fovAdd()  -> radians
     cd.viewShift()       -> the fraction of the screen width the picture is slid sideways (a shot's shiftX), so the subject sits off centre
     cd.active()          a cinematic move is running */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable,E=Fable.ease;

function basis(view){
  var cp=Math.cos(view.pitch),t=view.target;
  var pos={x:t.x+Math.sin(view.yaw)*cp*view.dist,y:Math.max(3,t.y+Math.sin(view.pitch)*view.dist),z:t.z+Math.cos(view.yaw)*cp*view.dist};
  var f={x:t.x-pos.x,y:t.y-pos.y,z:t.z-pos.z},fl=Math.hypot(f.x,f.y,f.z)||1;f.x/=fl;f.y/=fl;f.z/=fl;
  /* right = forward x up(0,1,0) */
  var r={x:-f.z,y:0,z:f.x},rl=Math.hypot(r.x,r.z)||1;r.x/=rl;r.z/=rl;
  /* up = right x forward */
  var u={x:r.y*f.z-r.z*f.y,y:r.z*f.x-r.x*f.z,z:r.x*f.y-r.y*f.x};
  return {pos:pos,f:f,r:r,u:u};
}
function project(p,view){
  var b=basis(view),v={x:p.x-b.pos.x,y:p.y-b.pos.y,z:p.z-b.pos.z};
  var depth=v.x*b.f.x+v.y*b.f.y+v.z*b.f.z;
  if(depth<=.01)return {x:0,y:0,depth:depth,behind:true};
  var th=Math.tan(view.fov/2);
  return {x:(v.x*b.r.x+v.y*b.r.y+v.z*b.r.z)/depth/(th*view.aspect),y:(v.x*b.u.x+v.y*b.u.y+v.z*b.u.z)/depth/th,depth:depth,behind:false};
}

/* ---------- framing ---------- */
function frame(points,view,safe){
  safe=safe||{top:.16,bottom:.28,left:.06,right:.06};
  var minD=view.minDist||40,maxD=view.maxDist||260;
  var n=points.length||1,cx=0,cy=0,cz=0;
  points.forEach(function(p){cx+=p.x;cy+=p.y===undefined?6:p.y;cz+=p.z});
  cx/=n;cy/=n;cz/=n;
  /* the free rectangle in NDC: x in [xl, xr], y in [yb, yt]; the HUD owns the rest of the screen */
  var xl=-1+2*safe.left,xr=1-2*safe.right,yb=-1+2*safe.bottom,yt=1-2*safe.top,midY=(yb+yt)/2;
  function viewAt(focus,dist){return {yaw:view.yaw,pitch:view.pitch,dist:dist,fov:view.fov,aspect:view.aspect,target:focus}}
  function fits(focus,dist){
    var v=viewAt(focus,dist);
    for(var i=0;i<points.length;i++){
      var p=points[i],q=project({x:p.x,y:p.y===undefined?6:p.y,z:p.z},v);
      if(q.behind||q.x<xl||q.x>xr||q.y<yb||q.y>yt)return false;
    }
    return true;
  }
  /* the smallest distance at which everything fits (a closer shot reads better), within the allowed zoom range */
  function search(focus){
    if(!fits(focus,maxD))return maxD;
    if(fits(focus,minD))return minD;
    var lo=minD,hi=maxD;
    for(var i=0;i<24;i++){var mid=(lo+hi)/2;if(fits(focus,mid))hi=mid;else lo=mid}
    return hi;
  }
  /* The bottom bars are taller than the top ones, so the middle of the free area is above the middle of the screen. Moving the
     look point along the ground, away from the camera, moves the pair down the screen (and toward it moves it up). */
  var fwdX=-Math.sin(view.yaw),fwdZ=-Math.cos(view.yaw),focus={x:cx,y:cy,z:cz},dist=search(focus);
  for(var pass=0;pass<4;pass++){
    var c=project({x:cx,y:cy,z:cz},viewAt(focus,dist));
    var worldPerNdc=dist*Math.tan(view.fov/2)/Math.max(.25,Math.sin(view.pitch));
    var d=(c.y-midY)*worldPerNdc;
    focus={x:focus.x+fwdX*d,y:cy,z:focus.z+fwdZ*d};
    dist=search(focus);
  }
  return {focus:focus,dist:dist,fits:fits(focus,dist)};
}

/* ---------- the director ---------- */
function createDirector(o){
  o=o||{};
  var rnd=o.rng||Math.random,reduced=o.reduced||function(){return false};
  var shots=[],shakes=[],punches=[],userGrace=0,seed=[rnd()*6.28,rnd()*6.28,rnd()*6.28,rnd()*6.28];
  function envelope(s){
    if(s.t<s.in)return E.get('outCubic')(s.in>0?s.t/s.in:1);
    if(s.t<s.in+s.hold)return 1;
    var q=(s.t-s.in-s.hold)/(s.out||.0001);
    return 1-E.get('inOutQuad')(Math.min(1,q));
  }
  var api={
    shot:function(spec){
      if(userGrace>0&&!spec.force)return null;
      var calm=reduced();
      /* reduced motion keeps the framing of an action but drops the sweeping moves */
      var s={t:0,in:spec.in===undefined?.3:spec.in,hold:spec.hold===undefined?.5:spec.hold,out:spec.out===undefined?.5:spec.out,
        focus:spec.focus||null,dist:calm?1:(spec.dist===undefined?1:spec.dist),yaw:calm?0:(spec.yaw||0),pitch:calm?0:(spec.pitch||0),
        spin:calm?0:(spec.spin||0),fov:calm?0:(spec.fov||0),shiftX:spec.shiftX||0,tag:spec.tag||null,focusW:spec.focusW===undefined?1:spec.focusW,dead:false,
        abs:spec.abs?{yaw:spec.abs.yaw,pitch:spec.abs.pitch,dist:spec.abs.dist}:null,sticky:!!spec.sticky};
      if(calm&&s.in<.25)s.in=.25;
      shots.push(s);
      return s;
    },
    release:function(tag){
      shots.forEach(function(s){
        if(tag!==undefined&&tag!==null&&s.tag!==tag)return;
        if(s.t<s.in+s.hold){s.hold=Math.max(0,s.t-s.in)}
      });
    },
    /* the player moved the camera: every move eases out at once and none start for a moment */
    cancel:function(){
      shots.forEach(function(s){if(s.sticky)return;s.hold=0;s.in=0;s.out=.25;s.t=Math.max(s.t,0)});
      userGrace=1.6;
    },
    userActive:function(){return userGrace>0},
    shake:function(amp,dur){
      if(reduced()||userGrace>0&&false)return;
      shakes.push({amp:amp,dur:Math.max(.05,dur||.2),t:0});
    },
    punch:function(fov,dur){if(reduced())return;punches.push({fov:fov,dur:Math.max(.05,dur||.3),t:0})},
    update:function(dt){
      userGrace=Math.max(0,userGrace-dt);
      for(var i=shots.length-1;i>=0;i--){
        var s=shots[i];s.t+=dt;
        if(s.hold!==Infinity&&s.t>=s.in+s.hold+s.out)shots.splice(i,1);
      }
      for(var j=shakes.length-1;j>=0;j--){shakes[j].t+=dt;if(shakes[j].t>=shakes[j].dur)shakes.splice(j,1)}
      for(var k=punches.length-1;k>=0;k--){punches[k].t+=dt;if(punches[k].t>=punches[k].dur)punches.splice(k,1)}
      api.clock=(api.clock||0)+dt;
    },
    modify:function(view){
      var out={target:{x:view.target.x,y:view.target.y,z:view.target.z},yaw:view.yaw,pitch:view.pitch,dist:view.dist};
      shots.forEach(function(s){
        var w=envelope(s);if(w<=0)return;
        if(s.abs){
          /* aim exactly: the angle takes the short way round */
          var dy=Math.atan2(Math.sin(s.abs.yaw-out.yaw),Math.cos(s.abs.yaw-out.yaw));
          out.yaw+=dy*w+s.spin*s.t*w;
          out.pitch+=(s.abs.pitch-out.pitch)*w;
          out.dist+=(s.abs.dist-out.dist)*w;
        }else{
          out.dist*=1+(s.dist-1)*w;
          out.yaw+=(s.yaw+s.spin*s.t)*w;
          out.pitch+=s.pitch*w;
        }
        if(s.focus){
          var f=w*s.focusW;
          out.target.x+=(s.focus.x-out.target.x)*f;
          out.target.z+=(s.focus.z-out.target.z)*f;
          if(s.focus.y!==undefined)out.target.y+=(s.focus.y-out.target.y)*f;
        }
      });
      out.pitch=E.clamp(out.pitch,.1,1.4);
      return out;
    },
    offset:function(){
      var x=0,y=0,z=0,c=api.clock||0;
      shakes.forEach(function(s){
        var k=1-s.t/s.dur,a=s.amp*k*k;
        x+=a*(Math.sin(c*61+seed[0])+.5*Math.sin(c*113+seed[1]));
        y+=a*(Math.sin(c*67+seed[2])+.5*Math.sin(c*131+seed[3]))*.7;
        z+=a*Math.sin(c*53+seed[1])*.6;
      });
      return {x:x,y:y,z:z};
    },
    fovAdd:function(){
      var v=0;
      punches.forEach(function(p){var k=p.t/p.dur;v+=p.fov*(k<.15?k/.15:Math.pow(1-(k-.15)/.85,2))});
      shots.forEach(function(s){if(s.fov)v+=s.fov*Math.max(0,envelope(s))});
      return v;
    },
    /* positive slides the subject to the left of the screen. It is framing, not motion, so reduced motion keeps it. */
    viewShift:function(){
      var v=0;
      shots.forEach(function(s){if(s.shiftX)v+=s.shiftX*Math.max(0,envelope(s))});
      return v;
    },
    active:function(){return shots.length>0},
    shotCount:function(){return shots.length},
    clear:function(){shots.length=shakes.length=punches.length=0}
  };
  return api;
}

Fable.camera={frame:frame,project:project,basis:basis,createDirector:createDirector};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
