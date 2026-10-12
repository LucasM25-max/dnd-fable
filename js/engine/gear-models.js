/* Voxel models for items (implementation plan, sections 9 and 15.4).
   An item's `visual` names a row of Fable.content.itemModels (family, params, palette, mount, stow). A family is a small
   builder function that draws that kind of item with Fable.b boxes, and the result is voxelized like the characters, so a
   sword, a shield or a suit of armor is data (family + params + palette) and a new item needs no engine edit.
   Cosmetics (Phase 12) override params and palette only, so they can never change stats.

   Grip space: a held item is built around the point the hand closes on, blade or head along +y, its face toward +z.
   Units are the character model's local units (the Human Fighter's, before its 0.75 scale), so a model fits any rig whose
   gearScale says how those units compare with its own.

   A family returns {hand}, {forearm} (a shield strapped on the forearm) or {body, armL, armR} (armor pieces that follow
   the torso and each arm). Every returned group is already voxelized.

   Fable.gear.build(spec, {stowed})  groups for one visual spec (cached; always returns fresh clones)
   Fable.gear.specFor(itemId)        the merged spec of an item, or null when it has no visual
   Fable.gear.create(itemId, opts)   a ready group for the item alone (ground items, shop previews)
   Fable.gear.families               name -> builder(params, palette, ctx), so new families can be registered by content. */
(function(){
var G={},cache={};
Fable.gear=G;
G.families={};
function THREE_(){if(typeof THREE==='undefined')throw new Error('Gear: Three.js is needed to build item models');return THREE}
function grp(){return new (THREE_().Group)()}
function B(p,x,y,z,w,h,d,c,g){return Fable.b(p,x,y,z,w,h,d,c,1,g)}
function def(o,d){var r={};Object.keys(d).forEach(function(k){r[k]=d[k]});Object.keys(o||{}).forEach(function(k){r[k]=o[k]});return r}
function finish(g){g.updateMatrixWorld(true);Fable.voxelize(g,false);return g}

/* ---------- blades: sword, dagger, rapier, scimitar, greatsword, shortsword ---------- */
G.families.blade=function(P,C,ctx){
  P=def(P,{blade:13,width:1.4,thick:.6,guard:5.6,grip:3,curve:0,pommel:1.7,cup:false});
  C=def(C,{blade:0xe2e8ef,fuller:0x9aa5b1,guard:0xf0b94d,grip:0x3b2616,pommel:0xf0b94d,sheath:0x3b2616});
  var g=grp(),y0=1.0,segs=4,sl=P.blade/segs,i;
  var bc=ctx.stowed?C.sheath:C.blade;
  for(i=0;i<segs;i++){var t=(i+.5)/segs;B(g,P.curve*t*t*P.blade*.18,y0+sl*(i+.5),0,P.width*(ctx.stowed?1.5:1),sl+.02,P.thick*(ctx.stowed?2:1),bc)}
  if(!ctx.stowed){
    B(g,P.curve*P.blade*.18,y0+P.blade+.6,0,P.width*.55,1.2,P.thick*.8,C.blade);
    B(g,0,y0+P.blade*.5,P.thick*.6,P.width*.28,P.blade*.77,.1,C.fuller);
  }else B(g,0,y0+.1,0,P.width*1.9,.6,P.thick*2.6,C.guard);
  if(P.cup)B(g,0,1.0,0,P.guard,1.4,P.guard*.8,C.guard);
  else B(g,0,1.4-.4,0,P.guard,1,1.2,C.guard);
  B(g,0,-.4,0,1,P.grip,1,C.grip);
  B(g,0,-.4-P.grip/2-.8,0,P.pommel,1.4,P.pommel,C.pommel);
  return {hand:finish(g)};
};

/* ---------- axes and picks ---------- */
G.families.axe=function(P,C){
  P=def(P,{shaft:12,head:'single',size:4.4});
  C=def(C,{wood:0x6b4a2e,metal:0xaab4c0,edge:0xe2e8ef,bind:0x3b2616});
  var g=grp(),top=P.shaft-3;
  B(g,0,(P.shaft-6)/2,0,1.1,P.shaft,1.1,C.wood);
  B(g,0,-2.8,0,1.3,1.1,1.3,C.bind);
  if(P.head==='sickle'){
    [0,1,2,3].forEach(function(i){B(g,i*.9+.4,top+i*.4-(i>2?i*.5:0)+.6,0,1.6,1.2,.5,i>2?C.edge:C.metal)});
    return {hand:finish(g)};
  }
  B(g,0,top,0,1.7,2.6,1.7,C.metal);
  if(P.head==='pick'){B(g,P.size*.4,top,0,P.size*.8,1.1,.9,C.metal);B(g,P.size*.95,top-.4,0,1.4,.6,.7,C.edge);B(g,-1.4,top,0,1.4,.9,.8,C.metal);return {hand:finish(g)}}
  var sides=P.head==='double'?[1,-1]:[1];
  sides.forEach(function(s){
    B(g,s*P.size*.45,top,0,P.size*.9,P.size*.95,.8,C.metal);
    B(g,s*(P.size*.9+.2),top,0,.7,P.size*1.25,.7,C.edge);
  });
  if(P.head!=='double')B(g,-1.1,top,0,1,1.4,.9,C.metal);
  return {hand:finish(g)};
};

/* ---------- bludgeons: club, mace, morningstar, flail, hammers ---------- */
G.families.bludgeon=function(P,C){
  P=def(P,{style:'mace',shaft:10,head:3.2});
  C=def(C,{wood:0x6b4a2e,metal:0xaab4c0,dark:0x7d8896,bind:0x3b2616,chain:0x7d8896});
  var g=grp(),s=P.style,top=P.shaft-3;
  if(s==='club'){
    B(g,0,(P.shaft-6)/2,0,1.2,P.shaft,1.2,C.wood);B(g,0,top+.6,0,P.head*.8,P.head*1.3,P.head*.8,C.wood);B(g,0,-2.8,0,1.4,.9,1.4,C.bind);
    return {hand:finish(g)};
  }
  B(g,0,(P.shaft-6)/2,0,1.1,P.shaft,1.1,s==='flail'?C.wood:C.dark);B(g,0,-2.8,0,1.4,.9,1.4,C.bind);
  if(s==='mace'){
    B(g,0,top,0,P.head,P.head,P.head,C.metal);
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){B(g,d[0]*P.head*.6,top,d[1]*P.head*.6,d[0]?.9:P.head*.9,P.head*.9,d[1]?.9:P.head*.9,C.dark)});
  }else if(s==='morningstar'){
    B(g,0,top,0,P.head,P.head,P.head,C.metal);
    [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,1,0]].forEach(function(d){B(g,d[0]*P.head*.7,top+d[1]*P.head*.7,d[2]*P.head*.7,.8,.8,.8,C.dark)});
  }else if(s==='flail'){
    for(var i=0;i<3;i++)B(g,0,top+.4+i*1.1,i*.6,.7,1,.7,C.chain);
    B(g,0,top+3.9,1.9,P.head,P.head,P.head,C.metal);
    [[1,0],[-1,0],[0,1]].forEach(function(d){B(g,d[0]*P.head*.7,top+3.9+d[1]*P.head*.7,1.9,.8,.8,.8,C.dark)});
  }else{ /* hammer, maul */
    B(g,0,top,0,P.head*1.5,P.head,P.head,C.metal);B(g,0,top,0,P.head*1.7,P.head*.4,P.head*1.1,C.dark);
  }
  return {hand:finish(g)};
};

/* ---------- staffs ---------- */
G.families.staff=function(P,C){
  P=def(P,{length:24,cap:true});C=def(C,{wood:0x7a5834,cap:0x7d8896});
  var g=grp();
  B(g,0,(P.length-8)/2,0,1.1,P.length,1.1,C.wood);
  if(P.cap){B(g,0,P.length-4.2,0,1.5,.8,1.5,C.cap);B(g,0,-4.2,0,1.5,.8,1.5,C.cap)}
  return {hand:finish(g)};
};

/* ---------- polearms and thrown spears: spear, javelin, dart, trident, pike, glaive, halberd, lance ---------- */
G.families.polearm=function(P,C){
  P=def(P,{length:24,head:'spear',blade:4.4});
  C=def(C,{wood:0x7a5834,metal:0xc2cbd0,edge:0xe8e8da,bind:0x3b2616,flag:0xa8322b});
  var g=grp(),L=P.length,top=L-8,h=P.head,i;
  B(g,0,(L-8)/2,0,1,L,1,C.wood);B(g,0,-3.2,0,1.4,.9,1.4,C.bind);
  if(h==='spear'||h==='javelin'||h==='pike'||h==='lance'){
    B(g,0,top+.3,0,1.5,1,1.5,C.bind);
    B(g,0,top+1.2+P.blade*.35,0,h==='javelin'?1.1:1.8,P.blade*.7,.5,C.metal);
    B(g,0,top+1.2+P.blade*.8,0,h==='javelin'?.6:1,P.blade*.3,.4,C.edge);
    if(h==='lance')B(g,0,top-3,0,3.6,4,3.6,C.flag);
    if(h==='javelin'){B(g,0,-3.6,0,.9,1.2,.9,C.metal)}
  }else if(h==='dart'){
    B(g,0,top+.8,0,.9,1.4,.4,C.metal);B(g,0,-2.8,0,.4,2,2.2,C.flag);
  }else if(h==='trident'){
    B(g,0,top+.6,0,3.4,.8,.8,C.metal);
    [-1.4,0,1.4].forEach(function(x){B(g,x,top+2.4,0,.7,3.4+(x?0:1.2),.6,C.metal)});
  }else if(h==='glaive'){
    for(i=0;i<4;i++)B(g,i*.5+.4,top+1+i*1.6,0,1.8-i*.28,1.7,.5,i>2?C.edge:C.metal);
    B(g,0,top-.2,0,1.6,.8,1.6,C.bind);
  }else if(h==='halberd'){
    B(g,0,top+3.2,0,1,2.4,.7,C.metal);B(g,1.8,top+.4,0,3.4,3.6,.6,C.metal);B(g,3.4,top+.4,0,.6,4.2,.5,C.edge);B(g,-1.4,top+.4,0,1.6,1,.6,C.metal);
  }
  return {hand:finish(g)};
};

/* ---------- bows ---------- */
G.families.bow=function(P,C){
  P=def(P,{height:20});C=def(C,{wood:0x7a5834,string:0xe8dcc0,grip:0x3b2616});
  var g=grp(),n=6,half=P.height/2,i;
  for(i=0;i<n;i++){
    var t=(i+.5)/n,y=t*half,x=-Math.sin(t*Math.PI*.9)*P.height*.09;
    B(g,x,y,0,.9,half/n+.15,.9,C.wood);B(g,x,-y,0,.9,half/n+.15,.9,C.wood);
  }
  B(g,0,0,0,1.2,3,1.2,C.grip);
  B(g,P.height*.07,0,0,.25,P.height-.6,.25,C.string);
  return {hand:finish(g)};
};

/* ---------- crossbows ---------- */
G.families.crossbow=function(P,C){
  P=def(P,{span:11,stock:9});C=def(C,{wood:0x6b4a2e,metal:0x7d8896,string:0xe8dcc0});
  var g=grp();
  B(g,0,0,0,1.2,1.2,P.stock,C.wood);B(g,0,-1.4,-P.stock*.3,1,2,1.4,C.wood);
  B(g,0,0,P.stock*.5,P.span,.9,.9,C.metal);B(g,P.span*.5,0,P.stock*.45,.9,.9,1.5,C.metal);B(g,-P.span*.5,0,P.stock*.45,.9,.9,1.5,C.metal);
  B(g,0,.2,P.stock*.38,P.span-.6,.2,.2,C.string);
  var r=grp();r.add(g);r.rotation.x=-Math.PI/2;
  var out=grp();out.add(r);
  /* The stock points forward (+z) in the grip; stand it upright so it reads at the hip and in the hand. */
  return {hand:finish(out)};
};

/* ---------- firearms ---------- */
G.families.firearm=function(P,C){
  P=def(P,{barrel:14,stock:true});C=def(C,{wood:0x6b4a2e,metal:0x5d6670});
  var g=grp();
  B(g,0,P.barrel/2,0,1.1,P.barrel,1.1,C.metal);
  B(g,0,-1.4,0,1.5,4,1.3,C.wood);if(P.stock)B(g,0,-4.4,-.8,1.4,3.4,2,C.wood);
  return {hand:finish(g)};
};

/* ---------- sling and whip ---------- */
G.families.sling=function(P,C){
  C=def(C,{cord:0x8a6a42,pouch:0x6b4a2e});var g=grp();
  B(g,0,0,0,.5,5,.5,C.cord);B(g,0,3,0,1.6,1.2,1.6,C.pouch);B(g,0,-2.8,0,.9,.9,.9,C.pouch);
  return {hand:finish(g)};
};
G.families.whip=function(P,C){
  C=def(C,{handle:0x3b2616,cord:0x8a6a42});var g=grp(),i;
  B(g,0,0,0,1,4,1,C.handle);
  for(i=0;i<8;i++)B(g,Math.sin(i*.9)*1.1,3+i*1.1,.6+i*.35,.5,1.2,.5,C.cord);
  return {hand:finish(g)};
};

/* ---------- shields (forearm mount; the face looks toward +z) ---------- */
G.families.shield=function(P,C){
  P=def(P,{w:7.4,h:9.6,round:false});
  C=def(C,{rim:0xf0b94d,face:0x2f5d9e,mark:0xe8dcc0,boss:0xf0b94d});
  var g=grp();
  B(g,0,0,0,P.w,P.h,1,C.rim);
  B(g,0,0,.35,P.w-1.4,P.h-1.4,1,C.face);
  B(g,0,0,.7,P.w-1.4,1,1,C.mark);B(g,0,0,.7,1,P.h-1.4,1,C.mark);
  B(g,0,0,1.1,2.4,2.4,.8,C.boss);
  if(!P.round){B(g,0,-P.h/2-.2,0,P.w*.45,.8,1,C.rim)}
  return {forearm:finish(g)};
};

/* ---------- body armor ----------
   style  'mail' | 'plate' | 'leather' | 'cloth' | 'scale' | 'hide' decides the surface pattern on the torso shell.
   One piece for the torso (with shoulders, skirt and optional tabard and belt) and one sleeve for each arm. */
G.families.armor=function(P,C){
  P=def(P,{style:'mail',depth:5.8,width:9.8,height:8.6,sleeve:6.4,pauldrons:true,skirt:0,tabard:false,cuirass:0});
  C=def(C,{main:0xaab4c0,alt:0x7d8896,trim:0xf0b94d,tabard:0xa8322b,tabardTrim:0xf0b94d});
  var body=grp(),y=3.5,i,rows;
  B(body,0,y,0,P.width,P.height,P.depth,C.main);
  var z=P.depth/2+.12;
  if(P.style==='mail'||P.style==='scale'){
    rows=Math.floor(P.height/1.0);
    for(i=0;i<rows;i+=2)B(body,0,y-P.height/2+.5+i,0,P.width+.3,.5,P.depth+.3,C.alt);
    B(body,0,y-P.height/2+.35,0,P.width+.4,.7,P.depth+.4,C.alt);
  }else if(P.style==='plate'){
    B(body,0,y+.6,z,P.width-2,P.height-1.6,.4,C.alt);B(body,0,y,z+.1,.8,P.height-.8,.4,C.trim);
    B(body,0,y+P.height/2-.3,0,P.width+.3,.6,P.depth+.3,C.alt);
  }else if(P.style==='leather'||P.style==='hide'||P.style==='cloth'){
    for(i=-3;i<=3;i+=2)B(body,i*1.2,y,z,.5,P.height-.6,.3,C.alt);
    if(P.style!=='cloth')[-1,1].forEach(function(s){B(body,s*3.4,y+1.4,z+.1,.6,.6,.3,C.trim)});
  }
  if(P.cuirass)B(body,0,y+P.height/2-.4,0,P.width+.4,.8,P.depth+.4,C.alt);
  if(P.tabard){B(body,0,y-.2,z+.2,3.6,P.height,.4,C.tabard);B(body,0,y-.2,z+.45,.8,P.height,.2,C.tabardTrim)}
  if(P.skirt)B(body,0,y-P.height/2-P.skirt/2+.2,0,P.width+.4,P.skirt,P.depth+.4,C.main);
  if(P.pauldrons)[-1,1].forEach(function(s){B(body,s*5.8,y+4.1,0,4,2,P.depth+.1,C.main);B(body,s*5.8,y+5.2,0,4.2,.5,P.depth+.3,C.trim)});
  var arms={};
  [['armL',1],['armR',-1]].forEach(function(a){
    var s=grp();
    if(P.sleeve>0)B(s,0,-P.sleeve/2+.4,0,3.9,P.sleeve,4.1,C.main);
    if(P.sleeve>0&&(P.style==='mail'||P.style==='scale'))B(s,0,-P.sleeve+.4,0,4.2,.6,4.4,C.alt);
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
  if(opts.ground&&parts.hand){g.rotation.z=Math.PI/2}
  return g;
};

/* Frees the per-instance buffers of a model built by build(); geometry and materials are shared and stay. */
G.dispose=function(obj){
  if(!obj)return;
  obj.traverse(function(o){if(o.isInstancedMesh&&typeof o.dispose==='function')o.dispose()});
  if(obj.parent)obj.parent.remove(obj);
};
})();
