/* Easing curves and keyframe sampling (implementation plan, section 15.3). Pure: no DOM and no Three.js, so animation clips,
   the camera director and the Node tests all share one definition.

   Fable.ease.get(name)                an easing function t -> t (0 to 1), 'inOutSine' when the name is unknown
   Fable.ease.has(name), names()
   Fable.ease.sample(keys, t, name)    value of a track at time t. keys is [[time, value, easeName?], ...] in time order; the
                                       easing of a segment is the one named on the key it ends at, or `name`. Before the first key
                                       the first value holds, after the last key the last value holds.
   Fable.ease.lerp(a, b, k), clamp(v, lo, hi), damp(current, target, rate, dt)   small helpers shared by the animator and camera */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;

var PI=Math.PI,C1=1.70158,C3=C1+1,C4=(2*PI)/3;
var E={
  linear:function(t){return t},
  step:function(t){return t>=1?1:0},
  inQuad:function(t){return t*t},
  outQuad:function(t){return 1-(1-t)*(1-t)},
  inOutQuad:function(t){return t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2},
  inCubic:function(t){return t*t*t},
  outCubic:function(t){return 1-Math.pow(1-t,3)},
  inOutCubic:function(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2},
  inQuart:function(t){return t*t*t*t},
  outQuart:function(t){return 1-Math.pow(1-t,4)},
  inOutSine:function(t){return -(Math.cos(PI*t)-1)/2},
  outSine:function(t){return Math.sin(t*PI/2)},
  inSine:function(t){return 1-Math.cos(t*PI/2)},
  inBack:function(t){return C3*t*t*t-C1*t*t},
  outBack:function(t){return 1+C3*Math.pow(t-1,3)+C1*Math.pow(t-1,2)},
  outElastic:function(t){return t===0?0:t===1?1:Math.pow(2,-10*t)*Math.sin((t*10-.75)*C4)+1},
  outBounce:function(t){
    var n=7.5625,d=2.75;
    if(t<1/d)return n*t*t;
    if(t<2/d)return n*(t-=1.5/d)*t+.75;
    if(t<2.5/d)return n*(t-=2.25/d)*t+.9375;
    return n*(t-=2.625/d)*t+.984375;
  }
};
var DEFAULT='inOutSine';

function clamp(v,lo,hi){return v<lo?lo:v>hi?hi:v}
function lerp(a,b,k){return a+(b-a)*k}
/* frame rate independent smoothing toward a target: rate is "per second", about how fast the gap closes */
function damp(cur,target,rate,dt){return cur+(target-cur)*(1-Math.exp(-rate*dt))}

function get(name){return E[name]||E[DEFAULT]}

function sample(keys,t,name){
  var n=keys.length;
  if(!n)return 0;
  if(n===1||t<=keys[0][0])return keys[0][1];
  if(t>=keys[n-1][0])return keys[n-1][1];
  var i=1;
  while(i<n-1&&keys[i][0]<t)i++;
  var a=keys[i-1],b=keys[i],span=b[0]-a[0];
  if(span<=0)return b[1];
  var p=(t-a[0])/span,f=get(b[2]||name||DEFAULT);
  return a[1]+(b[1]-a[1])*f(clamp(p,0,1));
}

Fable.ease={get:get,has:function(n){return Object.prototype.hasOwnProperty.call(E,n)},names:function(){return Object.keys(E)},
  sample:sample,lerp:lerp,clamp:clamp,damp:damp,DEFAULT:DEFAULT};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
