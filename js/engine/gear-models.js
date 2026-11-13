/* Voxel models for items (implementation plan, sections 9 and 15.4).
   An item's `visual` names a row of Fable.content.itemModels (family, params, palette, mount, stow). A family is a small
   builder function that draws that kind of item out of boxes and shaped blocks (Fable.b, Fable.s), and the result is voxelized
   like the characters, so a sword, a shield or a suit of armor is data (family + params + palette) and a new item needs no engine edit.
   Cosmetics (Phase 12) override params and palette only, so they can never change stats.

   Grip space: a held item is built around the point the hand closes on, blade or head along +y, its flat face toward +z.
   Units are the character model's local units (the Human Fighter's, before its 0.75 scale), so a model fits any rig whose
   gearScale says how those units compare with its own.

   A family returns {hand}, {forearm} (a shield strapped on the forearm) or {body, armL, armR} (armor pieces that follow
   the torso and each arm). Every returned group is already voxelized.

   How the models avoid looking like stacks of crates: Fable.s blocks (cylinders, cones, ellipsoids, tapered prisms) make round and
   pointed parts, and Fable.gear.kit.seg draws a tapered block between two points at any angle, so blades curve, hafts taper, limbs
   bend and spikes point the way they should. Edges and ridges are separate thin layers in a lighter or darker tone, because the voxel
   grid has no lighting detail of its own.

   Fable.gear.build(spec, {stowed})  groups for one visual spec (cached; always returns fresh clones)
   Fable.gear.specFor(itemId)        the merged spec of an item, or null when it has no visual
   Fable.gear.create(itemId, opts)   a ready group for the item alone (ground items, shop previews)
   Fable.gear.families               name -> builder(params, palette, ctx), so new families can be registered by content
   Fable.gear.upright                family name -> true for families the Store shows standing, not laid on a slant (props, armor)
   Fable.gear.kit                    the drawing helpers, shared with gear-props.js */
(function(){
var G={},cache={};
Fable.gear=G;
G.families={};
G.upright={armor:true,shield:true,potion:true,prop:true};
function THREE_(){if(typeof THREE==='undefined')throw new Error('Gear: Three.js is needed to build item models');return THREE}
function grp(){return new (THREE_().Group)()}
function B(p,x,y,z,w,h,d,c,g){return Fable.b(p,x,y,z,w,h,d,c,1,g)}
/* a shaped block: kind 'box' | 'cyl' | 'ell', taper the top size over the bottom size (a number, or [x,z]) */
function S(p,kind,x,y,z,w,h,d,c,taper,g){return Fable.s(p,x,y,z,w,h,d,c,kind,taper,g)}
function def(o,d){var r={};Object.keys(d).forEach(function(k){r[k]=d[k]});Object.keys(o||{}).forEach(function(k){r[k]=o[k]});return r}
function finish(g){g.updateMatrixWorld(true);Fable.voxelize(g,false);return g}
function rotated(m,rx,ry,rz){m.rotation.set(rx||0,ry||0,rz||0);return m}
/* a tapered block from point a to point b, w by d across (w is the in-plane width when the segment lies in the xy plane) */
function seg(p,a,b,w,d,c,o){
  o=o||{};
  var T=THREE_(),va=new T.Vector3(a[0],a[1],a[2]||0),vb=new T.Vector3(b[0],b[1],b[2]||0),dir=vb.clone().sub(va),len=dir.length();
  if(len<1e-4)return null;
  var mid=va.clone().add(vb).multiplyScalar(.5),m=S(p,o.k||'box',mid.x,mid.y,mid.z,w,len*(o.over||1.04),d,c,o.taper,o.glow);
  m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());
  return m;
}
/* a chain of segments along an arc of the circle (cx,cy,r) in the xy plane from angle a0 to a1 (radians); w and d may be numbers or
   functions of t (0 to 1) so the blade of a sickle or the limb of a bow can taper */
function arc(p,cx,cy,r,a0,a1,n,w,d,c,o){
  function at(f,t){return typeof f==='function'?f(t):f}
  for(var i=0;i<n;i++){
    var t0=i/n,t1=(i+1)/n,u0=a0+(a1-a0)*t0,u1=a0+(a1-a0)*t1,tm=(t0+t1)/2;
    seg(p,[cx+Math.cos(u0)*r,cy+Math.sin(u0)*r,0],[cx+Math.cos(u1)*r,cy+Math.sin(u1)*r,0],at(w,tm),at(d,tm),at(c,tm),o);
  }
}
/* a flat ring in the xz plane made of n short blocks (a hoop, a pommel ring, a rope turn) */
function ring(p,x,y,z,r,thick,h,c,n){
  n=n||12;
  for(var i=0;i<n;i++){
    var a0=i/n*Math.PI*2,a1=(i+1)/n*Math.PI*2;
    seg(p,[x+Math.cos(a0)*r,y,z+Math.sin(a0)*r],[x+Math.cos(a1)*r,y,z+Math.sin(a1)*r],thick,h,c);
  }
}
function lerp(a,b,t){return a+(b-a)*t}
function shade(c,k){
  var r=Math.min(255,Math.round(((c>>16)&255)*k)),g=Math.min(255,Math.round(((c>>8)&255)*k)),b=Math.min(255,Math.round((c&255)*k));
  return (r<<16)|(g<<8)|b;
}
G.kit={grp:grp,B:B,S:S,def:def,finish:finish,seg:seg,arc:arc,ring:ring,lerp:lerp,shade:shade,rotated:rotated};

/* a leather or cord grip: short wraps in two tones along the grip, from y = top down to y = top - len */
function grip(g,top,len,w,c1,c2){
  var n=Math.max(2,Math.round(len/.75)),h=len/n;
  for(var i=0;i<n;i++)S(g,'cyl',0,top-h*(i+.5),0,w,h+.03,w,i%2?c2:c1);
}

/* ---------- blades: sword, dagger, rapier, scimitar, greatsword, shortsword ----------
   blade length, width at the guard, thick, guard span, grip length, pommel size, curve (0 straight, 1 a scimitar's belly), tip (the share of the
   blade that is the point), fuller (a dark groove down each face), cup (a rapier's swept hilt) */
G.families.blade=function(P,C,ctx){
  P=def(P,{blade:13,width:1.4,thick:.6,guard:5.6,grip:3,curve:0,pommel:1.7,cup:false,tip:.16,fuller:true,quillon:'bar'});
  C=def(C,{blade:0xdde4ec,edge:0xf4f8fb,fuller:0x8f9ba8,guard:0xf0b94d,grip:0x3b2616,wrap:0x5a3d22,pommel:0xf0b94d,sheath:0x3b2616,sheathTrim:0xf0b94d});
  var g=grp(),y0=1.2,L=P.blade,w=P.width,n=Math.max(4,Math.round(L/2.4)),i;
  function cen(t){return [P.curve*L*.2*t*t,y0+L*t,0]}
  function wf(t){return w*(1-.22*Math.min(1,t/(1-P.tip)))}
  if(!ctx.stowed){
    var mainEnd=1-P.tip;
    for(i=0;i<n;i++){
      var t0=mainEnd*i/n,t1=mainEnd*(i+1)/n;
      seg(g,cen(t0),cen(t1),wf(t0),P.thick*.5,C.edge,{taper:[wf(t1)/wf(t0),1]});
    }
    seg(g,cen(mainEnd),cen(1),wf(mainEnd),P.thick*.5,C.edge,{taper:[0,0]});
    for(i=0;i<n;i++){
      var u0=mainEnd*i/n,u1=mainEnd*(i+1)/n;
      seg(g,cen(u0),cen(u1),wf(u0)*.34,P.thick,C.blade,{taper:[wf(u1)/wf(u0),1]});
    }
    seg(g,cen(mainEnd),cen(1-P.tip*.18),wf(mainEnd)*.3,P.thick*.9,C.blade,{taper:[0,0]});
    if(P.fuller&&L>8)[-1,1].forEach(function(s){
      for(i=0;i<n-1;i++){
        var f0=.06+(mainEnd-.1)*i/(n-1),f1=.06+(mainEnd-.1)*(i+1)/(n-1);
        if(i%1===0)seg(g,[cen(f0)[0],cen(f0)[1],s*(P.thick*.5+.02)],[cen(f1)[0],cen(f1)[1],s*(P.thick*.5+.02)],wf(f0)*.14,.08,C.fuller);
      }
    });
  }else{
    /* the scabbard: a tapered leather sleeve with a gold throat at the mouth and a chape at the point */
    for(i=0;i<n;i++){
      var s0=i/n,s1=(i+1)/n;
      seg(g,cen(s0),cen(s1),w*lerp(2.2,1.5,s0),P.thick*lerp(3.4,2.2,s0),C.sheath,{taper:[lerp(2.2,1.5,s1)/lerp(2.2,1.5,s0),1]});
    }
    S(g,'box',0,y0+.5,0,w*2.4,1.2,P.thick*3.8,C.sheathTrim);
    var e=cen(1);S(g,'box',e[0],e[1]-.4,0,w*1.6,1.3,P.thick*2.6,C.sheathTrim,[.55,.55]);
  }
  /* the cross guard */
  var gs=P.guard;
  if(P.cup){
    S(g,'cyl',0,y0+.3,0,gs*.95,2.1,gs*.78,C.guard,[.38,.38]);
    S(g,'cyl',0,y0+1.5,0,gs*.98,.7,gs*.8,C.guard,[1.02,1.02]);
    S(g,'box',0,y0+.2,0,gs*1.5,.55,.7,C.guard);
    S(g,'cyl',0,y0-.9,0,1.2,1,1.2,C.guard);
  }else{
    S(g,'box',0,y0+.1,0,1.9,1.5,P.thick*2.4+.6,C.guard);
    [-1,1].forEach(function(s){
      seg(g,[s*.8,y0+.2,0],[s*gs*.5,y0+(P.quillon==='curl'?.65:.25),0],1.05,1.15,C.guard,{taper:[.78,.78]});
      S(g,'ell',s*gs*.5,y0+(P.quillon==='curl'?.65:.25),0,1.35,1.35,1.35,C.guard);
    });
  }
  /* wrapped grip, pommel */
  grip(g,y0-.45,P.grip,1.05,C.grip,C.wrap);
  var py=y0-.45-P.grip-P.pommel*.42;
  S(g,'ell',0,py,0,P.pommel,P.pommel*.95,P.pommel,C.pommel);
  S(g,'cyl',0,py-P.pommel*.55,0,P.pommel*.45,.5,P.pommel*.45,C.pommel);
  return {hand:finish(g)};
};

/* ---------- axes and picks ----------
   head 'single' | 'double' | 'pick' | 'sickle', size the span of the head, shaft the haft length */
G.families.axe=function(P,C){
  P=def(P,{shaft:12,head:'single',size:4.4});
  C=def(C,{wood:0x7a5a38,woodDark:0x5a4028,metal:0x9aa6b3,edge:0xe6ecf2,bind:0x3b2616});
  var g=grp(),top=P.shaft-3,h=P.head,i;
  /* a haft that swells at the grip and the end, bound where the head sits */
  S(g,'cyl',0,(P.shaft-6)/2-.2,0,1.25,P.shaft+.6,1.25,C.wood,[.9,.9]);
  S(g,'ell',0,-2.9,0,1.7,1.7,1.7,C.woodDark);
  [-1.8,-.4,1].forEach(function(y){S(g,'cyl',0,y,0,1.45,.38,1.45,C.bind)});
  if(h==='sickle'){
    var r=P.shaft*.62;
    S(g,'cyl',0,top-.3,0,1.6,2.4,1.6,C.metal);
    arc(g,r-.2,top+.3,r,Math.PI,Math.PI*.1,9,function(t){return lerp(1.8,.3,t)},function(t){return lerp(.9,.3,t)},C.metal);
    arc(g,r-.2,top+.3,r+.55,Math.PI*.98,Math.PI*.12,9,.35,.4,C.edge);
    return {hand:finish(g)};
  }
  S(g,'cyl',0,top+.2,0,1.9,3.6,1.9,C.metal,[.8,.8]);
  if(h==='pick'){
    /* a war pick: a long curved spike on one side, a blunt hammer face on the other */
    S(g,'box',-1.5,top+.2,0,1.8,2,1.5,C.metal);S(g,'cyl',-2.5,top+.2,0,1.2,1.1,1.2,C.edge);
    arc(g,P.size*.3,top-P.size*.3-.3,P.size*.8,Math.PI*.78,Math.PI*.38,6,function(t){return lerp(1.7,.3,t)},function(t){return lerp(1.2,.3,t)},C.metal);
    return {hand:finish(g)};
  }
  /* a bearded axe head: a thick cheek at the socket flaring to a curved cutting edge, with the beard hooked down */
  function blade(s){
    var R=P.size,n=6;
    for(i=0;i<n;i++){
      var a0=lerp(-.95,.8,i/n),a1=lerp(-.95,.8,(i+1)/n),cx=s*(.5-R*.18);
      var e0=[cx+s*Math.cos(a0)*R*1.05,top+.2+Math.sin(a0)*R*.68,0],e1=[cx+s*Math.cos(a1)*R*1.05,top+.2+Math.sin(a1)*R*.68,0];
      seg(g,[s*.6,top+.2+Math.sin(a0)*R*.22,0],e0,R*.34,.95,C.metal,{taper:[.9,.28]});
      seg(g,e0,e1,.55,.45,C.edge);
    }
    seg(g,[s*.6,top-R*.3,0],[s*R*.95,top-R*.78,0],R*.3,.8,C.metal,{taper:[.3,.3]});
  }
  if(h==='double'){blade(1);blade(-1)}
  else{blade(1);S(g,'box',-1.35,top+.2,0,1.5,2.4,1.3,C.metal);S(g,'ell',-2,top+.2,0,1.3,1.3,1.3,C.metal)}
  return {hand:finish(g)};
};

/* ---------- bludgeons: club, mace, morningstar, flail, hammers ---------- */
G.families.bludgeon=function(P,C){
  P=def(P,{style:'mace',shaft:10,head:3.2});
  C=def(C,{wood:0x7a5a38,woodDark:0x5a4028,metal:0x9aa6b3,dark:0x6f7b88,bind:0x3b2616,chain:0x7d8896,edge:0xe6ecf2});
  var g=grp(),s=P.style,top=P.shaft-3,i,h=P.head;
  if(s==='club'){
    /* a knotted cudgel that swells toward the head; studs for the big one */
    S(g,'cyl',0,(P.shaft-6)/2,0,1.2,P.shaft,1.2,C.wood,[2.8,2.8]);
    S(g,'ell',0,top+.6,0,h*.95,h*1.5,h*.95,C.wood);
    S(g,'ell',.5,top-1,.4,.9,.9,.9,C.woodDark);S(g,'ell',-.5,top+1.4,-.5,.8,.8,.8,C.woodDark);
    S(g,'ell',0,-2.8,0,1.5,1.2,1.5,C.woodDark);S(g,'cyl',0,-1.7,0,1.3,.4,1.3,C.bind);
    return {hand:finish(g)};
  }
  /* shared: a haft with a wrapped grip, a flared butt cap and a langet strip below the head */
  S(g,'cyl',0,(P.shaft-6)/2-.2,0,1.1,P.shaft+.4,1.1,s==='flail'?C.wood:C.dark);
  grip(g,1.2,5.2,1.35,C.bind,0x5a4028);
  S(g,'cyl',0,-2.9,0,1.9,.9,1.9,C.metal,[1.4,1.4]);S(g,'ell',0,-3.4,0,1.6,.9,1.6,C.metal);
  if(s==='mace'){
    S(g,'cyl',0,top-.6,0,1.9,1.3,1.9,C.dark);
    S(g,'ell',0,top+h*.4,0,h*.85,h*1.1,h*.85,C.metal);
    for(i=0;i<6;i++){
      var a2=i*Math.PI/3;
      seg(g,[Math.cos(a2)*h*.28,top+h*.4,Math.sin(a2)*h*.28],[Math.cos(a2)*h*.78,top+h*.4,Math.sin(a2)*h*.78],h*.62,h*.28,C.dark,{taper:[.28,1]});
    }
  }else if(s==='morningstar'){
    S(g,'cyl',0,top-.6,0,1.9,1.3,1.9,C.dark);
    S(g,'ell',0,top+h*.55,0,h*.95,h*.95,h*.95,C.metal);
    var dirs=[[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,1,0],[.7,.7,0],[-.7,.7,0],[0,.7,.7],[0,.7,-.7],[.7,0,.7],[-.7,0,.7],[.7,0,-.7],[-.7,0,-.7]];
    dirs.forEach(function(d){
      var cy=top+h*.55;
      seg(g,[d[0]*h*.3,cy+d[1]*h*.3,d[2]*h*.3],[d[0]*h*.98,cy+d[1]*h*.98,d[2]*h*.98],.95,.95,C.edge,{taper:[0,0],k:'box'});
    });
  }else if(s==='flail'){
    S(g,'ell',0,top+.1,0,1.4,1.4,1.4,C.metal);
    for(i=0;i<4;i++)S(g,'box',i%2?.35:-.35,top+1.1+i*1.15,i*.45,i%2?1.5:.55,1.2,i%2?.55:1.5,C.chain);
    var by=top+6.2,bz=2.2;
    S(g,'ell',0,by,bz,h,h,h,C.metal);
    [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],[.7,.7,0],[-.7,.7,0]].forEach(function(d){
      seg(g,[d[0]*h*.35,by+d[1]*h*.35,bz+d[2]*h*.35],[d[0]*h*.95,by+d[1]*h*.95,bz+d[2]*h*.95],.9,.9,C.edge,{taper:[0,0]});
    });
  }else{
    /* hammer and maul: a socketed head with a domed face, a bevelled poll on the other side */
    var hw=h*1.55;
    S(g,'box',0,top+.2,0,hw*.62,h*.95,h*.95,C.metal);
    S(g,'cyl',hw*.34,top+.2,0,h*.95,hw*.3,h*.95,C.metal,[.75,.75]).rotation.z=-Math.PI/2;
    S(g,'cyl',hw*.52,top+.2,0,h*.8,.5,h*.8,C.edge).rotation.z=-Math.PI/2;
    S(g,'box',-hw*.38,top+.2,0,hw*.3,h*.78,h*.78,C.metal,[.6,.6]).rotation.z=Math.PI/2;
    S(g,'box',-hw*.3,top+.2,0,hw*.5,h*.5,h*.6,C.dark);
    S(g,'cyl',0,top-.7,0,1.9,1,1.9,C.dark);
  }
  return {hand:finish(g)};
};

/* ---------- staffs and tubes ---------- */
G.families.staff=function(P,C){
  P=def(P,{length:24,cap:true});C=def(C,{wood:0x7a5834,cap:0x8f9aa6,bind:0x3b2616,grain:0x5e4126});
  var g=grp(),L=P.length;
  S(g,'cyl',0,(L-8)/2,0,1.25,L,1.25,C.wood,[.86,.86]);
  /* knots in the grain and a wrapped grip in the middle */
  [.3,.62,.8].forEach(function(t,i){S(g,'ell',i%2?.5:-.5,-4+L*t,i%2?.3:-.3,.7,.9,.7,C.grain)});
  grip(g,L*.5-4+2.6,5.2,1.5,C.bind,0x5a4028);
  if(P.cap){
    S(g,'cyl',0,L-4,0,1.7,1.3,1.7,C.cap);S(g,'cyl',0,-4.2,0,1.7,1,1.7,C.cap);
  }
  return {hand:finish(g)};
};

/* ---------- polearms and thrown spears: spear, javelin, dart, trident, pike, glaive, halberd, lance ---------- */
G.families.polearm=function(P,C){
  P=def(P,{length:24,head:'spear',blade:4.4});
  C=def(C,{wood:0x7a5834,metal:0xb9c4cf,edge:0xf2f4f0,bind:0x3b2616,flag:0xa8322b,flagTrim:0xe8c060});
  var g=grp(),L=P.length,top=L-8,h=P.head,i,bl=P.blade;
  S(g,'cyl',0,(L-8)/2,0,1,L,1,C.wood,[.9,.9]);
  S(g,'cyl',0,-3.2,0,1.35,.9,1.35,C.metal,[.6,.6]);
  function socket(y,w){S(g,'cyl',0,y,0,w||1.5,1.6,w||1.5,C.metal,[.8,.8]);[0,1].forEach(function(k){S(g,'cyl',0,y-1.2-k*.5,0,1.25,.3,1.25,C.bind)})}
  if(h==='spear'||h==='javelin'||h==='pike'||h==='lance'){
    var slim=h==='javelin'||h==='pike',w=slim?(h==='pike'?1.3:1):2.4;
    socket(top+.4);
    /* a leaf shaped head: a belly that swells above the socket and runs out to a point, with a raised midrib */
    S(g,'ell',0,top+1.6+bl*.28,0,w,bl*.62,.55,C.metal);
    seg(g,[0,top+1.6+bl*.45,0],[0,top+1.6+bl,0],w*.8,.5,C.metal,{taper:[0,0]});
    seg(g,[0,top+1.6,0],[0,top+1.6+bl*.92,0],.42,.85,C.edge,{taper:[.5,.5]});
    if(h==='pike'){[-1,1].forEach(function(s){seg(g,[s*.55,top-.8,0],[s*.55,top-5.5,0],.35,.5,C.metal)})}
    if(h==='lance'){
      S(g,'cyl',0,top-3.4,0,3.9,3.4,3.9,C.flag,[.35,.35]).rotation.x=Math.PI;
      S(g,'ell',0,top-1.4,0,4.4,1.2,4.4,C.metal);
      seg(g,[.5,top-.6,0],[5.4,top-1.6,.4],.3,2.6,C.flag,{taper:[.2,1]});
    }
    if(h==='javelin'){S(g,'cyl',0,-3.6,0,.9,1.3,.9,C.metal,[.4,.4]);seg(g,[0,top-4,0],[0,top-5,0],1.15,1.15,C.bind)}
  }else if(h==='dart'){
    seg(g,[0,top+.2,0],[0,top+2.6,0],1.05,1.05,C.metal,{taper:[0,0]});
    [0,Math.PI/2].forEach(function(r){var f=S(g,'box',0,-2.4,0,.3,2.6,2.6,C.flag,[1,.3]);f.rotation.y=r});
  }else if(h==='trident'){
    S(g,'cyl',0,top+.2,0,2,1.1,2,C.metal);
    [-1,1].forEach(function(s){
      arc(g,s*1.9,top+1.3,1.9,s>0?Math.PI:0,s>0?Math.PI*1.5:Math.PI*-.5,4,.85,.7,C.metal);
      seg(g,[s*3.8,top+1.3,0],[s*3.8,top+5.2,0],.85,.7,C.metal,{taper:[.6,.6]});
      seg(g,[s*3.8,top+4.8,0],[s*3.8,top+6.7,0],.8,.7,C.edge,{taper:[0,0]});
      seg(g,[s*3.4,top+4.3,0],[s*2.7,top+5.3,0],.45,.5,C.metal,{taper:[0,0]});
    });
    seg(g,[0,top+.7,0],[0,top+6.2,0],1,.8,C.metal,{taper:[.6,.6]});
    seg(g,[0,top+5.8,0],[0,top+8.2,0],.9,.8,C.edge,{taper:[0,0]});
  }else if(h==='glaive'){
    socket(top+.3);
    S(g,'ell',0,top+1.2,0,2.4,1.6,1.2,C.bind);
    var n=8;
    for(i=0;i<n;i++){
      var t0=i/n,t1=(i+1)/n;
      function p(t){return [Math.sin(t*1.5)*bl*.5*.55+(t>.75?(t-.75)*1.5:0),top+1.6+t*bl*1.7,0]}
      seg(g,p(t0),p(t1),lerp(2.5,.5,t1*t1),.55,C.metal,{taper:[lerp(2.5,.5,t1*t1)/lerp(2.5,.5,t0*t0)*.0+.8,1]});
      seg(g,[p(t0)[0]+lerp(.95,.15,t0),p(t0)[1],0],[p(t1)[0]+lerp(.95,.15,t1),p(t1)[1],0],.32,.42,C.edge);
    }
  }else if(h==='halberd'){
    socket(top+.3);
    seg(g,[0,top+1.2,0],[0,top+6.5,0],1.1,.8,C.metal,{taper:[.3,.5]});seg(g,[0,top+5.8,0],[0,top+8.4,0],.7,.7,C.edge,{taper:[0,0]});
    /* the axe blade: a deep curved face below a rear hook */
    arc(g,1.2,top+.6,3.2,-1.1,1.1,6,function(t){return lerp(2.3,1.1,Math.abs(t-.5)*2)},.7,C.metal);
    arc(g,1.2,top+.6,3.8,-1.1,1.1,6,.4,.5,C.edge);
    seg(g,[-.5,top+1.4,0],[-2.8,top+.2,0],1,.8,C.metal,{taper:[.3,.5]});
  }
  return {hand:finish(g)};
};

/* ---------- bows ---------- */
G.families.bow=function(P,C){
  P=def(P,{height:20});C=def(C,{wood:0x8a6238,woodDark:0x5e4126,string:0xe8dcc0,grip:0x3b2616,tip:0xe8dcc0});
  var g=grp(),half=P.height/2,n=9,i,pts=[];
  /* a recurved limb: it bends away from the archer through the middle, then flicks forward at the tip; the string runs tip to tip */
  function limb(t){return -Math.sin(t*Math.PI*.78)*P.height*.075+Math.max(0,t-.8)*P.height*.55}
  for(i=0;i<=n;i++){var t=i/n;pts.push([limb(t),t*half])}
  [1,-1].forEach(function(s){
    for(i=0;i<n;i++){
      var a=pts[i],b=pts[i+1],t=i/n;
      seg(g,[a[0],s*a[1],0],[b[0],s*b[1],0],lerp(1.25,.6,t),lerp(1.05,.55,t),i%3===2?C.woodDark:C.wood);
    }
    S(g,'ell',pts[n][0],s*pts[n][1],0,.8,.9,.8,C.tip);
  });
  S(g,'cyl',pts[0][0],0,0,1.5,3.6,1.5,C.grip);
  [-1,1].forEach(function(s){S(g,'cyl',pts[0][0],s*2.1,0,1.7,.4,1.7,C.woodDark)});
  var sx=pts[n][0];
  seg(g,[sx,half,0],[sx+.35,0,0],.2,.2,C.string);seg(g,[sx+.35,0,0],[sx,-half,0],.2,.2,C.string);
  S(g,'box',sx+.35,0,0,.55,.7,.55,C.tip);
  return {hand:finish(g)};
};

/* ---------- crossbows ---------- */
G.families.crossbow=function(P,C){
  P=def(P,{span:11,stock:9});C=def(C,{wood:0x7a5a38,woodDark:0x5a4028,metal:0x8590a0,steel:0xc4ccd6,string:0xe8dcc0});
  var g=grp(),sp=P.span,st=P.stock;
  /* a stock that rises to a cheek, a grooved top for the bolt, a prod of two flexed limbs, a stirrup, a trigger and a nut */
  S(g,'box',0,0,-st*.15,1.5,1.5,st,C.wood,[1,.6]);
  S(g,'box',0,-.8,-st*.5,1.25,2.2,st*.34,C.woodDark);
  S(g,'box',0,.85,-st*.05,.55,.35,st*.7,C.woodDark);
  S(g,'box',0,.1,st*.42,1.6,1.3,2.4,C.wood);
  [-1,1].forEach(function(s){
    seg(g,[s*.6,0,st*.58],[s*sp*.5,0,st*.46],1,.8,C.metal,{taper:[.6,.8]});
    seg(g,[s*sp*.5,0,st*.46],[s*sp*.58,0,st*.2],.7,.7,C.steel,{taper:[.7,.7]});
    S(g,'ell',s*sp*.58,0,st*.2,.8,.8,.8,C.steel);
    seg(g,[s*sp*.58,.15,st*.2],[s*.5,.3,-st*.18],.18,.18,C.string);
  });
  S(g,'box',0,-1.5,-st*.34,.5,1.5,.8,C.metal,[1,.5]);
  S(g,'ell',0,.35,-st*.18,.9,.7,.9,C.steel);
  var r=grp();r.add(g);r.rotation.x=-Math.PI/2;
  var out=grp();out.add(r);
  return {hand:finish(out)};
};

/* ---------- firearms ---------- */
G.families.firearm=function(P,C){
  P=def(P,{barrel:14,stock:true});C=def(C,{wood:0x7a5230,woodDark:0x58381f,metal:0x5d6670,steel:0xaab4c0,brass:0xd4a43c});
  var g=grp(),L=P.barrel,i;
  /* a round barrel with bands and a flared muzzle, a lock plate with a cocked hammer and pan, a trigger guard and a shaped butt */
  S(g,'cyl',0,L*.5+1.2,0,1.15,L,1.15,C.metal);
  S(g,'cyl',0,L+1.5,0,1.5,.8,1.5,C.metal);S(g,'ell',0,L+2,0,.85,.7,.85,C.steel);
  var nb=P.stock?4:2;
  for(i=0;i<nb;i++)S(g,'cyl',0,2.6+i*(L-3)/nb,0,1.45,.45,1.45,C.brass);
  S(g,'box',0,.3,0,1.45,5.2,1.55,C.wood);
  S(g,'box',0,-3.2,-.3,1.6,3.6,1.9,C.woodDark,[1.2,1.5]);
  S(g,'box',1,.8,0,.5,2.1,.8,C.steel);
  seg(g,[1.3,.9,0],[1.9,2.1,0],.6,.5,C.steel,{taper:[.5,.5]});
  S(g,'box',1.2,2.2,0,.9,.5,1,C.brass);
  ring(g,0,-1.1,.2,.9,.3,.3,C.brass,8);
  var bw=grp();ring(bw,0,0,0,.9,.3,.3,C.brass,8);
  if(P.stock){
    S(g,'box',0,-6.3,-.9,1.35,4.6,2.3,C.wood,[1,1.8]);
    S(g,'box',0,-8.5,-1.1,1.6,1.3,2.9,C.woodDark);
    S(g,'cyl',0,L*.5,.95,.35,L*.78,.35,C.steel);
  }else{
    S(g,'box',0,-4,-.5,1.6,2.8,2.1,C.woodDark,[1,1.6]);
    S(g,'ell',0,-5.7,-.8,2,1.6,2.6,C.brass);
  }
  return {hand:finish(g)};
};

/* ---------- a potion flask (shops and loot; held in a hand when drunk) ----------
   the liquid is the body of the flask and stays in plain sight: the glass is only the neck, a shoulder shine and a thin rim */
G.families.potion=function(P,C){
  P=def(P,{height:7,radius:3.4});
  C=def(C,{glass:0xd7eaf4,liquid:0xc2282b,glow:0xff6a5a,deep:0x8f1c20,cork:0x9a6a3a,band:0xf0b94d,label:0xe8dcc0});
  var g=grp(),r=P.radius,h=P.height;
  S(g,'ell',0,h*.3,0,r*2,h*.56,r*2,C.liquid);
  S(g,'ell',0,h*.2,0,r*1.7,h*.3,r*1.7,C.deep);
  S(g,'ell',-r*.5,h*.38,r*.62,r*.5,h*.3,r*.45,C.glass);
  S(g,'ell',r*.3,h*.5,r*.8,r*.3,h*.1,r*.3,C.glass);
  S(g,'ell',r*.15,h*.28,r*.9,r*.9,h*.18,r*.5,C.glow,[1,1],true);
  S(g,'cyl',0,h*.66,0,r*.95,h*.2,r*.95,C.glass,[.9,.9]);
  S(g,'cyl',0,h*.78,0,r*1.35,.55,r*1.35,C.band);
  S(g,'cyl',0,h*.9,0,r*.95,h*.2,r*.95,C.cork,[1.15,1.15]);
  return {hand:finish(g)};
};

/* ---------- sling and whip ---------- */
G.families.sling=function(P,C){
  C=def(C,{cord:0x9a7a4e,pouch:0x6b4a2e,stitch:0x3b2616});var g=grp();
  S(g,'ell',0,3.2,0,2.2,1.6,1.1,C.pouch);S(g,'box',0,3.2,.6,1.5,.2,.2,C.stitch);
  seg(g,[-.7,3.2,0],[-.9,-1.2,0],.35,.35,C.cord);seg(g,[.7,3.2,0],[.9,-1.2,0],.35,.35,C.cord);
  S(g,'ell',0,-2.2,0,.9,.9,.9,C.pouch);
  return {hand:finish(g)};
};
G.families.whip=function(P,C){
  C=def(C,{handle:0x3b2616,wrap:0x6b4a2e,cord:0x9a7a4e,tip:0xe8dcc0});var g=grp(),i;
  grip(g,2.2,4.4,1.25,C.handle,C.wrap);
  S(g,'ell',0,-2.5,0,1.5,1.1,1.5,C.handle);S(g,'cyl',0,2.4,0,1.6,.5,1.6,C.cord);
  var pts=[];for(i=0;i<=14;i++){var t=i/14;pts.push([Math.sin(t*5.5)*1.5*t,2.8+t*8.5-Math.sin(t*3.1)*1.2,t*3.8])}
  for(i=0;i<14;i++)seg(g,[pts[i][0],pts[i][1],pts[i][2]],[pts[i+1][0],pts[i+1][1],pts[i+1][2]],lerp(.7,.22,i/14),lerp(.7,.22,i/14),i>11?C.tip:C.cord);
  return {hand:finish(g)};
};

/* ---------- shields (forearm mount; the face looks toward +z) ----------
   a heater: a metal rim round a painted face that is domed in the middle, a boss, a cross and rivets; round:true makes a roundel */
G.families.shield=function(P,C){
  P=def(P,{w:7.4,h:9.6,round:false});
  C=def(C,{rim:0xf0b94d,face:0x2f5d9e,mark:0xe8dcc0,boss:0xf0b94d,back:0x4a3320});
  var g=grp(),w=P.w,h=P.h,i,rows=12;
  if(P.round){
    var d=Math.max(w,h);
    S(g,'cyl',0,0,0,d,1,d,C.rim).rotation.x=Math.PI/2;
    S(g,'cyl',0,0,.38,d-1.5,1,d-1.5,C.face).rotation.x=Math.PI/2;
    S(g,'ell',0,0,.7,d*.36,d*.36,1.6,C.boss);
    [0,Math.PI/2].forEach(function(r){var m=S(g,'box',0,0,.85,d-2.2,.9,.4,C.mark);m.rotation.z=r});
    S(g,'ell',0,0,1.4,d*.24,d*.24,1.2,C.rim);
    return {forearm:finish(g)};
  }
  /* the heater outline: straight sides at the shoulders, curving in to a point at the foot */
  function half(y){var t=(y+h/2)/h;return w/2*(t>.42?1-Math.pow((t-.42)/.58,0)*0:Math.sqrt(Math.max(0,1-Math.pow((.42-t)/.42,2)*.9)))}
  for(i=0;i<rows;i++){
    var y=-h/2+(i+.5)*h/rows,hw=half(y)*2,sz=h/rows+.04;
    S(g,'box',0,y,0,Math.max(.8,hw),sz,1,C.rim);
    S(g,'box',0,y,.4,Math.max(.4,hw-1.4),sz,1,C.face);
    S(g,'box',0,y,-.5,Math.max(.4,hw-1),sz,.5,C.back);
  }
  S(g,'ell',0,h*.04,.8,w*.7,h*.56,1.1,C.face);
  S(g,'box',0,h*.1,.95,.95,h*.62,.4,C.mark);S(g,'box',0,h*.18,.95,w*.64,.95,.4,C.mark);
  S(g,'ell',0,h*.18,1.25,2.6,2.6,1.6,C.boss);
  S(g,'ell',0,h*.18,1.7,1.2,1.2,.8,C.rim);
  [[-1,.4],[1,.4],[-1,-.15],[1,-.15]].forEach(function(r){S(g,'ell',r[0]*(w/2-.55),h*r[1],.9,.55,.55,.5,C.rim)});
  S(g,'ell',0,-h/2+.7,.5,1,1,.8,C.rim);
  return {forearm:finish(g)};
};

/* ---------- body armor ----------
   style  'mail' | 'plate' | 'leather' | 'cloth' | 'scale' | 'hide' decides the surface of the torso shell.
   One piece for the torso (a chest that rounds over the shoulders and tapers to the waist, with a skirt or tassets, pauldrons,
   a belt and an optional tabard) and one sleeve for each arm. The torso footprint (width, depth, height) is the hero's, so it
   sits on the rig exactly as the old box did. */
G.families.armor=function(P,C){
  P=def(P,{style:'mail',depth:5.8,width:9.8,height:8.6,sleeve:6.4,pauldrons:true,skirt:0,tabard:false,cuirass:0});
  C=def(C,{main:0xaab4c0,alt:0x7d8896,trim:0xf0b94d,tabard:0xa8322b,tabardTrim:0xf0b94d,belt:0x4a3320,buckle:0xe0b44a});
  var body=grp(),y=3.5,i,j,W=P.width,D=P.depth,H=P.height,st=P.style,z=D/2;
  var top=y+H/2,bot=y-H/2;
  /* the core: shoulders wider than the waist */
  S(body,'box',0,y+H*.18,0,W,H*.64,D,C.main);
  S(body,'box',0,y-H*.3,0,W*.9,H*.42,D*.96,C.main,[.92,.96]);
  S(body,'box',0,top-.5,0,W*.98,1,D*.96,C.alt);
  S(body,'cyl',0,top+.2,0,W*.5,.9,D*.7,C.alt,[1.05,1.05]);
  if(st==='mail'||st==='scale'){
    /* mail is rows of small links offset on every row; scale is rows of overlapping plates that point down */
    var rows=Math.floor(H/(st==='scale'?1.25:1)),cols=st==='scale'?8:12;
    for(i=0;i<rows;i++){
      var yy=top-.9-i*(st==='scale'?1.25:1),off=i%2?.5:0;
      for(j=0;j<cols;j++){
        var xx=-W/2+(j+.5+off)*W/cols;
        if(xx>W/2-.2)continue;
        if(st==='scale'){
          S(body,'cyl',xx,yy,z+.05,W/cols*1.1,1.15,.5,(i+j)%2?C.alt:C.main,[.7,.5]).rotation.z=Math.PI;
          S(body,'cyl',xx,yy,-z-.05,W/cols*1.1,1.15,.5,(i+j)%2?C.alt:C.main,[.7,.5]).rotation.z=Math.PI;
        }else if((i+j)%2===0){
          S(body,'box',xx,yy,z+.04,W/cols*.8,.65,.25,C.alt);
          S(body,'box',xx,yy,-z-.04,W/cols*.8,.65,.25,C.alt);
        }
      }
    }
    S(body,'box',0,bot+.3,0,W*.92,.7,D*.98,C.alt);
  }else if(st==='plate'){
    /* a breastplate with a raised medial ridge and bevelled edges, a gorget collar and overlapping faulds at the waist */
    S(body,'box',0,y+H*.14,z+.15,W*.8,H*.58,.5,C.alt,[.8,1]);
    S(body,'ell',0,y+H*.1,z+.4,W*.62,H*.55,1.1,C.main);
    S(body,'box',0,y+H*.12,z+.9,.8,H*.58,.4,C.trim,[.5,.5]);
    S(body,'box',0,y+H*.14,-z-.15,W*.78,H*.56,.4,C.alt);
    S(body,'cyl',0,top+.35,0,W*.52,.8,D*.74,C.trim);
    for(i=0;i<3;i++)S(body,'box',0,bot+1.7-i*.8,0,W*(.92-i*.02),.9,D*(1.02+i*.01),i%2?C.alt:C.main);
  }else{
    /* leather, hide and quilted cloth: panels with stitched seams, laced sides; studs and a hide's patches when asked for */
    for(i=-3;i<=3;i+=2){
      S(body,'box',i*1.25,y,z+.1,.4,H-.6,.3,C.alt);
      S(body,'box',i*1.25,y,-z-.1,.4,H-.6,.3,C.alt);
    }
    if(st==='cloth')for(j=0;j<5;j++){S(body,'box',0,top-1.4-j*1.5,z+.12,W-.8,.3,.3,C.alt);S(body,'box',0,top-1.4-j*1.5,-z-.12,W-.8,.3,.3,C.alt)}
    if(st!=='cloth')[-1,1].forEach(function(s){
      S(body,'ell',s*3.4,y+1.5,z+.25,.9,.9,.7,C.trim);S(body,'ell',s*3.4,y-.5,z+.25,.9,.9,.7,C.trim);
    });
    if(st==='hide')for(i=0;i<5;i++)S(body,'ell',-3.4+i*1.7,y-1.8+(i%2)*2.6,z+.18,2.2,1.8,.5,i%2?C.alt:C.trim);
    if(P.pauldrons&&st==='leather')[-1,1].forEach(function(s){for(i=0;i<4;i++)S(body,'ell',s*(W/2-.4),y+H*.2-i*1.4,z+.05,.8,.8,.7,C.trim)});
  }
  if(P.cuirass)S(body,'box',0,top-.4,0,W+.4,.8,D+.4,C.alt);
  /* belt with a buckle */
  S(body,'box',0,bot+1.2,0,W*.94,.9,D*1.01,C.belt);S(body,'box',0,bot+1.2,z+.3,1.4,1,.4,C.buckle);
  if(P.tabard){
    S(body,'box',0,y-.2,z+.3,3.8,H,.4,C.tabard,[.95,1]);S(body,'box',0,y-.2,z+.55,.8,H,.2,C.tabardTrim);
    S(body,'box',0,bot-.9,z+.3,3.8,1.8,.4,C.tabard,[.4,1]);
  }
  if(P.skirt){
    for(i=0;i<9;i++){
      var sx=-W/2+(i+.5)*W/9;
      S(body,'box',sx,bot-P.skirt/2+.2,z*.2+.2,W/9+.05,P.skirt,D*.9,i%2?C.main:C.alt,[1,1]);
    }
    S(body,'box',0,bot-P.skirt+.2,z*.35,W*1.02,.5,D*.94,C.trim);
  }
  if(P.pauldrons)[-1,1].forEach(function(s){
    var px=s*(W/2+.6),py=top-.3;
    if(st==='plate'){
      S(body,'ell',px,py+.7,0,4.8,3.4,D+1,C.main);
      S(body,'ell',px+s*.2,py-.5,0,4.4,2.4,D+.8,C.alt);
      S(body,'box',px,py+1.9,0,3.6,.5,D*.8,C.trim,[.7,.7]);
    }else{
      S(body,'ell',px,py+.5,0,4.4,3,D+.6,C.main);
      S(body,'box',px,py+1.4,0,4,.45,D+.4,C.trim,[.8,.8]);
    }
  });
  /* the sleeves hang from the shoulder: a tube that narrows to the wrist, banded at the elbow and cuff */
  var arms={};
  [['armL',1],['armR',-1]].forEach(function(a){
    var s=grp(),sl=P.sleeve;
    if(sl>0){
      S(s,'cyl',0,-sl/2+.4,0,4,sl,4.2,C.main,[.9,.9]);
      if(st==='plate'||sl>6){S(s,'ell',0,-sl*.5,.1,4.5,1.7,4.7,C.alt);S(s,'cyl',0,-sl+.5,0,4.3,.9,4.5,C.alt)}
      else if(st==='mail'||st==='scale'){for(i=0;i<sl;i+=2)S(s,'cyl',0,-i+.2,0,4.1,.55,4.3,C.alt);S(s,'cyl',0,-sl+.4,0,4.3,.7,4.5,C.alt)}
      else{S(s,'cyl',0,-sl+.4,0,4.2,.6,4.4,C.belt);S(s,'box',0,-sl*.55,2.15,.4,sl*.6,.25,C.alt)}
    }
    arms[a[0]]=finish(s);
  });
  return {body:finish(body),armL:arms.armL,armR:arms.armR};
};

/* ---------- resolving specs and building ---------- */
G.specFor=function(itemId){
  var C=Fable.content,it=C&&C.items&&C.items.get(itemId);
  if(!it||!it.visual)return null;
  var m=C.itemModels&&C.itemModels.get(it.visual.model);
  if(!m)return null;
  return {item:itemId,model:m.id,family:m.family,mount:m.mount,
    params:Object.assign({},m.params,it.visual.params),palette:Object.assign({},m.palette,it.visual.palette),
    stow:it.visual.stow!==undefined?it.visual.stow:(m.stow===undefined?null:m.stow)};
};

G.build=function(spec,opts){
  opts=opts||{};
  var fam=G.families[spec.family];
  if(!fam)throw new Error('Gear: unknown model family "'+spec.family+'"');
  var key=JSON.stringify([spec.family,spec.params,spec.palette,!!opts.stowed]);
  if(!cache[key]){
    var parts=fam(spec.params,spec.palette,{stowed:!!opts.stowed});
    if(opts.stowed&&parts.hand){/* a stowed item hangs by its middle, not its grip */}
    cache[key]=parts;
  }
  var out={};
  Object.keys(cache[key]).forEach(function(k){out[k]=cache[key][k].clone(true)});
  return out;
};

/* An item on its own, for the ground, a shop or a loot drop. Weapons lie flat on request. */
G.create=function(itemId,opts){
  opts=opts||{};
  var spec=G.specFor(itemId);
  if(!spec)return null;
  var parts=G.build(spec,{stowed:!!opts.stowed}),g=grp();
  Object.keys(parts).forEach(function(k){g.add(parts[k])});
  if(opts.ground&&parts.hand&&!G.upright[spec.family]){g.rotation.z=Math.PI/2}
  return g;
};

/* Frees the per-instance buffers of a model built by build(); geometry and materials are shared and stay. */
G.dispose=function(obj){
  if(!obj)return;
  obj.traverse(function(o){if(o.isInstancedMesh&&typeof o.dispose==='function')o.dispose()});
  if(obj.parent)obj.parent.remove(obj);
};
})();
