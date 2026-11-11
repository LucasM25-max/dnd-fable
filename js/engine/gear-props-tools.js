/* More prop kinds for the family in gear-props.js: rope and chain, light, camp gear, clothing, climbing and breaking tools, traps,
   optics, the artisan's kits, instruments, games, spellcasting foci and holy symbols. Same rules as there: a kind is a builder
   function(group, params, palette) that fills in its own defaults, stands upright and is about 6 to 12 units tall. */
(function(){
var G=Fable.gear,K=G.kit,S=K.S,seg=K.seg,arc=K.arc,ring=K.ring,def=K.def,shade=K.shade,props=G.props,tilt=props.tilt;

/* ---------- rope, chain, string ---------- */
/* a coil of turns lying flat (or on its side), with a free end hanging off the top */
props.coil=function(g,P,C){
  P=def(P,{r:3.4,turns:4,thick:1,x:0,y:0,z:0,side:false,links:false,tail:true});
  C=def(C,{rope:0xb89860,dark:0x8e723e,link:0x8a929a,linkDark:0x5f666d});
  var gg=P.side?K.grp():g,i,n=14;
  for(i=0;i<P.turns;i++){
    var y=P.y+.5+i*P.thick*.85,r=P.r*(1-i*.04);
    for(var k=0;k<n;k++){
      var a0=k/n*Math.PI*2,a1=(k+1)/n*Math.PI*2,c=P.links?(k%2?C.link:C.linkDark):((k+i)%2?C.rope:C.dark);
      if(P.links)seg(gg,[P.x+Math.cos(a0)*r,y,P.z+Math.sin(a0)*r],[P.x+Math.cos(a1)*r,y,P.z+Math.sin(a1)*r],P.thick*.9,P.thick*(k%2?.5:1),c);
      else seg(gg,[P.x+Math.cos(a0)*r,y,P.z+Math.sin(a0)*r],[P.x+Math.cos(a1)*r,y,P.z+Math.sin(a1)*r],P.thick,P.thick,c,{k:'cyl'});
    }
  }
  if(P.tail){
    var ty=P.y+.5+P.turns*P.thick*.85;
    seg(gg,[P.x+P.r,ty-.6,P.z],[P.x+P.r*1.3,ty+1.2,P.z+.8],P.thick*.8,P.thick*.8,P.links?C.link:C.rope,{k:'cyl'});
    seg(gg,[P.x+P.r*1.3,ty+1.2,P.z+.8],[P.x+P.r*1.15,ty+2.8,P.z+1.8],P.thick*.7,P.thick*.7,P.links?C.link:C.dark,{k:'cyl'});
  }
  if(P.side){gg.rotation.x=Math.PI/2;g.add(gg);return g}
  return g;
};
props.rope=function(g,P,C){props.coil(g,def(P,{r:3.6,turns:4,thick:1.05}),C);return g};
props.chain=function(g,P,C){props.coil(g,def(P,{r:3.4,turns:4,thick:.95,links:true}),C);return g};
props.string=function(g,P,C){
  C=def(C,{twine:0xd8c9a0,spool:0x7a5834});
  S(g,'cyl',0,1,0,4.2,.5,4.2,C.spool);S(g,'cyl',0,4.5,0,4.2,.5,4.2,C.spool);S(g,'cyl',0,2.75,0,3.4,3,3.4,C.twine);
  for(var i=0;i<5;i++)S(g,'cyl',0,1.5+i*.55,0,3.5,.25,3.5,i%2?shade(C.twine,.85):C.twine);
  seg(g,[1.6,2.8,.6],[3.2,2,2.6],.3,.3,C.twine);
  return g;
};

/* ---------- light ---------- */
props.candle=function(g,P,C){
  C=def(C,{wax:0xeae0c0,flame:0xffc850,core:0xfff0b0,holder:0xc2a23a,drip:0xd8ceb0});
  S(g,'cyl',0,.3,0,4.4,.6,4.4,C.holder);S(g,'cyl',0,.8,0,2.2,.7,2.2,C.holder,[1.5,1.5]);
  S(g,'cyl',0,3.3,0,1.9,4.6,1.9,C.wax);S(g,'ell',.6,4.4,.2,.8,2,.8,C.drip);
  S(g,'box',0,5.8,0,.2,.6,.2,0x2a2a2a);
  S(g,'ell',0,6.8,0,1.1,2.2,1.1,C.flame,[.2,.2],true);S(g,'ell',0,6.5,0,.55,1.2,.55,C.core,[.2,.2],true);
  arc(g,3.1,1.4,1.7,.4,Math.PI*1.45,7,.5,.5,C.holder);
  return g;
};
props.lamp=function(g,P,C){
  C=def(C,{brass:0xc9a24a,dark:0x8e6f2a,flame:0xffb84a,glass:0xe8f2f4});
  S(g,'ell',0,1.7,0,6,3,4.4,C.brass);S(g,'cyl',0,.3,0,3,.6,3,C.dark);
  S(g,'cyl',0,3.6,0,1.8,1.1,1.8,C.dark);
  /* the spout reaches out one side and holds the wick */
  seg(g,[2,2.2,0],[4.8,3.3,0],1.1,.9,C.brass,{taper:[.55,.55]});S(g,'ell',5.1,3.6,0,.8,.9,.8,C.flame,[.2,.2],true);
  S(g,'ell',-3.2,2.6,0,1.5,2.2,.9,C.brass);arc(g,-3.2,2.6,1.4,.4,2.8,6,.5,.5,C.dark);
  S(g,'cyl',0,4.3,0,2.4,.5,2.4,C.dark);S(g,'ell',0,4.7,0,1,.8,1,C.brass);
  return g;
};
props.lantern=function(g,P,C){
  P=def(P,{style:'hooded',h:8});
  C=def(C,{iron:0x3c3f45,brass:0xc9a24a,hi:0x5a5f68,glass:0xffe9a8,flame:0xffb030,lens:0xfff4c0,hood:0x2a2c30});
  var h=P.h,bull=P.style==='bullseye',w=bull?3.4:3.8;
  S(g,'cyl',0,.5,0,w*1.5,1,w*1.5,C.iron);
  if(bull){
    S(g,'cyl',0,h*.45,0,w*1.5,h*.7,w*1.5,C.iron);
    S(g,'cyl',0,h*.46,w*.78,w*1.1,.9,w*1.1,C.lens,[.7,.7],true).rotation.x=Math.PI/2;
    S(g,'cyl',0,h*.46,w*.7,w*1.6,.7,w*1.6,C.brass).rotation.x=Math.PI/2;
    S(g,'cyl',0,h*.2,0,w*1.55,.5,w*1.55,C.brass);S(g,'cyl',0,h*.72,0,w*1.55,.5,w*1.55,C.brass);
    S(g,'ell',0,h*.46,0,w,w,w,C.flame,[.2,.2],true);
  }else{
    for(var i=0;i<4;i++){var a=i*Math.PI/2+Math.PI/4;seg(g,[Math.cos(a)*w*.95,1,Math.sin(a)*w*.95],[Math.cos(a)*w*.8,h*.8,Math.sin(a)*w*.8],.55,.55,C.iron)}
    S(g,'cyl',0,h*.42,0,w*1.55,h*.62,w*1.55,C.glass,[.85,.85],true);
    S(g,'ell',0,h*.35,0,1.3,2.8,1.3,C.flame,[.2,.2],true);
  }
  S(g,'cyl',0,h*.86,0,w*1.1,.8,w*1.1,P.style==='hooded'?C.hood:C.iron);
  S(g,'cyl',0,h*.98,0,w*1.5,h*.2,w*1.5,P.style==='hooded'?C.hood:C.iron,[.45,.45]);
  arc(g,0,h*1.02,w*.85,.15,Math.PI-.15,9,.55,.55,C.hi);
  S(g,'ell',0,h*1.2,0,.9,.5,.9,C.hi);
  return g;
};
props.torch=function(g,P,C){
  C=def(C,{wood:0x7a5834,wrap:0x3a2a1c,flame:0xff8a28,flame2:0xffd04a,core:0xfff0b0,char:0x2a2018});
  S(g,'cyl',0,-3,0,1.4,10,1.4,C.wood,[1.1,1.1]);
  S(g,'cyl',0,2.8,0,2.5,3.4,2.5,C.wrap,[1.4,1.4]);S(g,'cyl',0,3.2,0,2.6,.4,2.6,C.char);S(g,'cyl',0,2,0,2.2,.4,2.2,C.char);
  S(g,'ell',0,5.6,0,2.6,4.2,2.6,C.flame,[.4,.4],true);S(g,'ell',.3,5.2,.2,1.6,3,1.6,C.flame2,[.4,.4],true);S(g,'ell',0,4.6,0,.9,1.8,.9,C.core,[.4,.4],true);
  S(g,'ell',-.8,7.6,.2,.9,1.8,.9,C.flame,[.3,.3],true);
  return g;
};
props.tinderbox=function(g,P,C){
  C=def(C,{tin:0x8a8f95,dark:0x5a5f66,flint:0x4a4c50,steel:0xb0b8c0,char:0x2a2420,spark:0xffd04a});
  S(g,'box',0,1.3,0,5.4,2.6,3.8,C.tin);S(g,'box',0,2.9,-.2,5.6,.7,4,C.dark);
  S(g,'box',0,2.5,1.9,.9,1.1,.4,C.steel);
  S(g,'ell',-1.2,3.7,.4,1.7,1.2,1.4,C.flint);S(g,'box',1.7,3.8,.2,1.8,.5,.35,C.steel).rotation.z=.3;
  S(g,'ell',-1,3.1,-.8,2,.6,1.6,C.char);S(g,'ell',-2,4.4,.2,.5,.5,.5,C.spark,[1,1],true);
  return tilt(g,0,-.4,0);
};

/* ---------- camp: bedroll, blanket, tent, rations, clothes ---------- */
props.bedroll=function(g,P,C){
  C=def(C,{cloth:0x6a7a4e,inner:0xd8cdb0,strap:0x5a3a20,shade:0x4f5c38});
  S(g,'cyl',0,2.6,0,5,8,5,C.cloth).rotation.z=Math.PI/2;
  S(g,'cyl',4.05,2.6,0,4.5,.4,4.5,C.inner,[.9,.9]).rotation.z=Math.PI/2;
  S(g,'cyl',-4.05,2.6,0,4.5,.4,4.5,C.inner,[.9,.9]).rotation.z=Math.PI/2;
  [-2.4,2.4].forEach(function(x){S(g,'cyl',x,2.6,0,5.4,.7,5.4,C.strap).rotation.z=Math.PI/2;S(g,'box',x,5.3,0,.9,.4,.4,0xc2a23a)});
  S(g,'cyl',0,2.6,0,5.2,1.1,5.2,C.shade).rotation.z=Math.PI/2;
  return tilt(g,0,.5,0);
};
props.blanket=function(g,P,C){
  P=def(P,{folds:5});
  C=def(C,{wool:0xa84a3a,stripe:0xe0c890,edge:0x7a2e24});
  for(var i=0;i<P.folds;i++){
    var s=1-i*.025;
    S(g,'box',(i%2?.15:-.1),.7+i*1.15,0,8*s,1.1,6*s,C.wool,[.98,.98]);
    S(g,'box',(i%2?.15:-.1),.7+i*1.15,3.05*s,8*s,.9,.15,C.stripe);S(g,'box',(i%2?.15:-.1),.45+i*1.15,3.1*s,8*s,.25,.15,C.edge);
  }
  return tilt(g,0,.4,0);
};
props.tent=function(g,P,C){
  C=def(C,{canvas:0xc9b58a,dark:0xa08a60,rope:0x7a5a30,pole:0x6a4a28,door:0x2a2018});
  S(g,'box',0,.3,0,10,.6,8,C.dark);
  /* a ridge tent: two sloped canvas sides of tapered blocks, meeting along the top */
  [-1,1].forEach(function(s){
    var m=S(g,'box',s*2.35,3.6,0,5.2,.55,7.6,C.canvas);m.rotation.z=s*-.9;
    S(g,'box',s*4.2,.9,0,1,1.3,7.6,C.dark);
  });
  S(g,'cyl',0,6.1,0,.7,7.8,.7,C.pole).rotation.x=Math.PI/2;
  [-1,1].forEach(function(z){S(g,'cyl',0,3.4,z*3.9,.55,6.6,.55,C.pole)});
  [-1,1].forEach(function(z){S(g,'box',0,3,z*3.95,5,4.6,.3,C.canvas,[.05,1]);S(g,'box',0,2.1,z*4.05,1.3,2.7,.3,C.door)});
  [[-5.6,-4.4],[5.6,-4.4],[-5.6,4.4],[5.6,4.4]].forEach(function(p){
    seg(g,[p[0]*.7,2.4,p[1]*.7],[p[0],.3,p[1]],.28,.28,C.rope);S(g,'cyl',p[0],.6,p[1],.4,1.2,.4,C.pole);
  });
  return g;
};
props.rations=function(g,P,C){
  C=def(C,{cloth:0xe0d4b4,twine:0x7a5a30,bread:0xc8924e,crust:0x9a6a30,cheese:0xe8c050,jerky:0x6a3a2a,wrap:0xcfc3a0});
  S(g,'box',0,1.2,0,6.6,2.4,4.4,C.wrap,[.96,.96]);
  S(g,'cyl',0,1.2,0,6.8,.4,4.6,C.twine).rotation.z=0;
  S(g,'box',-1.6,1.3,0,.4,2.5,4.5,C.twine);S(g,'box',1.6,1.3,0,.4,2.5,4.5,C.twine);
  S(g,'ell',-1.6,3.3,.3,3.6,2,2.2,C.bread);S(g,'ell',-1.6,3.9,.3,3.2,.8,2,C.crust);
  S(g,'cyl',2.1,3.1,-.4,2.4,1.5,2.4,C.cheese,[.95,.95]);S(g,'box',2.9,3.2,-.4,1,1.5,1.1,0x2a2a2a).rotation.y=.8;
  S(g,'ell',.8,2.9,1.1,.8,.8,.8,C.cheese);
  S(g,'box',.5,3.4,1.4,3.4,.5,.6,C.jerky);
  return g;
};
props.clothes=function(g,P,C){
  /* a garment shown standing, as if on a stand: body, sleeves hanging out and down, a neckline and a hem */
  P=def(P,{style:'plain',hat:false});
  C=def(C,{cloth:0x7a6a4e,alt:0x5e4f38,trim:0xc9a24a,belt:0x3b2616,hat:0x5a2f3a,feather:0xe8dcc0});
  var fine=P.style==='fine',robe=P.style==='robe',cos=P.style==='costume',len=robe?10:7;
  S(g,'box',0,len/2+1,0,6,len,2.6,C.cloth,[1.0,1.0]);
  if(robe)S(g,'cyl',0,2.2,0,6.4,4.4,3.2,C.cloth,[.82,.9]);
  S(g,'box',0,.7,0,robe?7.2:6.3,.7,2.9,C.alt);
  seg(g,[-3,len+.2,0],[-6.2,len-3.4,.3],2.2,2.3,C.cloth,{taper:[.9,.9]});seg(g,[3,len+.2,0],[6.2,len-3.4,.3],2.2,2.3,C.cloth,{taper:[.9,.9]});
  S(g,'box',-6.3,len-3.5,.3,2.4,.8,2.5,C.alt);S(g,'box',6.3,len-3.5,.3,2.4,.8,2.5,C.alt);
  S(g,'box',0,len+.9,0,6.2,1,2.8,C.cloth);
  S(g,'ell',0,len+.9,.3,2.8,1.4,2.4,C.alt);
  S(g,'box',0,len*.45+1,1.4,6.1,.8,.25,C.belt);S(g,'box',0,len*.45+1,1.5,1.2,1.1,.3,C.trim);
  if(fine){S(g,'box',0,len*.55+1,1.35,.5,len*.7,.3,C.trim);for(var i=0;i<4;i++)S(g,'ell',.9,len-.2-i*1.5,1.45,.7,.7,.4,C.trim);S(g,'box',0,.4,1.4,6.2,.5,.3,C.trim)}
  if(robe){S(g,'box',0,len*.55+1,1.35,.6,len*.7,.3,C.trim);S(g,'ell',0,len+.7,1.2,3.2,1.6,1.4,C.alt)}
  if(cos||P.hat){
    S(g,'cyl',0,len+3.2,0,3.4,2,3.4,C.hat,[.7,.7]);S(g,'cyl',0,len+2.2,0,5.8,.4,5.8,C.hat);
    seg(g,[1.2,len+3.4,.5],[3.4,len+5.8,.4],.7,.3,C.feather,{taper:[.2,1]});
  }
  return g;
};

/* ---------- climbing, breaking and digging tools ---------- */
props.crowbar=function(g,P,C){
  C=def(C,{iron:0x4a4e54,hi:0x6a6f77});
  var y=0;
  seg(g,[0,-4,0],[0,5,0],.9,.9,C.iron,{k:'cyl'});
  seg(g,[0,5,0],[1.2,7.4,0],.9,.9,C.iron,{k:'cyl'});seg(g,[1.2,7.4,0],[2.9,8.3,0],.9,.9,C.iron,{k:'cyl'});
  seg(g,[2.9,8.3,0],[3.6,7.5,0],1.1,.5,C.hi,{taper:[.3,1]});
  seg(g,[0,-4,0],[-.8,-5,0],1.3,.5,C.hi,{taper:[.2,1]});
  S(g,'ell',0,-1,0,1.2,.9,1.2,C.hi);
  return g;
};
props.shovel=function(g,P,C){
  C=def(C,{wood:0x8a6a3e,iron:0x7a838c,hi:0xa5adb5,dark:0x5a636c});
  seg(g,[0,-2,0],[0,10,0],1,1,C.wood,{k:'cyl'});
  S(g,'box',0,10.4,0,3.6,.7,.9,C.wood);S(g,'ell',-1.8,10.4,0,1,1,1,C.wood);S(g,'ell',1.8,10.4,0,1,1,1,C.wood);
  S(g,'cyl',0,-1.7,0,1.7,2,1.7,C.dark);
  seg(g,[0,-2.6,0],[0,-7.8,0],3.6,.35,C.iron,{taper:[1.45,1]});
  S(g,'ell',0,-8.4,0,3.4,2.2,.5,C.iron,[1,1]);
  S(g,'box',0,-4.6,.3,.5,4,.5,C.hi);
  return g;
};
props.pole=function(g,P,C){
  C=def(C,{wood:0x8a6a3e,band:0xa8b0b8,dark:0x6a4a28});
  seg(g,[0,0,0],[0,17,0],1.1,1.1,C.wood,{k:'cyl',taper:[.9,.9]});
  S(g,'cyl',0,.3,0,1.5,.6,1.5,C.band);S(g,'cyl',0,16.7,0,1.5,.6,1.5,C.band);
  for(var i=1;i<5;i++)S(g,'ell',(i%2?.4:-.4),i*3.4,.3,.7,.8,.7,C.dark);
  return tilt(g,0,0,-.25);
};
props.ladder=function(g,P,C){
  C=def(C,{wood:0x8a6a3e,rung:0xa5824c,dark:0x6a4a28});
  [-1,1].forEach(function(s){seg(g,[s*2.2,0,0],[s*1.7,16,0],.9,.9,C.wood,{k:'box'});S(g,'box',s*2.2,.2,0,1.1,.5,1.1,C.dark)});
  for(var i=0;i<6;i++){var x=2.2-i*.035*5;S(g,'cyl',0,1.8+i*2.4,0,.7,3.6-i*.1,.7,C.rung).rotation.z=Math.PI/2}
  return tilt(g,0,.5,-.22);
};
props.hook=function(g,P,C){
  C=def(C,{iron:0x50555c,hi:0x7a8088,rope:0xb89860});
  S(g,'cyl',0,6.5,0,1,3.4,1,C.iron);
  ring(g,0,8.6,0,.9,.5,.7,C.hi,8);
  /* four curved flukes bending out from the shank */
  for(var i=0;i<4;i++){
    var a=i*Math.PI/2+.7,c=Math.cos(a),s=Math.sin(a);
    seg(g,[c*.4,5,s*.4],[c*2,3.6,s*2],.9,.9,C.iron);seg(g,[c*2,3.6,s*2],[c*3.1,2.3,s*3.1],.8,.8,C.iron);
    seg(g,[c*3.1,2.3,s*3.1],[c*3,.8,s*3],.7,.7,C.hi,{taper:[.3,.3]});
  }
  seg(g,[0,8.7,0],[1.6,10,.6],.5,.5,C.rope);seg(g,[1.6,10,.6],[3.4,10.4,1.2],.5,.5,C.rope);
  return g;
};
props.tackle=function(g,P,C){
  C=def(C,{wood:0x8a5f34,iron:0x4a4e54,rope:0xb89860,hi:0x7a8088});
  [[0,9.4],[0,2]].forEach(function(p,i){
    S(g,'box',0,p[1],0,3.2,3.4,1.8,C.wood);
    S(g,'cyl',0,p[1],0,2.6,.9,2.6,C.iron).rotation.x=Math.PI/2;
    S(g,'cyl',0,p[1],0,.9,2.2,.9,C.hi).rotation.x=Math.PI/2;
    S(g,'ell',0,p[1]+(i?-2.2:2.2),0,1.4,1.1,1.4,C.hi);
  });
  [-1,1].forEach(function(s,i){seg(g,[s*1.1,9.3,0],[s*1.1,2.2,0],.5,.5,C.rope)});
  seg(g,[1.1,2.2,0],[2.4,5,.4],.5,.5,C.rope);seg(g,[2.4,5,.4],[2.8,0,.9],.5,.5,C.rope);
  return g;
};
props.climbers=function(g,P,C){
  C=def(C,{rope:0xc4573a,rope2:0xe0d8c0,iron:0xa8b0b8,dark:0x3a3d42});
  props.coil(g,{r:3.2,turns:3,thick:.9,tail:false},{rope:C.rope,dark:C.rope2});
  for(var i=0;i<3;i++){var a=i*2.1;S(g,'cyl',Math.cos(a)*1.6,3.6,Math.sin(a)*1.6,.4,.4,2.4,C.iron);}
  S(g,'ell',3.9,1.5,1,2,2.6,.6,C.iron);S(g,'ell',3.9,1.5,1,1.1,1.6,.7,C.dark);
  ring(g,-3.2,3.4,1.2,1.2,.45,.6,C.iron,8);
  for(var k=0;k<4;k++)seg(g,[-1.5+k*1.2,2.6,2.4],[-1.5+k*1.2,3.4,2.4],.35,.35,C.iron);
  return g;
};
props.ram=function(g,P,C){
  C=def(C,{wood:0x7a5834,iron:0x4a4e54,hi:0x7a8088,rope:0xb89860});
  var l=K.grp();
  S(l,'cyl',0,0,0,3.4,12,3.4,C.wood).rotation.z=Math.PI/2;
  S(l,'ell',7,0,0,3.9,3.6,3.9,C.iron);S(l,'cyl',6.2,0,0,3.9,1.2,3.9,C.hi).rotation.z=Math.PI/2;
  S(l,'cyl',5.2,0,0,3.7,.9,3.7,C.iron).rotation.z=Math.PI/2;S(l,'cyl',-5,0,0,3.7,.9,3.7,C.iron).rotation.z=Math.PI/2;
  [-2.2,1.6].forEach(function(x){S(l,'cyl',x,0,0,3.6,.7,3.6,C.rope).rotation.z=Math.PI/2;seg(l,[x,1.7,0],[x+.3,3.4,0],.4,.4,C.rope);S(l,'ell',x+.3,-1.8,1.5,.9,.9,.9,C.iron)});
  [-3.4,3.2].forEach(function(x){S(l,'box',x,-3.6,0,.8,2.8,.8,C.wood)});
  l.position.y=4;g.add(l);return tilt(g,0,.3,.12);
};
props.spikes=function(g,P,C){
  /* a handful of iron pegs lying about: a ringed head and a tapering point */
  C=def(C,{iron:0x555a61,hi:0x8a9098});
  [[-2.4,-1.6,.3],[0,.4,2.2],[2.2,-1.4,-.5],[-1.4,2.4,-.2],[2.6,1.8,.7]].forEach(function(p,i){
    var l=K.grp();
    S(l,'cyl',0,3.4,0,1.7,.55,1.7,C.iron);S(l,'cyl',0,3.0,0,1.1,.5,1.1,C.hi);
    S(l,'cyl',0,1.5,0,1,3.2,1,C.iron,[.3,.3]);
    l.rotation.z=Math.PI/2;l.rotation.y=p[2]*2.2;l.position.set(p[0],.7+(i%2)*.8,p[1]);g.add(l);
  });
  return tilt(g,.5,0,0);
};
props.caltrops=function(g,P,C){
  C=def(C,{iron:0x5a5f66,hi:0x9aa0a8,sack:0xa88a58});
  S(g,'ell',-2.6,1.4,-1.6,3,2.6,2.6,C.sack);
  [[1.8,0,1.2],[-.8,0,1.9],[2.8,0,-1.6]].forEach(function(p,k){
    var x=p[0],y=1,z=p[2];
    [[1,1,1],[-1,1,-1],[-1,-1,1],[1,-1,-1]].forEach(function(d){
      var n=Math.sqrt(3);seg(g,[x,y+.9,z],[x+d[0]*1.9/n,y+.9+d[1]*1.9/n,z+d[2]*1.9/n],.7,.7,C.iron,{taper:[.2,.2]});
    });
    S(g,'ell',x,y+.9,z,.9,.9,.9,C.hi);
  });
  return g;
};
props.balls=function(g,P,C){
  C=def(C,{ball:0xa8b0b8,hi:0xe0e6ea,bag:0x7a5a38,tie:0x4a3220});
  S(g,'ell',-2.6,2.4,-1,4.4,4,3.8,C.bag);S(g,'cyl',-2.6,4.6,-1,2,1.2,2,C.bag,[1.3,1.3]);S(g,'cyl',-2.6,4.2,-1,2.1,.5,2.1,C.tie);
  var n=0;[[1,.6,2],[2.8,.6,.4],[4,.6,1.8],[1.6,.6,-.8],[3.1,.6,3.1],[2,1.7,1.2],[3.4,1.7,1.4]].forEach(function(p){
    S(g,'ell',p[0],p[1],p[2],1.3,1.3,1.3,(n++)%2?C.ball:C.hi);
  });
  return g;
};
props.trap=function(g,P,C){
  C=def(C,{iron:0x4a4e54,hi:0x7a8088,rust:0x7a4a30,chain:0x6a7078});
  S(g,'cyl',0,.5,0,7.4,.8,7.4,C.iron);S(g,'cyl',0,.7,0,3.4,.5,3.4,C.rust);
  S(g,'box',0,1.5,0,.9,2,.9,C.hi);
  /* two jaws, each a half ring with teeth, snapped open */
  [-1,1].forEach(function(s){
    arc(g,0,.8,3.1,s>0?.25:Math.PI+.25,s>0?Math.PI-.25:Math.PI*2-.25,8,.9,.9,C.iron);
    for(var i=0;i<6;i++){var a=(s>0?.5:Math.PI+.5)+i*.4;seg(g,[Math.cos(a)*3,1,Math.sin(a)*3],[Math.cos(a)*2.6,2.2,Math.sin(a)*2.6],.55,.55,C.hi,{taper:[.2,.2]})}
  });
  for(var k=0;k<4;k++)seg(g,[3.6+k*.8,.7,0],[4.2+k*.8,.7,.8],.6,.5,C.chain);
  return tilt(g,.25,.4,0);
};
props.net=function(g,P,C){
  C=def(C,{twine:0xb09a68,weight:0x5a5f66});
  var n=6,i,j;
  for(i=0;i<=n;i++){
    var x=-4+i*8/n;
    seg(g,[x,.5,-3.5],[x*.92,1.1,0],.35,.35,C.twine);seg(g,[x*.92,1.1,0],[x,.5,3.5],.35,.35,C.twine);
  }
  for(j=0;j<=n;j++){
    var z=-3.5+j*7/n;
    seg(g,[-4,.5,z],[0,1.3,z*.92],.35,.35,C.twine);seg(g,[0,1.3,z*.92],[4,.5,z],.35,.35,C.twine);
  }
  [[-4,-3.5],[4,-3.5],[-4,3.5],[4,3.5],[0,-3.8],[0,3.8],[-4.2,0],[4.2,0]].forEach(function(p){S(g,'ell',p[0],.4,p[1],1.1,1.1,1.1,C.weight)});
  return tilt(g,.95,.3,0);
};
props.manacles=function(g,P,C){
  C=def(C,{iron:0x55595f,hi:0x888e96,dark:0x383b40});
  [-1,1].forEach(function(s){
    arc(g,s*3.4,3.8,2.2,.25,Math.PI*2-.25,12,.9,1.4,C.iron);
    S(g,'box',s*3.4+s*2.2,3.8,0,1.1,1.5,1.6,C.hi);S(g,'cyl',s*3.4+s*2.5,3.8,0,.5,.9,.5,C.dark);
    S(g,'cyl',s*3.4,3.8,0,2.4,1.5,2.4,C.dark,[.9,.9]).rotation.x=Math.PI/2;
  });
  for(var i=0;i<4;i++)S(g,'cyl',-1.4+i*.95,3.8,0,.9,.55,.45,C.hi).rotation.z=i%2?Math.PI/2:0;
  return tilt(g,-.2,0,0);
};
props.lock=function(g,P,C){
  C=def(C,{body:0x8a6f2a,hi:0xc9a24a,steel:0xb0b8c0,dark:0x3a2a14});
  S(g,'box',0,2.4,0,5.2,4.4,2.2,C.body);S(g,'box',0,4.1,0,5.2,.8,2.2,C.hi);S(g,'box',0,.9,0,5.4,.8,2.4,C.hi);
  S(g,'cyl',0,2.5,1.2,1.2,.4,1.2,C.dark).rotation.x=Math.PI/2;S(g,'box',0,1.8,1.2,.55,1.4,.4,C.dark);
  arc(g,0,4.5,2,0,Math.PI,9,.95,.95,C.steel);
  S(g,'box',-2,4.8,0,.95,1.2,.95,C.steel);S(g,'box',2,4.8,0,.95,1.2,.95,C.steel);
  return tilt(g,0,-.4,0);
};
props.mirror=function(g,P,C){
  C=def(C,{frame:0xc9a24a,glass:0xcfe6ee,shine:0xffffff,dark:0x8e6f2a});
  S(g,'ell',0,6.6,0,5.4,6,.8,C.frame);S(g,'ell',0,6.6,.4,4.2,4.8,.6,C.glass);
  S(g,'ell',-1,7.8,.75,1.2,2.4,.3,C.shine);
  S(g,'cyl',0,2.6,0,1,3.8,.9,C.frame,[1.1,1.1]);S(g,'ell',0,.7,0,1.8,1.4,1.2,C.dark);
  S(g,'ell',0,4.4,0,1.6,.9,1.2,C.dark);
  return tilt(g,0,-.5,0);
};
props.magnifier=function(g,P,C){
  C=def(C,{rim:0xc9a24a,glass:0xd5eaf0,hi:0xffffff,handle:0x3b2616});
  var l=K.grp();
  S(l,'cyl',0,0,0,5.2,.7,5.2,C.rim);S(l,'cyl',0,0,0,4.1,.8,4.1,C.glass);S(l,'ell',-.8,.45,.8,1.4,.3,.8,C.hi);
  l.rotation.x=Math.PI/2;l.position.y=7;g.add(l);
  seg(g,[0,4.4,0],[0,-.6,0],1.1,1.1,C.handle,{k:'cyl',taper:[.9,.9]});S(g,'ell',0,-.8,0,1.4,1,1.4,C.rim);S(g,'cyl',0,4.4,0,1.5,.6,1.5,C.rim);
  return tilt(g,0,0,-.3);
};
props.spyglass=function(g,P,C){
  C=def(C,{brass:0xc9a24a,leather:0x5a3a22,dark:0x2a2018,glass:0x8ab6d0,band:0x8e6f2a});
  var l=K.grp();
  S(l,'cyl',-4,0,0,2.2,5,2.2,C.leather).rotation.z=Math.PI/2;
  S(l,'cyl',0,0,0,1.8,5,1.8,C.brass).rotation.z=Math.PI/2;
  S(l,'cyl',3.8,0,0,1.4,4,1.4,C.brass).rotation.z=Math.PI/2;
  S(l,'cyl',-6.8,0,0,2.5,.9,2.5,C.band).rotation.z=Math.PI/2;S(l,'cyl',-6.9,0,0,1.3,.6,1.3,C.glass).rotation.z=Math.PI/2;
  S(l,'cyl',-1.7,0,0,2,.5,2,C.band).rotation.z=Math.PI/2;S(l,'cyl',1.8,0,0,1.9,.5,1.9,C.band).rotation.z=Math.PI/2;
  S(l,'cyl',6,0,0,1.7,.9,1.7,C.band).rotation.z=Math.PI/2;S(l,'cyl',6.1,0,0,1,.5,1,C.glass).rotation.z=Math.PI/2;
  l.position.y=3.5;l.rotation.z=.25;g.add(l);
  return g;
};
props.whistle=function(g,P,C){
  C=def(C,{metal:0xc9a24a,dark:0x8e6f2a,cord:0x8a2a2a});
  S(g,'cyl',-1.4,1.6,0,2.8,3.4,2.8,C.metal).rotation.z=Math.PI/2;
  S(g,'box',1.9,1.5,0,3.6,1.3,2,C.metal,[.9,.7]);S(g,'ell',2.4,2.4,0,1.2,1.4,.9,C.dark);
  S(g,'cyl',-3.2,1.6,0,2.3,.6,2.3,C.dark).rotation.z=Math.PI/2;
  arc(g,-1,3.4,1.6,.1,Math.PI-.1,8,.45,.45,C.cord);
  S(g,'ell',-1,5.1,0,.8,.7,.5,C.metal);
  return tilt(g,0,-.35,0);
};
props.bell=function(g,P,C){
  C=def(C,{metal:0xc9a24a,dark:0x8e6f2a,hi:0xefd488,clapper:0x5a4a2a,wood:0x6a4a28});
  S(g,'cyl',0,3.6,0,5.4,5,5.4,C.metal,[.45,.45]);S(g,'cyl',0,1,0,6.8,1,6.8,C.metal,[.9,.9]);S(g,'cyl',0,.35,0,7.2,.55,7.2,C.dark);
  S(g,'ell',0,5.9,0,2.6,1.4,2.6,C.metal);S(g,'ell',-1.6,3.3,1.7,.8,3,.6,C.hi);
  S(g,'ell',0,6.7,0,1.2,1,1.2,C.dark);
  S(g,'ell',0,-.2,0,1.5,1.4,1.5,C.clapper);
  return g;
};
props.kit=function(g,P,C){
  /* the healer's kit: a leather satchel with a red cross, rolled bandages and a vial */
  C=def(C,{leather:0x7a4a2a,dark:0x5a3418,cross:0xc43a34,white:0xe8dcc0,strap:0x3b2616,buckle:0xc9a24a});
  S(g,'box',0,2.5,0,8,5,3.4,C.leather);S(g,'ell',0,5,0,8,2,3.4,C.dark);
  S(g,'box',0,2.4,1.78,7.6,4.4,.3,C.leather);
  S(g,'box',-1.9,3,1.95,3.5,3.5,.3,C.white);S(g,'box',-1.9,3,2.1,2.8,.9,.3,C.cross);S(g,'box',-1.9,3,2.1,.9,2.8,.3,C.cross);
  S(g,'box',2,1.6,1.95,.8,1.8,.3,C.buckle);S(g,'box',2,3.3,1.95,2,.5,.3,C.strap);
  arc(g,0,5.8,2,.15,Math.PI-.15,8,.7,.7,C.strap);
  S(g,'cyl',2.6,5.9,-.6,1.5,1.7,1.5,C.white).rotation.z=Math.PI/2;S(g,'cyl',3.7,5.9,-.6,1.2,.35,1.2,C.cross).rotation.z=Math.PI/2;
  return tilt(g,0,-.4,0);
};
props.pen=function(g,P,C){
  C=def(C,{quill:0xf0eadb,nib:0x2a2a2a,vane:0xe0d8c4,ink:0x2a2a40});
  seg(g,[0,0,0],[.6,11,0],.45,.45,C.quill,{k:'cyl'});
  for(var i=0;i<8;i++){var t=3+i*1,y=t,x=.6*t/11;
    S(g,'ell',x+.7+(i<3?0:.0),y+.5,0,1.6-(i*.1),1.8,.35,i%2?C.vane:C.quill);S(g,'ell',x-.7,y+.5,0,1.3,1.8,.35,i%2?C.quill:C.vane)}
  seg(g,[0,0,0],[-.1,-1.5,0],.5,.3,C.nib,{taper:[0,.2]});
  S(g,'ell',-.1,-1.6,0,.5,.5,.5,C.ink);
  return tilt(g,0,0,-.3);
};
})();
