/* Placeholder combat animation (implementation plan, section 15; Phase 6). The rules decide what happens; the director only
   plays it on the models, so every attack reads on screen: a wind-up and lunge for the attacker, a recoil for a hit, a
   sidestep for a miss, and a fall for a creature that drops. It is additive: after the walkers have posed the models each frame,
   the director adds its offsets to the root and to the arm joints, so it never fights the walk cycle and leaves nothing behind.

   var d = Fable.createDirector()
   d.attack(entry, targetEntry, {hit, onImpact}, done)   wind up, lunge, call onImpact at the blow, return, call done
   d.hurt(entry, fromEntry)    recoil from the attacker
   d.dodge(entry, fromEntry)   sidestep
   d.setDown(entry, down)      fall (or get back up); stays that way
   d.cheer(entry)              a short raise of the arm (healing)
   d.update(dt)                every frame, after the walkers
   d.busy()                    something is playing */
(function(){
function ease(t){t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)}
function reduced(){return Fable.hudSettings?Fable.hudSettings.reducedMotion():false}
Fable.createDirector=function(){
  var fx=new Map(),tweens=[];
  function st(e){
    var s=fx.get(e);
    if(!s){s={ox:0,oz:0,oy:0,arm:0,lean:0,fall:0,fallTo:0,squash:0};fx.set(e,s)}
    return s;
  }
  function tween(dur,fn,done){tweens.push({t:0,dur:Math.max(.001,dur),fn:fn,done:done||null})}
  function dirTo(a,b){
    var ax=a.root.position.x,az=a.root.position.z,dx=b.root.position.x-ax,dz=b.root.position.z-az,d=Math.hypot(dx,dz)||1;
    return {x:dx/d,z:dz/d,d:d};
  }
  var api={
    attack:function(e,t,o,done){
      var s=st(e),d=dirTo(e,t),lunge=Math.min(6,Math.max(0,d.d-9));
      if(reduced()){if(o.onImpact)o.onImpact();if(done)done();return}
      tween(.2,function(p){var k=ease(p);s.arm=-1.7*k;s.lean=-.12*k},function(){
        tween(.11,function(p){var k=ease(p);s.arm=-1.7+3.3*k;s.ox=d.x*lunge*k;s.oz=d.z*lunge*k;s.lean=-.12+.4*k},function(){
          if(o.onImpact)o.onImpact();
          tween(.28,function(p){var k=ease(p);s.arm=1.6*(1-k);s.ox=d.x*lunge*(1-k);s.oz=d.z*lunge*(1-k);s.lean=.28*(1-k)},function(){s.arm=s.ox=s.oz=s.lean=0;if(done)done()});
        });
      });
    },
    hurt:function(e,from){
      var s=st(e),d=from?dirTo(from,e):{x:0,z:1};
      if(reduced())return;
      tween(.3,function(p){var k=Math.sin(Math.min(1,p)*Math.PI);s.ox=d.x*4*k;s.oz=d.z*4*k;s.squash=.14*k},function(){s.ox=s.oz=s.squash=0});
    },
    dodge:function(e,from){
      var s=st(e),d=from?dirTo(from,e):{x:0,z:1};
      if(reduced())return;
      tween(.34,function(p){var k=Math.sin(Math.min(1,p)*Math.PI);s.ox=-d.z*5*k;s.oz=d.x*5*k},function(){s.ox=s.oz=0});
    },
    setDown:function(e,down){
      var s=st(e);s.fallTo=down?1:0;
      if(reduced()){s.fall=s.fallTo;return}
    },
    cheer:function(e){
      var s=st(e);
      if(reduced())return;
      tween(.5,function(p){var k=Math.sin(Math.min(1,p)*Math.PI);s.arm=-2.2*k;s.oy=1.2*k},function(){s.arm=0;s.oy=0});
    },
    busy:function(){return tweens.length>0},
    update:function(dt){
      for(var i=tweens.length-1;i>=0;i--){
        var tw=tweens[i];tw.t+=dt;
        var p=tw.t/tw.dur;
        tw.fn(Math.min(1,p));
        if(p>=1){tweens.splice(i,1);if(tw.done)tw.done()}
      }
      fx.forEach(function(s,e){
        s.fall+=(s.fallTo-s.fall)*Math.min(1,dt*9);
        if(Math.abs(s.fallTo-s.fall)<.002)s.fall=s.fallTo;
        var r=e.root;r.rotation.order='YXZ';var J=(e.rig&&e.rig.joints)||{};
        r.position.x+=s.ox;r.position.z+=s.oz;r.position.y+=s.oy-s.fall*1.6;
        r.rotation.x=-s.fall*Math.PI/2*.98+s.lean*(1-s.fall);
        r.scale.y=1-s.squash;
        if(J.armR)J.armR.rotation.x+=s.arm;
        if(J.armL&&s.arm<0)J.armL.rotation.x+=s.arm*.4;
      });
    }
  };
  return api;
};
})();
