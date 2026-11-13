/* Glimmerdeep Cavern (underdark): black basalt lit by glowing fungus and crystal, giant mushrooms, stalagmite thickets, a still underground
   river with a stone bridge, a ruined gate and an altar with a violet flame. The cave walls close in on every side. Units: 1 = 10 cm. */
(function(){
var K=Fable.mapKit,B={x:330,z:330},RIVER_Z=-110,GATE={x:-150,z:-190},ALTAR={x:160,z:-190};
var ZONES=[{id:'hollow-a',x:45,z:90,w:60,d:45},{id:'hollow-b',x:-85,z:60,w:60,d:45}];
function inRiver(x,z,p){return Math.abs(z-RIVER_Z-Math.sin(x*.025)*14)<17+p&&!(Math.abs(x-30)<14+p)}
Fable.content.maps.register({
  id:'glimmerdeep-cavern',name:'Glimmerdeep Cavern',environments:['underdark'],
  bounds:B,seed:20261108,sky:0x07060e,fog:{near:90,far:430},groundColor:0x0e0c14,
  light:{hemi:[0x7a6ac0,0x2e2440,.95],sun:[0x8a7ad0,.35],sunAt:[-60,140,40]},
  playerSpawn:{x:0,z:170,w:48,d:36,facing:Math.PI},enemySpawns:ZONES,
  isReserved:function(x,z,p){return inRiver(x,z,p+4)||Math.abs(x-GATE.x)<40+p&&Math.abs(z-GATE.z)<26+p||Math.hypot(x-ALTAR.x,z-ALTAR.z)<30+p},
  build:function(ctx){
    var r=ctx.rnd,G=ctx.ground,D=ctx.deco,S=ctx.solid,Gl=ctx.glow;
    var rock=[0x2a2630,0x24202c,0x302a38,0x1e1a26],moss=[0x2a4a5a,0x24425a,0x2e5a5a];
    K.ground(ctx,function(x,z){
      if(inRiver(x,z,0))return [0x101c34,0x0c1830,0x14224a][(r()*3)|0];
      var n=K.noise(x*.04,z*.04),m=K.noise(x*.1+7,z*.1);
      if(n>.66&&m>.4)return moss[(r()*3)|0];
      return rock[Math.min(3,((n+m)*2+r()*.5)|0)%4];
    });
    /* the river is a collider in strips, with a glassy sheet over it that shimmers */
    for(var x=-B.x;x<B.x;x+=12){if(Math.abs(x+6-30)<14)continue;ctx.addCollider(x+6,RIVER_Z+Math.sin(x*.025)*14,12,34,60)}
    var sheet=new THREE.Mesh(new THREE.PlaneGeometry(800,34),new THREE.MeshBasicMaterial({color:0x5a7ad8,transparent:true,opacity:.18,depthWrite:false}));
    sheet.rotation.x=-Math.PI/2;sheet.position.set(0,.5,RIVER_Z);ctx.scene.add(sheet);ctx.animated.push(function(t){sheet.material.opacity=.14+.08*Math.sin(t*1.2)});
    for(x=-B.x;x<B.x;x+=3)if(!(Math.abs(x-30)<14)){var rz=RIVER_Z+Math.sin(x*.025)*14;Gl.add(x,0,rz-17.5,3,.3,.6,0x3a5ab8);Gl.add(x,0,rz+17.5,3,.3,.6,0x3a5ab8)}
    /* the bridge */
    for(var i=0;i<9;i++)S.add(30,0,RIVER_Z-18+i*4.4+Math.sin(30*.025)*14,26,1.6+Math.sin(i/8*Math.PI)*1.6,4.2,[0x4a4650,0x403c48][i%2]);
    [-1,1].forEach(function(s){S.add(30+s*13.4,1,RIVER_Z+Math.sin(30*.025)*14,1.8,4,38,0x56525c)});
    /* glowing moss specks and spores on the ground */
    for(var k=0;k<2600;k++){var gx=(r()*2-1)*B.x,gz=(r()*2-1)*B.z;if(inRiver(gx,gz,0))continue;if(K.noise(gx*.04,gz*.04)>.62)Gl.add(gx,0,gz,.9,.3,.9,K.pick(r,[0x4ad8c8,0x3ac8b8,0x7af0d8]))}
    /* giant mushrooms: pale stems, wide glowing caps with gills under */
    function mushroom(x,z,H,col){
      K.column(S,x,0,z,5,H,function(){return 0xc8c0d8});
      K.blob(S,x,H+3,z,H*.9,5,H*.9,3,function(q,dy){return dy>.3?col:shade(col)});
      K.blob(Gl,x,H+2,z,H*.7,1.6,H*.7,3,function(){return col2(col)});
      ctx.addCollider(x,z,5,5,H);
    }
    function shade(c){return ((c>>16&255)*.7<<16)|((c>>8&255)*.7<<8)|((c&255)*.7)}
    function col2(c){return ((Math.min(255,(c>>16&255)*1.4))<<16)|((Math.min(255,(c>>8&255)*1.4))<<8)|Math.min(255,(c&255)*1.4)}
    var caps=[0x7a3ab8,0x2a8a9a,0xb83a8a,0x3a8ad0];
    K.scatter(ctx,{count:30,spacing:46,where:function(x,z){return !inRiver(x,z,12)}},function(x,z,i){mushroom(x,z,14+((r()*4)|0)*5,caps[i%4])});
    /* small clusters of glowing caps */
    K.scatter(ctx,{count:50,spacing:20,pad:2,where:function(x,z){return !inRiver(x,z,6)}},function(x,z){for(var j=0;j<4;j++){var h=2+r()*3,c=K.pick(r,caps),mx=x+(r()-.5)*8,mz=z+(r()-.5)*8;S.add(mx,0,mz,1,h,1,0xc8c0d8);Gl.add(mx,h,mz,3.4,1.4,3.4,c)}});
    /* crystals: tall hexagonal shards in clusters, each cluster lit */
    var cl=0;
    K.scatter(ctx,{count:14,spacing:70,where:function(x,z){return !inRiver(x,z,12)}},function(x,z,i){
      var c=[0x5a8aff,0xb05aff,0x4affd0][i%3];
      for(var j=0;j<6;j++){var a=j/6*Math.PI*2,rr=j?5+r()*3:0,H=j?8+r()*12:22+r()*8,sh=j?-.25+r()*.5:0;
        for(var y=0;y<H;y+=4)Gl.add(x+Math.cos(a)*rr+sh*y*.4,y,z+Math.sin(a)*rr,Math.max(1.4,4-y*.14),4,Math.max(1.4,4-y*.14),c)}
      ctx.addCollider(x,z,14,14,24);
      if(cl<4){ctx.light(c,1.1,120,x,16,z);cl++}});
    /* stalagmites: thick, banded, dark */
    K.scatter(ctx,{count:46,spacing:34,where:function(x,z){return !inRiver(x,z,8)}},function(x,z){var H=14+r()*34,R=4+r()*4;K.cone(S,x,0,z,R,H,4,function(k2,y){return K.pick(r,[0x3a3442,0x2e2a38,0x443c4c])});ctx.addCollider(x,z,R*1.6,R*1.6,H)});
    /* the ruined gate: two fluted pillars, a fallen lintel and rubble */
    var gx0=GATE.x,gz0=GATE.z,st=[0x5a5664,0x4a4654,0x666274];
    [-1,1].forEach(function(s){K.column(S,gx0+s*16,0,gz0,9,s>0?44:30,function(){return K.pick(r,st)});S.add(gx0+s*16,s>0?44:30,gz0,11,3,11,st[2]);ctx.addCollider(gx0+s*16,gz0,9,9,s>0?44:30)});
    S.add(gx0-6,0,gz0+10,26,5,6,st[1]);S.add(gx0+2,5,gz0+11,16,3,5,st[0]);ctx.addCollider(gx0-4,gz0+10,26,6,6);
    for(i=0;i<10;i++)S.add(gx0+(r()-.5)*50,0,gz0+(r()-.5)*26,2+r()*5,1.4+r()*3,2+r()*4,K.pick(r,st));
    Gl.add(gx0,2,gz0-2,.8,30,.8,0x7a5aff);Gl.add(gx0+16,26,gz0+5,2,3,2,0x9a7aff);
    /* the altar: a stepped dais, a basin and a violet flame that flickers */
    var ax=ALTAR.x,az=ALTAR.z;
    for(i=0;i<3;i++)S.add(ax,i*2,az,28-i*7,2,28-i*7,st[i%3]);
    S.add(ax,6,az,8,6,8,st[1]);S.add(ax,12,az,12,2,12,st[2]);ctx.addCollider(ax,az,28,28,12);
    var flame=new THREE.Mesh(new THREE.ConeGeometry(3.4,11,6),new THREE.MeshBasicMaterial({color:0xb06aff,transparent:true,opacity:.85}));
    flame.position.set(ax,19,az);ctx.scene.add(flame);var fl=ctx.light(0xa86aff,1.6,150,ax,20,az);
    ctx.animated.push(function(t){flame.scale.set(1+.15*Math.sin(t*9),1+.2*Math.sin(t*7+1),1+.15*Math.sin(t*8));if(fl)fl.intensity=1.4+.4*Math.sin(t*9)});
    /* the cavern wall: tall stone masses all round with stalactite fangs hanging from their upper edge */
    K.border(ctx,{off:24,step:34,vary:18,jitter:18},function(x,z){var H=60+r()*70,R=22+r()*14;K.cone(S,x,0,z,R,H,6,function(k2,y){return K.pick(r,[0x2a2632,0x221e2a,0x34303c])});
      for(var j=0;j<3;j++)Gl.add(x+(r()-.5)*20,10+r()*30,z+(r()-.5)*20,1.2,1.2,1.2,K.pick(r,[0x4ad8c8,0x7a5aff]))});
    K.border(ctx,{off:70,step:70,vary:30,jitter:30},function(x,z){var H=120+r()*80;K.cone(S,x,0,z,46,H,8,function(){return 0x1c1824})});
    /* drifting spores */
    var N=420,pos=new Float32Array(N*3),geo=new THREE.BufferGeometry();
    for(i=0;i<N;i++){pos[i*3]=(r()*2-1)*170;pos[i*3+1]=r()*60;pos[i*3+2]=(r()*2-1)*170}
    geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
    var pts=new THREE.Points(geo,new THREE.PointsMaterial({color:0x8affea,size:1.5,fog:false,transparent:true,opacity:.8,depthWrite:false}));pts.frustumCulled=false;ctx.scene.add(pts);
    ctx.animated.push(function(t){pts.position.x=ctx.focus.x;pts.position.z=ctx.focus.z;for(var j=0;j<N;j++){var y=pos[j*3+1]+.05;if(y>60)y-=60;pos[j*3+1]=y;pos[j*3]+=Math.sin(t*.6+j)*.04}geo.attributes.position.needsUpdate=true});
  }
});
})();
