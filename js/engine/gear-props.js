/* The model family for everything that is not a weapon, armor or shield: flasks, scrolls, bags, light, ammunition, camp gear.
   One family, "prop", with a kind in its params that picks the builder: {family:'prop', params:{kind:'bottle', ...}}.
   The builders are in Fable.gear.props (kind -> function(group, params, palette)); js/engine/gear-props-tools.js adds the tools,
   instruments, games and foci. A prop stands upright and is built from the same shaped blocks as the weapons, so it is round where
   the thing is round. Units are the weapon models' units: a flask is about 7 tall, a barrel about 10.
   Every builder fills in its own default palette and params, so a row only names what makes its item different. */
(function(){
var G=Fable.gear,K=G.kit,S=K.S,B=K.B,seg=K.seg,arc=K.arc,ring=K.ring,def=K.def,shade=K.shade,grp=K.grp;
var props=G.props={};

G.families.prop=function(P,C){
  var b=props[P&&P.kind];
  if(!b)throw new Error('Gear: unknown prop kind "'+(P&&P.kind)+'"');
  var g=grp();
  var out=b(g,P,C)||g;
  return {hand:K.finish(out)};
};

/* turns a built group about the origin so a long thing can lean or lie */
function tilt(g,rx,ry,rz){var r=grp();r.add(g);r.rotation.set(rx||0,ry||0,rz||0);return r}
props.tilt=tilt;

/* ---------- bottles: round flask, tall flask, vial, jar, ink pot ----------
   shape, height, radius; liquid (null for an empty bottle), glow (a lit liquid), label (a paper band), skull (a mark on the label) */
props.bottle=function(g,P,C){
  P=def(P,{shape:'round',height:7,radius:2.6,label:false,wax:false,glow:false,empty:false});
  C=def(C,{glass:0xe4f4fa,liquid:0x4f9a52,deep:0x2f6a36,cork:0x9a6a3a,band:0xb8c2cc,paper:0xe8dcc0,ink:0x3b2616,wax:0xa8242a});
  var h=P.height,r=P.radius,y;
  var inner=P.empty?0xa9cddc:C.liquid,low=P.empty?0x82a8b8:C.deep;
  if(P.shape==='vial'){
    /* the liquid is the tube; the glass shows as a bright strip down one side and a clear shoulder above the surface */
    S(g,'cyl',0,h*.4,0,r*1.7,h*.76,r*1.7,inner,[1,1],P.glow);
    S(g,'ell',0,h*.04,0,r*1.7,r*1.1,r*1.7,low);
    S(g,'box',-r*.52,h*.4,r*.8,r*.26,h*.5,.3,P.empty?C.glass:shade(inner,1.45));
    S(g,'cyl',0,h*.9,0,r*1.2,h*.22,r*1.2,C.cork,[1.15,1.15]);
    S(g,'cyl',0,h*.8,0,r*1.7,.45,r*1.7,C.band);
    return;
  }
  if(P.shape==='jar'){
    S(g,'cyl',0,h*.4,0,r*2,h*.8,r*2,C.glass,[.96,.96]);
    if(!P.empty)S(g,'cyl',0,h*.34,0,r*1.7,h*.62,r*1.7,inner,[1,1],P.glow);
    S(g,'cyl',0,h*.86,0,r*2.1,h*.16,r*2.1,C.cork);
    S(g,'ell',0,h*.96,0,r*1.2,h*.1,r*1.2,C.band);
    if(P.label)S(g,'cyl',0,h*.38,0,r*2.06,h*.3,r*2.06,C.paper);
    return;
  }
  if(P.shape==='ink'){
    S(g,'cyl',0,h*.28,0,r*2.1,h*.56,r*2.1,C.glass,[.9,.9]);
    S(g,'cyl',0,h*.24,0,r*1.75,h*.44,r*1.75,C.liquid);
    S(g,'cyl',0,h*.6,0,r*1.1,h*.14,r*1.1,C.glass);
    S(g,'cyl',0,h*.74,0,r*1.2,h*.16,r*1.2,C.cork,[1.1,1.1]);
    /* a quill leans in the neck */
    seg(g,[r*.2,h*.74,0],[r*1.1,h*1.55,r*.3],.45,.35,0xf4efe2,{taper:[.3,1]});
    seg(g,[r*1.1,h*1.55,r*.3],[r*1.9,h*2.2,r*.5],1.4,.3,0xf4efe2,{taper:[.2,.9]});
    return;
  }
  if(P.shape==='tall'){
    /* a wide-shouldered flask that narrows to a long neck */
    S(g,'cyl',0,h*.28,0,r*2.1,h*.5,r*2.1,inner,[.78,.78],P.glow);
    S(g,'ell',0,h*.1,0,r*2.1,h*.24,r*2.1,low);
    S(g,'box',-r*.72,h*.26,r*.86,r*.3,h*.32,.3,P.empty?C.glass:shade(inner,1.45));
    S(g,'cyl',0,h*.66,0,r*.95,h*.34,r*.95,C.glass);
    S(g,'cyl',0,h*.9,0,r*1.05,.5,r*1.05,C.band);
    S(g,'cyl',0,h*.97,0,r*.85,h*.14,r*.85,C.cork,[1.2,1.2]);
    if(P.label)S(g,'cyl',0,h*.2,0,r*2.2,h*.22,r*2.2,C.paper);
    return;
  }
  /* round flask: a ball of liquid under a short glass neck */
  S(g,'ell',0,h*.3,0,r*2,h*.56,r*2,inner,[1,1],P.glow);
  S(g,'ell',0,h*.2,0,r*1.7,h*.3,r*1.7,low);
  S(g,'ell',-r*.5,h*.38,r*.62,r*.5,h*.3,r*.45,C.glass);
  S(g,'ell',r*.3,h*.5,r*.8,r*.3,h*.1,r*.3,C.glass);
  S(g,'cyl',0,h*.66,0,r*.95,h*.22,r*.95,C.glass,[.9,.9]);
  S(g,'cyl',0,h*.78,0,r*1.35,.55,r*1.35,C.band);
  S(g,'cyl',0,h*.9,0,r*.95,h*.2,r*.95,C.cork,[1.15,1.15]);
  if(P.wax)S(g,'ell',0,h*.82,0,r*1.2,h*.2,r*1.2,C.wax);
  if(P.label){S(g,'cyl',0,h*.3,0,r*2.04,h*.2,r*2.04,C.paper);S(g,'box',0,h*.3,r*1.02,r*.5,h*.1,.2,C.ink)}
};

/* ---------- paper: a rolled scroll, a stack of sheets, an unrolled map ---------- */
props.scroll=function(g,P,C){
  P=def(P,{length:9,radius:1.5,seal:true,ribbon:true,rods:true});
  C=def(C,{paper:0xe8dcc0,edge:0xcdb98f,rod:0x7a5834,ribbon:0xa8242a,wax:0xa8242a});
  var L=P.length,r=P.radius,i;
  S(g,'cyl',0,L/2,0,r*2,L,r*2,C.paper);
  S(g,'cyl',0,L-.1,0,r*1.2,.3,r*1.2,C.edge);
  /* the open end shows the spiral of the roll */
  S(g,'cyl',0,L*.0+.2,0,r*1.2,.3,r*1.2,C.edge);
  if(P.rods){S(g,'cyl',0,-.4,0,r*.7,L*.18,r*.7,C.rod);S(g,'ell',0,-1.1,0,r*1.2,r*1.1,r*1.2,C.rod);
    S(g,'cyl',0,L+.4,0,r*.7,L*.18,r*.7,C.rod);S(g,'ell',0,L+1.1,0,r*1.2,r*1.1,r*1.2,C.rod)}
  if(P.ribbon){S(g,'cyl',0,L*.5,0,r*2.15,.9,r*2.15,C.ribbon);
    seg(g,[r*.9,L*.5,r*.6],[r*1.6,L*.5-2.4,r*.9],.5,.2,C.ribbon);seg(g,[r*.5,L*.5,r*.9],[r*.9,L*.5-2.8,r*1.3],.5,.2,C.ribbon)}
  if(P.seal){S(g,'ell',r*.6,L*.5-.3,r*1.05,1.5,1.5,.7,C.wax);S(g,'ell',r*.6,L*.5-.3,r*1.35,.8,.8,.3,shade(C.wax,1.25))}
  return tilt(g,0,0,-.35);
};
props.sheets=function(g,P,C){
  P=def(P,{count:4,w:7,d:9,curl:true,lines:true});
  C=def(C,{paper:0xf0e8d4,edge:0xd9ccaa,ink:0x4a3a28});
  var i;
  for(i=0;i<P.count;i++){
    var o=(i%2?1:-1)*.25*i;
    S(g,'box',o,.3+i*.28,i*.12,P.w,.28,P.d,i%2?C.paper:C.edge);
  }
  var top=.3+P.count*.28;
  if(P.lines)for(i=0;i<5;i++)S(g,'box',-P.w*.05,top+.1,-P.d*.3+i*P.d*.15,P.w*(i===4?.4:.7),.12,.3,C.ink);
  if(P.curl){S(g,'cyl',P.w*.46,top-.3,P.d*.25,.8,P.d*.45,.8,C.paper).rotation.x=Math.PI/2}
  return tilt(g,.25,0,0);
};
props.map=function(g,P,C){
  P=def(P,{w:9,d:7});
  C=def(C,{paper:0xe3d2a6,edge:0xb8a070,land:0x8aa05a,sea:0x6f9cae,path:0xa8242a,rod:0x7a5834});
  S(g,'box',0,.4,0,P.w,.35,P.d,C.paper);
  S(g,'ell',-P.w*.12,.7,P.d*.05,P.w*.55,.3,P.d*.6,C.land);
  S(g,'ell',P.w*.28,.7,-P.d*.2,P.w*.28,.3,P.d*.3,C.land);
  S(g,'ell',-P.w*.3,.72,-P.d*.2,P.w*.18,.3,P.d*.2,shade(C.land,.8));
  S(g,'box',P.w*.1,.9,P.d*.12,.7,.25,.7,C.path);S(g,'box',P.w*.1,.9,P.d*.12,.25,.3,1.6,C.path).rotation.y=.8;S(g,'box',P.w*.1,.9,P.d*.12,.25,.3,1.6,C.path).rotation.y=-.8;
  for(var i=0;i<5;i++)S(g,'box',-P.w*.3+i*P.w*.12,.9,P.d*.28-i*.5,.55,.2,.35,C.path);
  S(g,'cyl',-P.w*.5,.65,0,.9,P.d+.8,.9,C.rod).rotation.x=Math.PI/2;
  S(g,'cyl',P.w*.5,.65,0,.9,P.d+.8,.9,C.rod).rotation.x=Math.PI/2;
  return tilt(g,.45,0,0);
};
props.book=function(g,P,C){
  P=def(P,{w:6.4,h:8.2,thick:2.2,clasp:true,rune:true});
  C=def(C,{cover:0x6a2a24,trim:0xe0b04a,pages:0xeadfc2,pagesShade:0xcdbf98,clasp:0xe0b04a,rune:0xe0b04a});
  var w=P.w,h=P.h,t=P.thick;
  S(g,'box',.15,h/2,0,w-.4,h-.5,t-.7,C.pages);
  for(var i=0;i<4;i++)S(g,'box',.2,h/2,t*.27-i*.3,w-.55,h-.7,.12,C.pagesShade);
  S(g,'box',-w/2+.45,h/2,0,.9,h,t,C.cover);
  S(g,'box',.1,h/2,t/2-.18,w,h,.4,C.cover);S(g,'box',.1,h/2,-t/2+.18,w,h,.4,C.cover);
  S(g,'cyl',-w/2+.4,h/2,0,t*.95,h,t*.95,shade(C.cover,.85),[.9,.9]).rotation.z=0;
  [h*.18,h*.82].forEach(function(y){S(g,'box',-w/2+.45,y,0,1,.35,t+.1,C.trim)});
  [[w/2,0],[w/2,h]].forEach(function(c){S(g,'box',c[0]-.5,c[1]?h-.4:.4,t/2-.2,1.2,.8,.5,C.trim);S(g,'box',c[0]-.5,c[1]?h-.4:.4,-t/2+.2,1.2,.8,.5,C.trim)});
  if(P.rune){S(g,'ell',.1,h*.55,t/2+.15,2.2,2.2,.3,C.rune);S(g,'ell',.1,h*.55,t/2+.3,1.2,1.2,.3,shade(C.cover,.6));S(g,'box',.1,h*.55,t/2+.4,.4,3.2,.3,C.rune)}
  if(P.clasp){S(g,'box',w/2-.1,h/2,0,.4,1.6,t*.92,C.clasp);S(g,'box',w/2,h/2,t/2-.1,.6,1.1,.5,C.clasp)}
  return tilt(g,.15,-.55,0);
};
props.case=function(g,P,C){
  /* a leather tube with a cap: a map or scroll case */
  P=def(P,{length:11,radius:1.6,strap:true,bolts:false});
  C=def(C,{leather:0x7a4a2a,cap:0xc2a23a,strap:0x5a3418,stitch:0x3b2616,bolt:0xa8b0b8,fletch:0xd8d0b8});
  var L=P.length,r=P.radius;
  S(g,'cyl',0,L/2,0,r*2,L,r*2,C.leather);
  S(g,'cyl',0,L+.35,0,r*2.2,.8,r*2.2,C.cap);S(g,'cyl',0,L+.9,0,r*1.6,.5,r*1.6,shade(C.cap,.85));
  S(g,'cyl',0,-.2,0,r*2.2,.7,r*2.2,C.cap);
  S(g,'cyl',0,L*.18,0,r*2.12,.5,r*2.12,C.stitch);S(g,'cyl',0,L*.78,0,r*2.12,.5,r*2.12,C.stitch);
  if(P.strap){seg(g,[0,L*.8,r*1.05],[r*1.1,L*.45,r*1.15],.7,.25,C.strap);seg(g,[r*1.1,L*.45,r*1.15],[0,L*.2,r*1.05],.7,.25,C.strap);S(g,'box',r*1.1,L*.45,r*1.25,1,1,.3,C.cap)}
  if(P.bolts)for(var i=0;i<4;i++){var a=i*1.57+.4;seg(g,[Math.cos(a)*.7,L+.8,Math.sin(a)*.7],[Math.cos(a)*.8,L+3.6,Math.sin(a)*.8],.35,.35,C.bolt);S(g,'cyl',Math.cos(a)*.8,L+3.3,Math.sin(a)*.8,.9,.9,.9,C.fletch)}
  return tilt(g,0,0,-.18);
};

/* ---------- ammunition ---------- */
props.arrows=function(g,P,C){
  P=def(P,{count:7,length:11,bolt:false,bullets:false});
  C=def(C,{shaft:0xb89860,head:0xa8b0b8,fletch:0xc43a34,fletch2:0xe8dcc0,tie:0x5a3418});
  var i;
  for(i=0;i<P.count;i++){
    var a=i/P.count*Math.PI*2,x=Math.cos(a)*(i?1.2:0),z=Math.sin(a)*(i?1.2:0),lean=i?.08:0,L=P.length+(i%3)*.8;
    var top=[x+Math.cos(a)*lean*L,L,z+Math.sin(a)*lean*L];
    seg(g,[x,0,z],top,.42,.42,C.shaft,{k:'cyl'});
    var tip=[top[0]+Math.cos(a)*.3,top[1]+2.2,top[2]+Math.sin(a)*.3];
    seg(g,top,tip,P.bolt?.95:1,.3,C.head,{taper:[.0,.0]});
    var f=i%2?C.fletch:C.fletch2;
    seg(g,[x,.2,z],[x+Math.cos(a)*lean*3,3.4,z+Math.sin(a)*lean*3],.3,1.5,f,{taper:[1,.9]});
  }
  S(g,'cyl',0,P.length*.35,0,3.6,.8,3.6,C.tie);
  return g;
};
props.pellets=function(g,P,C){
  P=def(P,{r:.8,rows:3});
  C=def(C,{ball:0x8d949c,hi:0xb6bdc5,bag:0x7a5a38,tie:0x4a3220});
  /* a small leather pouch spilling a heap of shot */
  S(g,'ell',0,2.4,0,5.6,4.6,5,C.bag);S(g,'cyl',0,4.7,0,3.2,1,3.2,C.bag,[.7,.7]);S(g,'cyl',0,5.4,0,2.8,.6,2.8,C.tie);
  var i,n=0;
  for(var r=0;r<P.rows;r++)for(i=0;i<5-r;i++){
    var a=i/(5-r)*Math.PI*2+r,rad=r?2.1:0,px=3.2+Math.cos(a)*rad*.6+r*.3,pz=1.4+Math.sin(a)*rad*.7;
    S(g,'ell',px,.7+r*1.1,pz,P.r*2,P.r*2,P.r*2,(n++)%3?C.ball:C.hi);
  }
  return g;
};
props.pins=function(g,P,C){
  /* a small card of needles and a spool of thread */
  C=def(C,{pin:0xc4cbd2,card:0xd8c8a0,thread:0x8a3a38});
  S(g,'box',0,.4,0,6,.6,3.6,C.card);
  for(var i=0;i<6;i++)seg(g,[-2.2+i*.9,.7,-.5],[-2.2+i*.9,.9,1.6],.22,.22,C.pin);
  S(g,'cyl',3.6,1.4,-1.2,2.2,2.4,2.2,C.thread);S(g,'cyl',3.6,.4,-1.2,3,.4,3,0x7a5834);S(g,'cyl',3.6,2.6,-1.2,3,.4,3,0x7a5834);
  return tilt(g,.2,.3,0);
};
props.quiver=function(g,P,C){
  P=def(P,{height:11});
  C=def(C,{leather:0x7a4a2a,dark:0x5a3418,trim:0xc2a23a,shaft:0xb89860,fletch:0xc43a34,strap:0x3b2616});
  var h=P.height;
  S(g,'cyl',0,h/2,0,3.4,h,3.4,C.leather,[1.15,1.15]);
  S(g,'ell',0,.2,0,3.4,1.4,3.4,C.dark);S(g,'cyl',0,h*.08,0,3.7,.6,3.7,C.trim);S(g,'cyl',0,h*.94,0,4.2,.8,4.2,C.dark);
  for(var i=0;i<5;i++){var a=i*1.25;seg(g,[Math.cos(a)*.9,h*.9,Math.sin(a)*.9],[Math.cos(a)*1.3,h+2.8+(i%2),Math.sin(a)*1.3],.3,.3,C.shaft);
    S(g,'box',Math.cos(a)*1.3,h+2.4+(i%2),Math.sin(a)*1.3,.9,1.8,.3,i%2?C.fletch:0xe8dcc0)}
  seg(g,[2,h*.9,.4],[0,h*.55,2.4],.8,.3,C.strap);seg(g,[0,h*.55,2.4],[-2,h*.1,.4],.8,.3,C.strap);
  return g;
};

/* ---------- containers: bags, barrels, chests ---------- */
props.backpack=function(g,P,C){
  P=def(P,{h:9,w:7,d:4.6,roll:true,pan:false,lantern:false,rope:false});
  C=def(C,{canvas:0x8a6a3e,dark:0x5e4426,strap:0x3b2616,buckle:0xc2a23a,roll:0x6f7f4a,metal:0xa8b0b8});
  var h=P.h,w=P.w,d=P.d;
  S(g,'box',0,h*.46,0,w,h*.85,d,C.canvas,[.9,.8]);
  S(g,'ell',0,h*.9,0,w*.88,h*.3,d*.88,C.canvas);
  S(g,'box',0,h*.78,d/2-.05,w*.9,h*.36,.7,C.dark,[.95,1]);
  S(g,'box',0,h*.34,d/2+.1,w*.62,h*.34,.9,C.dark);
  S(g,'box',0,h*.34,d/2+.6,.8,.9,.35,C.buckle);
  [-1,1].forEach(function(s){S(g,'box',s*w*.34,h*.5,-d/2-.3,.9,h*.72,.5,C.strap);S(g,'box',s*w*.46,h*.5,d*.2,.8,h*.7,.5,C.strap)});
  S(g,'box',0,h*.96,0,w*.3,.5,.9,C.strap);
  if(P.roll){S(g,'cyl',0,h*.02,d*.05,d*.95,w*1.02,d*.95,C.roll).rotation.z=Math.PI/2;
    [-1,1].forEach(function(s){S(g,'box',s*w*.28,h*.02,d*.05,.5,.3,d*1.02,C.strap)})}
  if(P.pan)S(g,'cyl',-w*.5-.5,h*.45,0,3,.7,3,C.metal).rotation.z=Math.PI/2;
  if(P.rope)props.coil(g,{x:w*.55,y:h*.55,z:0,r:1.9,turns:3,thick:.7,side:true},{rope:0xb89860});
  return g;
};
props.pouch=function(g,P,C){
  P=def(P,{size:1,gems:false,drawstring:true});
  C=def(C,{leather:0x7a4a2a,tie:0x3b2616,flap:0x5e3a20,gem:0x6a8ad0,stud:0xc2a23a});
  var k=P.size;
  S(g,'ell',0,2.2*k,0,5.2*k,4.2*k,4.4*k,C.leather);
  S(g,'cyl',0,4*k,0,2.8*k,1.4*k,2.8*k,C.leather,[1.35,1.35]);
  S(g,'cyl',0,4.3*k,0,2.5*k,.55,2.5*k,C.tie);
  S(g,'ell',0,5.2*k,0,3.6*k,1.4*k,3.4*k,C.flap);
  seg(g,[1,4.4*k,1.2*k],[2.4,2.4*k,2*k],.4,.4,C.tie);
  if(P.gems){S(g,'ell',-1,2.4*k,2.1*k,1,1,.5,C.gem);S(g,'ell',1,1.8*k,2.1*k,.8,.8,.5,0xe0b04a)}
  return g;
};
props.sack=function(g,P,C){
  P=def(P,{h:8});
  C=def(C,{cloth:0xb89a68,dark:0x9a7e50,tie:0x6a4a28});
  var h=P.h;
  S(g,'ell',0,h*.34,0,h*.85,h*.7,h*.7,C.cloth);S(g,'cyl',0,h*.7,0,h*.5,h*.3,h*.5,C.cloth,[1.3,1.3]);
  S(g,'cyl',0,h*.74,0,h*.46,.55,h*.46,C.tie);
  S(g,'ell',-h*.12,h*.86,0,h*.5,h*.3,h*.35,C.dark);S(g,'ell',h*.14,h*.84,.3,h*.4,h*.3,h*.3,C.cloth);
  S(g,'box',-h*.15,h*.3,h*.34,.8,h*.4,.3,C.dark).rotation.z=.4;
  return g;
};
props.barrel=function(g,P,C){
  P=def(P,{h:10,r:3.6,lid:true,bucket:false,handle:false});
  C=def(C,{wood:0x8a5f34,dark:0x6a4624,hoop:0x7a8590,hoopDark:0x5a636c,inside:0x3b2a18});
  var h=P.h,r=P.r;
  if(P.bucket){
    S(g,'cyl',0,h/2,0,r*2,h,r*2,C.wood,[1.22,1.22]);
    S(g,'cyl',0,h*.2,0,r*2.02,.55,r*2.02,C.hoop);S(g,'cyl',0,h*.8,0,r*2.35,.55,r*2.35,C.hoop);
    S(g,'cyl',0,h*.98,0,r*2.35,.3,r*2.35,C.inside);
    arc(g,0,h*.9,r*1.3,.15,Math.PI-.15,8,.45,.45,C.hoop);
    return g;
  }
  S(g,'cyl',0,h*.28,0,r*2,h*.56,r*2,C.wood,[1.1,1.1]);S(g,'cyl',0,h*.72,0,r*2.2,h*.56,r*2.2,C.wood,[.91,.91]);
  [.12,.34,.66,.88].forEach(function(t,i){S(g,'cyl',0,h*t,0,r*(i<2?1.98:2.18)*(i===1||i===2?1.08:1),.7,r*(i<2?1.98:2.18)*(i===1||i===2?1.08:1),i%3===0?C.hoop:C.hoopDark)});
  for(var i=0;i<8;i++){var a=i/8*Math.PI*2;S(g,'box',Math.cos(a)*r*1.05,h*.5,Math.sin(a)*r*1.05,.12,h*.8,.12,C.dark)}
  S(g,'cyl',0,h*1.0,0,r*1.9,.3,r*1.9,P.lid?C.wood:C.inside);
  if(P.lid){S(g,'cyl',0,h*1.0,0,r*1.2,.2,r*1.2,C.dark);S(g,'box',0,h*1.06,0,.4,.3,r*1.5,C.dark)}
  return g;
};
props.basket=function(g,P,C){
  C=def(C,{reed:0xc19a5a,reedDark:0x9a763c});
  var i,rows=6;
  for(i=0;i<rows;i++){
    var t=i/(rows-1),r=3+t*1.6;
    S(g,'cyl',0,.5+i*.95,0,r*2,1,r*2,i%2?C.reed:C.reedDark,[1.06,1.06]);
  }
  S(g,'cyl',0,6.5,0,9.4,.5,9.4,C.reedDark);
  arc(g,0,6.2,4.2,.1,Math.PI-.1,10,.7,.7,C.reedDark);
  arc(g,0,6.2,3.6,.1,Math.PI-.1,10,.5,.5,C.reed);
  return g;
};
props.chest=function(g,P,C){
  P=def(P,{w:9,h:6,d:6,lock:true});
  C=def(C,{wood:0x7a4a28,dark:0x5a3418,band:0xa8b0b8,bandDark:0x6f7880,lock:0xe0b04a});
  var w=P.w,h=P.h,d=P.d;
  S(g,'box',0,h*.3,0,w,h*.6,d,C.wood);
  /* the lid is a barrel vault: a half cylinder lying along the length */
  var lid=S(g,'cyl',0,h*.6,0,d,w,d,C.wood);lid.rotation.z=Math.PI/2;
  /* the half below the rim is hidden in the body, the half above is the curve */
  S(g,'box',0,h*.52,0,w+.3,.5,d+.3,C.dark);
  [-1,1].forEach(function(s){
    S(g,'box',s*w*.36,h*.3,0,.9,h*.62,d+.35,C.band);
    var b=S(g,'cyl',s*w*.36,h*.6,0,d+.4,.9,d+.4,C.band);b.rotation.z=Math.PI/2;
  });
  for(var c=0;c<4;c++)S(g,'box',(c<2?-1:1)*(w/2),c%2?.4:h*.55,(c%2?-1:1)*(d/2),.7,.9,.7,C.bandDark);
  if(P.lock){S(g,'box',0,h*.58,d/2+.2,1.6,1.7,.5,C.lock);S(g,'box',0,h*.52,d/2+.5,.4,.7,.3,C.dark)}
  return g;
};
props.jug=function(g,P,C){
  P=def(P,{h:8,r:2.8,skin:false});
  C=def(C,{clay:0xb86a3a,dark:0x8a4a26,cork:0x9a6a3a,strap:0x6a4a28});
  var h=P.h,r=P.r;
  if(P.skin){
    /* a waterskin: a leather bladder with a spout and a carrying strap */
    S(g,'ell',0,h*.4,0,r*2.1,h*.8,r*1.4,C.clay);S(g,'ell',-.6,h*.36,r*.5,r*.9,h*.5,r*.5,shade(C.clay,1.2));
    S(g,'cyl',r*.2,h*.86,0,1.5,1.4,1.5,C.dark,[.8,.8]);S(g,'cyl',r*.2,h*1.0,0,1.6,.8,1.6,C.cork);
    arc(g,0,h*.55,r*1.25,.2,Math.PI-.2,10,.5,.5,C.strap);
    return g;
  }
  S(g,'ell',0,h*.36,0,r*2.1,h*.7,r*2.1,C.clay);S(g,'cyl',0,h*.74,0,r*.95,h*.34,r*.95,C.clay,[1.4,1.4]);
  S(g,'cyl',0,h*.92,0,r*1.3,.5,r*1.3,C.dark);S(g,'cyl',0,h*1.0,0,r*.8,.7,r*.8,C.cork);
  S(g,'cyl',0,h*.46,0,r*2.14,.45,r*2.14,C.dark);
  arc(g,r*.9,h*.62,r*.9,-1.1,1.1,8,.7,.7,C.clay);
  return g;
};
props.pot=function(g,P,C){
  P=def(P,{r:3.4,h:4.6,lid:false});
  C=def(C,{iron:0x3a3d42,hi:0x575c63,rim:0x2a2c30});
  var r=P.r,h=P.h;
  S(g,'ell',0,h*.45,0,r*2,h*.9,r*2,C.iron);S(g,'cyl',0,h*.9,0,r*1.7,.7,r*1.7,C.rim,[1.1,1.1]);
  S(g,'ell',-r*.5,h*.55,r*.7,r*.5,h*.4,r*.4,C.hi);
  [-1,1].forEach(function(s){S(g,'ell',s*r*.95,h*.62,0,.9,1,.9,C.hi)});
  arc(g,0,h*.9,r*.95,.1,Math.PI-.1,10,.5,.5,C.hi);
  [-1,1].forEach(function(s){S(g,'cyl',s*r*.55,-.1,s*r*.35,.9,1.2,.9,C.iron)});
  return g;
};
})();
