/* The last prop kinds: spellcasting foci and holy symbols, the artisan's and specialist kits, musical instruments, gaming sets, and the
   packs. A kit is a case with the emblem of its trade standing on it (an anvil and hammer, a brush, a loupe), so thirty-seven tools
   read apart at a glance; an instrument is drawn as itself. See gear-props.js for the rules every prop kind follows. */
(function(){
var G=Fable.gear,K=G.kit,S=K.S,seg=K.seg,arc=K.arc,ring=K.ring,def=K.def,shade=K.shade,props=G.props,tilt=props.tilt;

/* ---------- foci ---------- */
props.focus=function(g,P,C){
  P=def(P,{form:'crystal'});
  C=def(C,{gem:0x7a5ad8,glow:0xc4b0ff,wood:0x7a5834,metal:0xc9a24a,dark:0x5a3e22,leaf:0x4f8a3a,berry:0xe8dcc0,bind:0x3b2616});
  var f=P.form,i;
  if(f==='crystal'){
    S(g,'cyl',0,.5,0,4.6,1,4.6,C.metal,[.8,.8]);S(g,'cyl',0,1.4,0,3.2,.8,3.2,C.dark);
    S(g,'cyl',0,3.4,0,2.6,3.4,2.6,C.gem,[.8,.8],true);S(g,'cyl',0,6,0,2.1,2.8,2.1,C.gem,[.1,.1],true);
    S(g,'cyl',-1,3.6,.8,.7,2.4,.5,C.glow,[.9,.9],true);
    for(i=0;i<3;i++){var a=i*2.1+.4;seg(g,[Math.cos(a)*1.9,1.6,Math.sin(a)*1.9],[Math.cos(a)*1.4,4.2,Math.sin(a)*1.4],.5,.5,C.metal)}
    return g;
  }
  if(f==='orb'){
    S(g,'cyl',0,.4,0,5,.8,5,C.dark,[.9,.9]);S(g,'cyl',0,1.2,0,3.4,1,3.4,C.metal,[.7,.7]);
    S(g,'ell',0,4.7,0,5.6,5.6,5.6,C.gem,[1,1],true);S(g,'ell',-.9,5.7,1.6,1.8,1.6,1.2,C.glow,[1,1],true);
    for(i=0;i<4;i++){var b=i*Math.PI/2+.4;seg(g,[Math.cos(b)*1.2,1.8,Math.sin(b)*1.2],[Math.cos(b)*2.8,3.9,Math.sin(b)*2.8],.55,.55,C.metal)}
    ring(g,0,4.7,0,3.1,.5,.5,C.metal,14);
    return g;
  }
  if(f==='rod'){
    seg(g,[0,-4,0],[0,8,0],1.1,1.1,C.metal,{k:'cyl'});
    for(i=0;i<5;i++)S(g,'cyl',0,-3+i*2.6,0,1.45,.6,1.45,i%2?C.dark:C.metal);
    S(g,'ell',0,9.1,0,2.6,2.8,2.6,C.gem,[1,1],true);S(g,'cyl',0,8.1,0,2,.7,2,C.dark);
    S(g,'ell',0,-4.5,0,1.6,1.2,1.6,C.dark);
    return g;
  }
  if(f==='staff'){
    seg(g,[0,-8,0],[0,10,0],1.1,1.1,C.wood,{k:'cyl',taper:[.85,.85]});
    for(i=0;i<3;i++)S(g,'ell',(i%2?.5:-.5),-4+i*5,.2,.8,1.1,.8,C.dark);
    S(g,'cyl',0,-1,0,1.5,3.2,1.5,C.bind);
    [[-1,0],[1,0],[0,1],[0,-1]].forEach(function(d){
      seg(g,[d[0]*.5,10,d[1]*.5],[d[0]*1.6,12.2,d[1]*1.6],.9,.9,C.wood,{taper:[.7,.7]});seg(g,[d[0]*1.6,12.2,d[1]*1.6],[d[0]*.9,14.2,d[1]*.9],.7,.7,C.wood,{taper:[.6,.6]});
    });
    S(g,'ell',0,12.4,0,2.6,2.8,2.6,C.gem,[1,1],true);
    return g;
  }
  if(f==='wand'){
    seg(g,[-3,-5,0],[2.4,8,0],1,1,C.wood,{k:'cyl',taper:[.5,.5]});
    seg(g,[-3,-5,0],[-2.6,-3.4,0],1.5,1.5,C.metal,{k:'cyl'});S(g,'ell',-3.1,-5.3,0,1.8,1.4,1.8,C.dark);
    S(g,'ell',2.6,8.4,0,1,1,1,C.gem,[1,1],true);
    S(g,'ell',-.3,1.2,.2,.7,.9,.7,C.dark);
    return g;
  }
  if(f==='mistletoe'){
    /* a sprig: a forked stem with paired oval leaves and white berries */
    seg(g,[0,0,0],[0,4,0],.6,.6,C.wood,{k:'cyl'});
    [[-2.4,8],[2.4,8],[0,9]].forEach(function(p){seg(g,[0,4,0],[p[0],p[1],0],.55,.55,C.wood,{k:'cyl'})});
    S(g,'cyl',0,.9,0,1.3,1.4,1.3,C.bind);
    var pairs=[[0,4.8,-1],[0,4.8,1],[-1.2,6.4,-1],[-1.4,6.4,1],[1.2,6.4,-1],[1.4,6.4,1],[-2.4,8.3,-1],[-2.4,8.3,1],[2.4,8.3,-1],[2.4,8.3,1],[0,9.3,0]];
    pairs.forEach(function(p,i){var l=S(g,'ell',p[0]+(p[2]*1.3),p[1]+.5,i%2?.5:-.5,1.6,3,.6,C.leaf);l.rotation.z=p[2]*-.5})
    ;[[-.4,5.6],[.5,5.7],[-1.3,7.4],[1.5,7.3],[0,8.6]].forEach(function(p){S(g,'ell',p[0],p[1],.9,1,1,1,C.berry)});
    return g;
  }
  if(f==='yew'){
    seg(g,[-3,-5,0],[2.6,9,0],1.1,1.1,C.wood,{k:'cyl',taper:[.4,.4]});
    S(g,'cyl',-2.4,-3.4,0,1.6,3,1.6,C.bind).rotation.z=-.38;
    [[-1,-.4],[.6,2.2],[1.5,5.2]].forEach(function(p){S(g,'ell',p[0]+.5,p[1]+.8,.3,.7,1,.7,C.dark)});
    seg(g,[2.6,9,0],[3.6,10.6,.4],.5,.5,C.wood,{k:'cyl'});
    S(g,'ell',1,5.5,.5,1.4,.7,.5,C.leaf).rotation.z=.6;S(g,'ell',-.7,2,.5,1.4,.7,.5,C.leaf).rotation.z=-.6;
    return g;
  }
};
props.holy=function(g,P,C){
  P=def(P,{form:'amulet'});
  C=def(C,{gold:0xe0b04a,dark:0xa8782a,gem:0xc43a34,cord:0x5a3418,silver:0xc4ccd4,glass:0xcfe4ee,wood:0x6a4a28,bone:0xe8dcc0});
  var f=P.form;
  if(f==='amulet'){
    [[-.9,5.2,-3.4,9],[-3.4,9,0,12],[0,12,3.4,9],[3.4,9,.9,5.2]].forEach(function(c){seg(g,[c[0],c[1],0],[c[2],c[3],0],.55,.55,C.cord)});
    S(g,'cyl',0,2.6,0,5,1.1,5,C.gold).rotation.x=Math.PI/2;
    S(g,'cyl',0,2.6,.2,3.6,1.3,3.6,C.dark).rotation.x=Math.PI/2;
    S(g,'ell',0,2.6,.7,2,2,.9,C.gem,[1,1],true);
    for(var i=0;i<8;i++){var a=i*Math.PI/4;S(g,'ell',Math.cos(a)*2.9,2.6+Math.sin(a)*2.9,0,.9,.9,.7,C.gold)}
    S(g,'ell',0,5.6,0,1.1,1,.7,C.gold);
    return tilt(g,0,-.3,0);
  }
  if(f==='emblem'){
    /* a shield-shaped plate with a sunburst */
    S(g,'box',0,4,0,6.4,6.6,.9,C.silver,[.8,1]);S(g,'ell',0,1.4,0,6,3,.9,C.silver);
    S(g,'box',0,4.2,.5,5.2,5.4,.5,C.dark,[.8,1]);S(g,'ell',0,1.9,.5,4.8,2.4,.5,C.dark);
    S(g,'ell',0,4,.9,2.2,2.2,.5,C.gold,[1,1],true);
    for(var j=0;j<8;j++){var b=j*Math.PI/4;seg(g,[Math.cos(b)*1.4,4+Math.sin(b)*1.4,1],[Math.cos(b)*2.5,4+Math.sin(b)*2.5,1],.55,.4,C.gold,{taper:[.3,.3]})}
    S(g,'cyl',0,7.9,0,1.4,.9,.9,C.silver).rotation.x=Math.PI/2;
    return tilt(g,0,-.35,0);
  }
  /* reliquary: a small gilded casket with a glass window and a spire */
  S(g,'box',0,1.6,0,6.2,3,3.4,C.gold);S(g,'box',0,.4,0,6.6,.8,3.8,C.dark);
  S(g,'box',0,2,1.75,3.8,1.7,.3,C.glass);S(g,'box',0,2,1.6,1.2,1,.2,C.bone);
  var r=S(g,'box',0,4.1,0,5.2,.6,3.4,C.dark);
  [-1,1].forEach(function(s){S(g,'box',s*1.5,4.6,0,3.6,.6,3,C.gold).rotation.z=s*-.7});
  S(g,'cyl',0,6.6,0,.5,2.4,.5,C.gold);S(g,'box',0,7.3,0,2.2,.5,.5,C.gold);S(g,'box',0,6.8,0,.5,2.4,.5,C.gold);
  S(g,'ell',0,5.6,0,1.2,1.2,1.2,C.gem,[1,1],true);
  [-1,1].forEach(function(s){S(g,'ell',s*3.2,3.1,1.7,.8,.8,.6,C.gem,[1,1],true)});
  return tilt(g,0,-.35,0);
};

/* ---------- artisan and specialist kits ----------
   a case (leather or wood, with a latch and a handle) and a trade emblem standing on or in front of it: P.trade picks the emblem */
var EMBLEMS={
  anvil:function(g,C){S(g,'box',0,.6,0,3.6,1.2,2,C.iron);S(g,'box',0,1.8,0,2,1.4,1.6,C.iron);S(g,'box',-.3,2.9,0,4.8,1,1.9,C.iron)},
  hammer:function(g,C){seg(g,[0,0,0],[0,5,0],.7,.7,C.wood,{k:'cyl'});S(g,'box',0,5.3,0,2.6,1.4,1.3,C.iron)},
  chisel:function(g,C){seg(g,[0,0,0],[0,3.5,0],1,1,C.wood,{k:'cyl'});seg(g,[0,3.5,0],[0,6,0],.8,.5,C.iron,{taper:[1.4,1]});S(g,'ell',0,-.2,0,1.2,.9,1.2,C.wood)},
  brush:function(g,C){seg(g,[0,0,0],[0,5,0],.55,.55,C.wood,{k:'cyl',taper:[1.4,1.4]});S(g,'cyl',0,5.2,0,.9,1.2,.9,C.iron);S(g,'ell',0,6.4,0,1.1,2.6,1.1,C.accent,[.1,.1])},
  quill:function(g,C){seg(g,[0,0,0],[.5,8,0],.4,.4,C.paper,{k:'cyl'});S(g,'ell',.4,6.2,0,1.6,4,.4,C.paper);S(g,'ell',-.2,.1,0,.5,.5,.5,C.accent)},
  mortar:function(g,C){S(g,'cyl',0,1.5,0,4,3,4,C.stone,[1.25,1.25]);S(g,'ell',0,2.8,0,3.2,.6,3.2,C.dark);S(g,'cyl',0,0,0,3.4,.5,3.4,C.stone);
    seg(g,[.6,2.8,0],[2.6,7,.4],.9,.9,C.stone,{k:'cyl',taper:[.7,.7]});S(g,'ell',2.7,7.2,.4,1.4,1.2,1.4,C.stone)},
  mug:function(g,C){S(g,'cyl',0,1.9,0,3.2,3.8,3.2,C.wood,[1.1,1.1]);S(g,'cyl',0,3.6,0,3.3,.4,3.3,C.accent);S(g,'cyl',0,1,0,3.1,.4,3.1,C.iron);arc(g,1.7,2,1.1,-1.5,1.5,6,.6,.6,C.wood);S(g,'cyl',0,3.85,0,2.6,.2,2.6,C.paper)},
  pot:function(g,C){S(g,'ell',0,1.6,0,4.2,3.2,4.2,C.iron);S(g,'cyl',0,3,0,3.6,.6,3.6,C.dark);seg(g,[2,2.4,0],[5,1.8,0],.7,.7,C.wood,{k:'cyl'});S(g,'ell',-.9,2.2,1.5,.7,1.4,.5,C.paper)},
  needle:function(g,C){S(g,'cyl',0,1.2,0,2.6,2.4,2.6,C.accent);S(g,'cyl',0,.2,0,3,.5,3,C.wood);S(g,'cyl',0,2.5,0,3,.5,3,C.wood);seg(g,[.7,2.6,0],[2,6.4,0],.3,.3,C.iron);seg(g,[2,6.4,0],[2.6,6.6,0],.3,.3,C.iron);S(g,'ell',-.7,7,0,.7,2.4,.3,C.iron)},
  saw:function(g,C){S(g,'box',0,3,0,.5,5.2,2.2,C.iron,[1,.5]);seg(g,[0,.3,0],[0,5.5,0],.4,1.8,C.iron,{taper:[1,.55]});S(g,'cyl',0,5.6,-1.4,.9,2,.9,C.wood).rotation.x=Math.PI/2;
    for(var i=0;i<6;i++)S(g,'box',0,.5+i*.7,-.95,.4,.45,.5,C.iron)},
  compass:function(g,C){S(g,'cyl',0,.8,0,5,1.4,5,C.brass);S(g,'cyl',0,1.55,0,4.2,.3,4.2,C.paper);
    seg(g,[0,1.9,-1.7],[0,1.9,1.7],.6,.3,C.accent,{taper:[.4,1]});seg(g,[-.1,1.9,-1.7],[-.1,1.9,1.7],.2,.2,C.iron);S(g,'cyl',0,2.1,0,.6,.5,.6,C.brass);
    S(g,'ell',0,3.2,0,1.3,1.3,.5,C.brass);S(g,'box',0,2.3,0,.4,1.4,.4,C.brass)},
  loupe:function(g,C){var l=K.grp();S(l,'cyl',0,0,0,3.8,.6,3.8,C.brass);S(l,'cyl',0,0,0,3,.7,3,C.glass);l.rotation.x=Math.PI/2;l.position.y=5.2;g.add(l);seg(g,[0,3.2,0],[0,0,0],.8,.8,C.wood,{k:'cyl'});S(g,'ell',-.4,5.9,.5,1,.3,.5,C.paper)},
  pipe:function(g,C){seg(g,[0,0,0],[0,6.4,0],.8,.8,C.glass,{k:'cyl'});S(g,'ell',0,.7,0,2.8,2.6,2.8,C.glass);S(g,'ell',0,7,0,1,.9,1,C.glass);S(g,'ell',0,.7,0,1.8,1.5,1.8,C.accent,[1,1],true)},
  tongs:function(g,C){[-1,1].forEach(function(s){seg(g,[s*.2,0,0],[s*1.6,3.2,0],.7,.7,C.iron);seg(g,[s*1.6,3.2,0],[s*.3,6.4,0],.8,.7,C.iron)});S(g,'cyl',0,2.6,0,.8,.8,.8,C.dark).rotation.x=Math.PI/2;S(g,'ell',-.3,-.1,0,1,.8,.8,C.dark)},
  mask:function(g,C){S(g,'ell',0,3.4,0,4.4,5.4,1.1,C.paper);S(g,'ell',-1.1,4,.7,1.1,.6,.4,C.dark);S(g,'ell',1.1,4,.7,1.1,.6,.4,C.dark);S(g,'box',0,3,.65,.6,1.6,.3,C.paper);S(g,'ell',0,1.5,.65,1.9,.6,.3,C.accent);S(g,'box',0,6.2,0,3.6,1,.9,C.accent,[1,.7])},
  leaf:function(g,C){seg(g,[0,0,0],[0,5,0],.5,.5,C.wood,{k:'cyl'});[[-1,2,.7],[1,2.6,-.7],[-1.2,4,.9],[1.1,4.4,-.9]].forEach(function(p){S(g,'ell',p[0],p[1],0,2.2,3.4,.5,C.accent).rotation.z=p[2]});S(g,'ell',0,6,0,2,3.4,.5,C.accent)},
  vial:function(g,C){S(g,'cyl',0,2,0,1.8,3.6,1.8,C.glass);S(g,'cyl',0,1.5,0,1.5,2.4,1.5,C.accent,[1,1],true);S(g,'cyl',0,4.2,0,1.2,1,1.2,C.wood);S(g,'ell',2,1.2,.4,2,2,2,C.glass);S(g,'ell',2,.9,.4,1.6,1.4,1.6,C.accent)},
  picks:function(g,C){[[-1.4,.3],[0,.15],[1.4,0],[2.6,-.15]].forEach(function(p,i){seg(g,[p[0],0,0],[p[0]+p[1],5.2-i*.5,0],.4,.4,C.iron,{k:'cyl'});S(g,'ell',p[0],-.1,0,1,.9,1,C.wood);S(g,'box',p[0]+p[1]+.2,5.2-i*.5,0,.9,.4,.4,C.iron)})},
  gear:function(g,C){S(g,'cyl',0,1.2,0,5,1.2,5,C.brass);for(var i=0;i<8;i++){var a=i*Math.PI/4;S(g,'box',Math.cos(a)*2.7,1.2,Math.sin(a)*2.7,1,1.2,1,C.brass)}S(g,'cyl',0,1.2,0,1.6,1.4,1.6,C.dark);S(g,'cyl',2.2,3.4,.5,3,.8,3,C.iron).rotation.x=.4},
  spool:function(g,C){S(g,'cyl',0,.5,0,4.4,.6,4.4,C.wood);S(g,'cyl',0,4.5,0,4.4,.6,4.4,C.wood);S(g,'cyl',0,2.5,0,3.4,3.6,3.4,C.accent);for(var i=0;i<4;i++)S(g,'cyl',0,1.2+i*.85,0,3.5,.2,3.5,shade(C.accent,.8))},
  vase:function(g,C){S(g,'ell',0,2.6,0,4.6,4.6,4.6,C.accent);S(g,'cyl',0,5.2,0,1.8,2,1.8,C.accent,[1.7,1.7]);S(g,'cyl',0,.2,0,2.4,.5,2.4,shade(C.accent,.7));S(g,'cyl',0,2.6,0,4.7,.4,4.7,C.paper)},
  trowel:function(g,C){seg(g,[0,0,0],[0,3,0],.9,.9,C.wood,{k:'cyl'});seg(g,[0,3,0],[0,6,0],.4,.3,C.iron);seg(g,[0,3.4,0],[0,7.8,0],3,.35,C.iron,{taper:[0,1]})},
  knife:function(g,C){seg(g,[0,0,0],[0,3.6,0],1.1,1,C.wood,{k:'cyl'});seg(g,[0,3.6,0],[0,8,0],1.1,.4,C.iron,{taper:[.3,1]});S(g,'ell',0,-.2,0,1.4,1,1.2,C.wood)},
  keg:function(g,C){S(g,'cyl',0,2,0,4.6,2.6,4.6,C.wood,[1.12,1.12]);S(g,'cyl',0,4.2,0,5.1,2.2,5.1,C.wood,[.9,.9]);S(g,'cyl',0,1.1,0,4.7,.5,4.7,C.iron);S(g,'cyl',0,5.2,0,4.7,.5,4.7,C.iron);S(g,'cyl',1.5,2.2,2.2,.9,1.4,.9,C.brass).rotation.x=1.2},
  dice:function(g,C){[[-1.2,0,.4,.5],[1.5,0,-.4,-.3],[.2,0,1.8,.9]].forEach(function(p){var c=S(g,'box',p[0],1.2,p[2],2,2,2,C.paper);c.rotation.y=p[3]})}
};
EMBLEMS.shears=EMBLEMS.tongs;EMBLEMS.awl=EMBLEMS.needle;EMBLEMS.plane=EMBLEMS.chisel;EMBLEMS.stylus=EMBLEMS.quill;
props.toolkit=function(g,P,C){
  P=def(P,{trade:'hammer',w:9,h:3.6,d:5.6,wood:false,roll:false});
  C=def(C,{leather:0x7a4a2a,dark:0x5a3418,brass:0xc9a24a,strap:0x3b2616,iron:0x7a838c,wood:0x8a5f34,paper:0xe8dcc0,stone:0x8a8f95,glass:0xcfe4ee,accent:0x6a8ad0});
  var w=P.w,h=P.h,d=P.d,base=C.leather;
  if(P.wood)base=C.wood;
  if(P.roll){
    /* a tool roll: a flat leather wrap tied with a strap, the trade's emblem poking out of the top */
    S(g,'cyl',0,2.2,0,5,w,5,base).rotation.z=Math.PI/2;
    [-w*.3,w*.3].forEach(function(x){S(g,'cyl',x,2.2,0,5.4,.8,5.4,C.strap).rotation.z=Math.PI/2;S(g,'box',x,4.8,0,.9,.5,.4,C.brass)});
    S(g,'cyl',w/2,2.2,0,4.4,.4,4.4,shade(base,.7)).rotation.z=Math.PI/2;
    var em=K.grp();(EMBLEMS[P.trade]||EMBLEMS.hammer)(em,C);em.position.set(0,3.8,0);em.scale.setScalar(1.35);g.add(em);
    return tilt(g,0,.4,0);
  }
  S(g,'box',0,h*.35,0,w,h*.7,d,base);
  S(g,'box',0,h*.78,0,w+.4,h*.44,d+.4,shade(base,1.12),[.95,.95]);
  S(g,'box',0,h*.58,0,w+.6,.4,d+.6,C.dark);
  [-1,1].forEach(function(s){S(g,'box',s*w*.5,h*.6,0,.7,h*.9,d*.7,C.brass);S(g,'box',s*w*.36,h*.45,d/2+.1,.8,h*.8,.3,C.strap)});
  S(g,'box',0,h*.58,d/2+.25,1.6,1.4,.45,C.brass);S(g,'box',0,h*.58,d/2+.5,.5,.7,.3,C.dark);
  arc(g,0,h*1.05,w*.2,.12,Math.PI-.12,8,.7,.7,C.strap);
  [[-w/2,-d/2],[w/2,-d/2],[-w/2,d/2],[w/2,d/2]].forEach(function(c){S(g,'box',c[0],.4,c[1],1,.8,1,C.brass);S(g,'box',c[0],h,c[1],1,.8,1,C.brass)});
  var em2=K.grp();(EMBLEMS[P.trade]||EMBLEMS.hammer)(em2,C);em2.position.set(-w*.1,h*1.28,-d*.02);em2.scale.setScalar(1.35);g.add(em2);
  return tilt(g,.12,-.4,0);
};

/* ---------- instruments ---------- */
props.instrument=function(g,P,C){
  P=def(P,{form:'lute'});
  C=def(C,{wood:0xa8683a,dark:0x5e3a1e,neck:0x3b2616,string:0xe8dcc0,metal:0xc9a24a,hole:0x1e140a,skin:0xe0d0a8,rope:0xb89860,red:0x8a2a2a,tube:0xc8a060,green:0x3a6a4a});
  var f=P.form,i;
  var put=function(o){return tilt(o,0,-.3,0)};
  if(f==='lute'){
    S(g,'ell',0,3.4,0,7,7.4,3.6,C.wood,[1,1]);S(g,'ell',-.2,3.2,-.8,6.2,6.6,2.4,shade(C.wood,.85));
    S(g,'cyl',0,3.2,1.6,2.4,.3,2.4,C.hole).rotation.x=Math.PI/2;
    for(i=0;i<6;i++)S(g,'ell',-.9+i*.6,3.2,1.75,.14,.14,.14,C.hole);
    seg(g,[0,6,.3],[0,13.5,.3],1.7,.9,C.neck,{taper:[.75,.8]});
    for(i=0;i<6;i++)S(g,'box',0,7.2+i*1,.9,1.9-i*.06,.15,.2,C.metal);
    S(g,'box',0,13.9,-.5,2,1.8,.9,C.neck,[1,1]);seg(g,[0,14.4,-.5],[0,16,-1.7],1.8,.9,C.neck);
    [-1,1].forEach(function(s){for(i=0;i<3;i++)S(g,'cyl',s*1.2,13.6+i*.7,-.4,.6,.5,.6,C.dark).rotation.z=Math.PI/2});
    S(g,'box',0,1.1,1.3,3.2,.5,.8,C.dark);
    for(i=0;i<6;i++)seg(g,[-.6+i*.24,1.1,1.8],[-.4+i*.16,14,.9],.14,.14,C.string);
    return put(g);
  }
  if(f==='lyre'){
    S(g,'box',0,.7,0,5,1.3,2.6,C.wood);
    arc(g,-3.5,6,5.2,-.5,Math.PI*.55,9,1,1,C.wood);arc(g,3.5,6,5.2,Math.PI*.45,Math.PI+.5,9,1,1,C.wood);
    S(g,'ell',-3.9,11.2,0,1.5,1.2,1.5,C.metal);S(g,'ell',3.9,11.2,0,1.5,1.2,1.5,C.metal);
    S(g,'box',0,10.2,0,8.4,1,1.3,C.dark);
    for(i=0;i<7;i++){var x=-3+i;seg(g,[x*.9,1.4,.8],[x*1.1,9.8,.5],.14,.14,C.string)}
    for(i=0;i<7;i++)S(g,'ell',(-3+i)*1.1,10.2,.7,.5,.5,.5,C.metal);
    return put(g);
  }
  if(f==='flute'){
    var fl=K.grp();
    S(fl,'cyl',0,0,0,1.3,15,1.3,C.tube).rotation.z=Math.PI/2;
    S(fl,'cyl',-7.5,0,0,1.7,.6,1.7,C.metal).rotation.z=Math.PI/2;S(fl,'cyl',7.5,0,0,1.7,.6,1.7,C.metal).rotation.z=Math.PI/2;
    S(fl,'ell',-5.4,.7,0,1.4,.5,1,C.hole);
    for(i=0;i<6;i++)S(fl,'cyl',-1.4+i*1.5,.65,0,.7,.3,.7,C.hole);
    S(fl,'cyl',-2.8,0,0,1.6,.4,1.6,C.metal).rotation.z=Math.PI/2;S(fl,'cyl',3.4,0,0,1.6,.4,1.6,C.metal).rotation.z=Math.PI/2;
    fl.position.y=5;fl.rotation.z=.5;g.add(fl);return g;
  }
  if(f==='panflute'){
    for(i=0;i<7;i++){var hh=10-i*1.1;S(g,'cyl',-4.5+i*1.5,hh/2,0,1.4,hh,1.4,i%2?C.tube:shade(C.tube,.9));S(g,'ell',-4.5+i*1.5,hh,0,1,.3,1,C.hole)}
    [2.8,6.5].forEach(function(y){S(g,'box',0,y,.8,10.6,.7,.5,C.red)});S(g,'box',0,.6,.4,10,.6,1.2,C.dark);
    return put(tilt(g,0,0,-.05));
  }
  if(f==='horn'){
    /* a curled animal horn with a bound mouthpiece and a flared bell */
    arc(g,0,5.5,4.6,Math.PI*.7,Math.PI*1.95,14,function(t){return .8+t*2.6},function(t){return .8+t*2.6},C.skin);
    arc(g,0,5.5,4.6,Math.PI*.7,Math.PI*.9,3,1.1,1.1,C.metal);
    S(g,'cyl',-3.5,8.3,0,1.2,1.4,1.2,C.dark);
    arc(g,0,5.5,4.6,Math.PI*1.82,Math.PI*1.95,2,3.8,3.8,C.metal);
    S(g,'cyl',2.2,2.1,0,2.2,.3,2.2,C.red).rotation.z=.9;
    return tilt(g,0,-.5,0);
  }
  if(f==='drum'){
    S(g,'cyl',0,3.2,0,7.4,6.4,7.4,C.wood,[1,1]);S(g,'cyl',0,6.5,0,8,.5,8,C.metal);S(g,'cyl',0,6.8,0,7.2,.3,7.2,C.skin);S(g,'cyl',0,-.1,0,8,.5,8,C.metal);
    for(i=0;i<10;i++){var a=i/10*Math.PI*2;seg(g,[Math.cos(a)*3.9,6.3,Math.sin(a)*3.9],[Math.cos(a+.32)*3.95,.1,Math.sin(a+.32)*3.95],.35,.35,C.rope);seg(g,[Math.cos(a+.32)*3.95,.1,Math.sin(a+.32)*3.95],[Math.cos(a+.64)*3.9,6.3,Math.sin(a+.64)*3.9],.35,.35,C.rope)}
    seg(g,[-2.8,8.8,1.3],[-1.4,7.1,.5],.8,.8,C.dark,{k:'cyl'});S(g,'ell',-2.9,9,1.4,1.3,1.3,1.3,C.dark);
    seg(g,[2.4,8.8,-1],[1.2,7.1,-.2],.8,.8,C.dark,{k:'cyl'});S(g,'ell',2.5,9,-1.1,1.3,1.3,1.3,C.dark);
    return g;
  }
  if(f==='dulcimer'){
    var d=K.grp();
    S(d,'box',0,0,0,12,1.4,5,C.wood,[.55,1]);S(d,'box',0,.8,0,10.6,.35,4.2,shade(C.wood,1.15),[.55,1]);
    for(i=0;i<2;i++)[-1,1].forEach(function(s){S(d,'ell',s*1.6-s*i*.3,.95,0,1.1,.3,1.1,C.hole)});S(d,'ell',0,.95,0,1.6,.3,1.6,C.hole);
    S(d,'box',-3.4,1,0,.8,.8,4.4,C.dark);S(d,'box',3.1,1,0,.8,.8,4.2,C.dark);
    for(i=0;i<6;i++)seg(d,[-3.4,1.5,-1.8+i*.72],[3.1,1.5,-1.8+i*.72],.14,.14,C.string);
    [-1,1].forEach(function(s){S(d,'box',s*5.5,.8,0,.5,.8,4.6,C.dark)});
    d.position.y=2.4;d.rotation.z=.18;d.rotation.x=.55;d.scale.setScalar(.9);g.add(d);return g;
  }
  if(f==='bagpipes'){
    S(g,'ell',0,3.6,0,8,5.6,4.6,C.red);S(g,'ell',-1.4,4.4,1.5,2.4,2.2,1.2,shade(C.red,1.35));
    S(g,'cyl',0,3.6,0,8.2,.5,4.8,C.metal).rotation.z=0;
    S(g,'cyl',-2.2,9.4,-.4,.8,7,.8,C.dark);S(g,'cyl',0,10.4,-.4,.8,9,.8,C.dark);S(g,'cyl',2.2,9.4,-.4,.8,7,.8,C.dark);
    [-2.2,0,2.2].forEach(function(x,k){S(g,'cyl',x,6.1+k*0,-.4,1.3,.6,1.3,C.metal);S(g,'ell',x,13+k*0-(k%2?0:1.4),-.4,1.4,.8,1.4,C.dark)});
    S(g,'cyl',3.8,1.4,.9,.9,5,.9,C.dark).rotation.z=-.9;
    seg(g,[-3.4,2.2,.8],[-6.2,-.4,1.6],.9,.9,C.dark,{k:'cyl'});S(g,'ell',-6.4,-.6,1.7,1.3,1,1.3,C.metal);
    for(i=0;i<4;i++)S(g,'ell',3.7+i*.1,.9+.5*i,.9+.1*i,.45,.45,.45,C.hole);
    return tilt(g,0,-.4,0);
  }
  if(f==='shawm'){
    var s=K.grp();
    S(s,'cyl',0,0,0,1.5,12,1.5,C.wood,[1.05,1.05]).rotation.z=Math.PI/2;
    S(s,'cyl',8,0,0,4.6,3,4.6,C.wood,[1.5,1.5]).rotation.z=Math.PI/2;
    S(s,'cyl',9.5,0,0,5.6,.5,5.6,C.metal).rotation.z=Math.PI/2;
    S(s,'cyl',-6.6,0,0,2.8,.7,2.8,C.metal).rotation.z=Math.PI/2;
    seg(s,[-6.6,0,0],[-8.6,.3,0],.8,.5,C.skin,{taper:[.4,.7]});
    for(i=0;i<5;i++)S(s,'cyl',-3+i*1.9,.75,0,.7,.3,.7,C.hole);
    S(s,'cyl',2.4,0,0,1.8,.4,1.8,C.metal).rotation.z=Math.PI/2;
    s.position.y=5;s.rotation.z=.6;g.add(s);return g;
  }
  if(f==='viol'){
    S(g,'ell',0,2.6,0,6.4,5.6,2.4,C.wood);S(g,'ell',0,6.3,0,5,4.4,2.4,C.wood);S(g,'cyl',0,4.6,0,4.2,.8,2.2,C.dark,[1,1]);
    S(g,'box',-1.7,4.6,1.2,.35,1.4,.3,C.hole);S(g,'box',1.7,4.6,1.2,.35,1.4,.3,C.hole);
    S(g,'box',0,2.6,1.4,2.6,.4,.4,C.dark);
    S(g,'box',0,.5,1.4,2.6,.8,.7,C.dark);
    seg(g,[0,8,.6],[0,15,.6],1.5,.8,C.neck,{taper:[.8,.9]});
    S(g,'box',0,15.3,.2,2,2,1,C.neck);S(g,'ell',0,17,-.1,1.5,2,1.6,C.neck);
    [-1,1].forEach(function(s2){S(g,'cyl',s2*1.2,15.4,.2,.6,.5,.6,C.dark).rotation.z=Math.PI/2});
    for(i=0;i<4;i++)seg(g,[-.5+i*.34,.9,1.8],[-.4+i*.26,15.2,1.3],.13,.13,C.string);
    var bw=K.grp();seg(bw,[-5.5,3,3],[-5,11,3],.5,.5,C.dark,{k:'cyl'});seg(bw,[-5.5,3,3],[-5,11,3],.1,.15,C.string);bw.rotation.z=.05;g.add(bw);
    return put(g);
  }
};

/* ---------- gaming sets ---------- */
props.game=function(g,P,C){
  P=def(P,{form:'dice'});
  C=def(C,{bone:0xece3cc,pip:0x2a1c10,board:0x6a4a2a,light:0xb89a68,dark:0x3a2616,felt:0x2f6a48,red:0xb02a2a,gold:0xe0b04a,blue:0x2f4f9a,card:0xf0e8d0});
  var f=P.form,i;
  if(f==='dice'){
    /* three dice on a small felt, one showing five */
    S(g,'cyl',0,.35,0,10,.7,10,C.felt,[1,1]);S(g,'cyl',0,.8,0,10.4,.3,10.4,C.dark).rotation.x=0;
    function die(x,z,ry,rx,k){
      var d=K.grp();S(d,'box',0,0,0,3.1,3.1,3.1,k,[1,1]);
      [[0,0],[-.8,-.8],[.8,.8],[-.8,.8],[.8,-.8]].forEach(function(p){S(d,'ell',p[0],1.58,p[1],.55,.2,.55,C.pip)});
      [[-.8,.8],[.8,-.8]].forEach(function(p){S(d,'ell',p[0],p[1],1.58,.55,.55,.2,C.pip)});
      S(d,'ell',1.58,0,0,.2,.55,.55,C.pip);
      d.rotation.set(rx,ry,0);d.position.set(x,2.6,z);g.add(d);
    }
    die(-2.4,-1.2,.5,0,C.bone);die(2.4,-.6,-.4,0,C.red);die(0,2.6,.9,0,C.bone);
    return tilt(g,.15,0,0);
  }
  if(f==='chess'){
    S(g,'box',0,.6,0,12,1.2,12,C.dark);
    for(var r=0;r<6;r++)for(var c=0;c<6;c++)S(g,'box',-5+c*2,1.35,-5+r*2,2,.3,2,(r+c)%2?C.light:C.board);
    function piece(x,z,h,k){S(g,'cyl',x,1.5+.3,z,1.5,.6,1.5,k);S(g,'cyl',x,1.5+h*.5,z,.9,h,.9,k,[.7,.7]);S(g,'ell',x,1.5+h,z,1.4,1.4,1.4,k)}
    piece(-3,-3,3.4,C.dark);piece(1,-3,2.4,C.dark);piece(3,-1,4.4,C.gold);
    piece(-1,3,2.6,C.bone);piece(3,3,3.4,C.bone);piece(-3,1,2.2,C.bone);
    var kn=K.grp();S(kn,'cyl',0,.9,0,1.5,.6,1.5,C.gold);S(kn,'ell',0,2.6,0,1.1,3,1.1,C.gold);S(kn,'ell',.5,4,0,1.3,1.2,.8,C.gold);kn.position.set(-1,1.5,-.5);g.add(kn);
    return tilt(g,.35,-.5,0);
  }
  if(f==='cards'||f==='ante'){
    /* five cards fanned from a pivot at the bottom, faces to the front, a card back showing at the edge */
    var back=f==='ante'?C.blue:C.red,n=5;
    for(i=0;i<n;i++){
      var h=K.grp(),c2=K.grp();
      S(c2,'box',0,0,0,3.6,5.2,.2,C.card);S(c2,'box',0,0,-.14,3.2,4.8,.12,back);
      S(c2,'box',0,0,.12,3.2,4.8,.1,0xfbf5e6);
      S(c2,'ell',-.9,1.5,.2,.9,.9,.1,i%2?C.red:C.pip);S(c2,'ell',.9,-1.5,.2,.9,.9,.1,i%2?C.red:C.pip);
      S(c2,'ell',0,0,.22,1.6,1.9,.1,i%2?C.red:C.pip);
      if(f==='ante'){S(c2,'ell',0,0,.3,1.1,1.3,.1,C.gold)}
      c2.position.y=2.9;h.add(c2);h.rotation.z=(i-(n-1)/2)*-.34;h.position.set(0,.4,i*.28);
      g.add(h);
    }
    S(g,'cyl',0,.7,.5,1.1,1.1,1.1,C.gold);
    return g;
  }
};

/* ---------- the packs: a pack frame with the pack's own telltale goods ---------- */
props.pack=function(g,P,C){
  P=def(P,{style:'explorer'});
  C=def(C,{canvas:0x8a6a3e,dark:0x5e4426,strap:0x3b2616,buckle:0xc2a23a,metal:0xa8b0b8,red:0xa8242a,green:0x4f7a4a,paper:0xe8dcc0,gold:0xe0b04a,purple:0x6a3a8a});
  var k=P.style;
  props.backpack(g,{roll:k==='explorer'||k==='dungeoneer'||k==='scholar',pan:k==='explorer',rope:k==='dungeoneer'||k==='burglar'},{canvas:k==='priest'?0xc9bd9a:k==='diplomat'?0x5a3a4a:k==='entertainer'?0x7a3a4a:k==='scholar'?0x3a4a6a:C.canvas,dark:C.dark,strap:C.strap,buckle:C.buckle,metal:C.metal});
  if(k==='burglar'){S(g,'cyl',-4.3,4.8,0,1.6,1.8,1.6,C.metal).rotation.x=Math.PI/2;S(g,'cyl',4.4,3.8,0,2,.6,2,C.metal);for(var i=0;i<3;i++)S(g,'ell',4.3+.1*i,4.2+.5*i,.4,.7,.7,.7,C.metal)}
  if(k==='dungeoneer'){for(var j=0;j<3;j++)seg(g,[4.2,1.4+j*.6,.5+j*.5],[5.2,5.8+j*.3,.7+j*.5],.8,.8,C.dark,{k:'cyl'});S(g,'ell',5.2,6,.9,1.2,1.2,1.2,0xff9a30,[1,1],true)}
  if(k==='priest'){S(g,'box',0,6.1,2.6,2,2.4,.4,C.gold);S(g,'box',0,6.1,2.9,.5,1.8,.3,C.red);S(g,'box',0,6.1,2.9,1.4,.5,.3,C.red);S(g,'cyl',-4.4,4,1.2,1.1,3.2,1.1,C.paper)}
  if(k==='diplomat'){S(g,'box',-.4,5.3,-2.6,4.8,3.2,.8,C.gold);S(g,'cyl',4.4,3.4,0,1.4,5,1.4,C.paper)}
  if(k==='scholar'){S(g,'box',0,.2,0,7.4,.9,4.6,C.dark);S(g,'box',-4.2,6,0,.9,3,3.6,C.red);S(g,'box',-4.8,5.8,0,.8,3.6,3.2,C.green);S(g,'cyl',4.4,4.8,.4,1.5,3,1.5,C.paper)}
  if(k==='entertainer'){S(g,'ell',-5.2,5,0,2.6,6.4,3,C.dark);S(g,'cyl',4.6,4,0,1.1,6.6,1.1,C.paper);S(g,'cyl',-5.2,9.6,0,.6,3,.6,C.dark)}
  return tilt(g,0,-.4,0);
};
})();
