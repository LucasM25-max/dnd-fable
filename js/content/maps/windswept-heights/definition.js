/* Windswept Heights (hill): heather and gorse on rounded hills, a ruined hill fort with its ditch and broken wall, a dolmen, a drystone
   sheepfold, cairns along a ridge path and big green hills rolling away on every side. Units: 1 = 10 cm. */
(function(){
var K=Fable.mapKit,B={x:330,z:330},FORT={x:-120,z:-120},DOLMEN={x:170,z:-80};
var ZONES=[{id:'slope-a',x:50,z:90,w:60,d:45},{id:'slope-b',x:-85,z:65,w:60,d:45}];
function ridge(z){return 40*Math.sin(z*.016)+20*Math.sin(z*.05)}
function onPath(x,z){return Math.abs(x-ridge(z)*.6-60)<5&&z>-250}
Fable.content.maps.register({
  id:'windswept-heights',name:'Windswept Heights',environments:['hill'],
  bounds:B,seed:20261105,sky:0xb4cce0,fog:{near:240,far:820},groundColor:0x6c8450,
  light:{hemi:[0xdde9f4,0x6a6a44,.9],sun:[0xfff0d4,.95],sunAt:[-100,120,80]},
  playerSpawn:{x:0,z:170,w:48,d:36,facing:Math.PI},enemySpawns:ZONES,
  isReserved:function(x,z,p){return Math.abs(x-FORT.x)<66+p&&Math.abs(z-FORT.z)<58+p||Math.hypot(x-DOLMEN.x,z-DOLMEN.z)<22+p||onPath(x,z)&&p<4},
  build:function(ctx){
    var r=ctx.rnd,D=ctx.deco,S=ctx.solid;
    var grass=[0x5f8240,0x567a38,0x6a8a48,0x4e7032],heath=[0x80627a,0x72566e,0x8e6e86],rock=[0x7a766c,0x6a665c,0x8a867a];
    K.ground(ctx,function(x,z){
      if(onPath(x,z))return [0x9a8a6a,0x8a7a5a][(r()*2)|0];
      var n=K.noise(x*.018,z*.018),m=K.noise(x*.07+4,z*.07);
      if(n>.68&&m>.5)return heath[(r()*3)|0];
      if(m>.78)return rock[(r()*3)|0];
      return grass[Math.min(3,((n+m)*2+r()*.4)|0)%4];
    });
    for(var k=0;k<6500;k++){var x=(r()*2-1)*B.x,z=(r()*2-1)*B.z;if(onPath(x,z))continue;var c=K.noise(x*.018,z*.018)>.6?K.pick(r,heath):K.pick(r,[0x7a9a4e,0x8aa85a]);D.add(x,0,z,.7,1.4+r()*2.2,.7,c)}
    /* low turf mounds on the play area, high rounded hills behind them */
    K.scatter(ctx,{count:18,spacing:62,pad:0},function(x,z){var s=.8+r()*.8;K.blob(D,x,0,z,s*26,s*3,s*20,3,function(q,dy){return dy>.4?0x688a46:0x5f8240})});
    K.border(ctx,{off:30,step:64,vary:30,jitter:26},function(x,z){var s=1.3+r()*1.1;K.blob(S,x,s*4,z,s*46,s*22,s*38,10,function(q,dy){return dy>.35?K.pick(r,[0x7a9a52,0x84a45a]):0x6c8c46})});
    K.border(ctx,{off:70,step:120,vary:40,jitter:40},function(x,z){var s=2+r();K.blob(S,x,s*5,z,s*50,s*30,s*42,14,function(q,dy){return dy>.5?0x8aa860:0x6c8c46})});
    /* gorse and thorn: yellow-starred bushes, windbent hawthorns */
    K.scatter(ctx,{count:44,spacing:24},function(x,z){var s=.7+r()*.6;K.blob(S,x,s*3,z,s*6,s*3.4,s*6,2.4,function(){return K.pick(r,[0x4f7a34,0x3f6a2c])});
      for(var j=0;j<7;j++)D.add(x+(r()-.5)*s*10,s*3+r()*s*3,z+(r()-.5)*s*10,1,1,1,0xe8c82a);ctx.addCollider(x,z,s*10,s*10,s*6)});
    K.scatter(ctx,{count:16,spacing:60},function(x,z){
      for(var y=0;y<18;y+=4)S.add(x+y*.18,y,z,3.2,4,3.2,0x4a3524);K.blob(S,x+5,20,z,10,5,8,3,function(q,dy){return dy>.3?0x5a823e:0x4a6e34});ctx.addCollider(x,z,3.4,3.4,18)});
    /* the hill fort: an earthen bank round a ruined stone wall, a gate gap to the south, a round-house foundation inside */
    var fx=FORT.x,fz=FORT.z,stn=function(){return K.pick(r,[0x827d70,0x76715f,0x8e897c])};
    K.wall(ctx,fx,fz-56,120,'x',16,6,stn);K.wall(ctx,fx-60,fz,112,'z',12,6,stn);K.wall(ctx,fx+60,fz,112,'z',20,6,stn);
    K.wall(ctx,fx-34,fz+56,52,'x',10,6,stn);K.wall(ctx,fx+34,fz+56,52,'x',14,6,stn);
    K.column(S,fx-9,0,fz+56,8,26,stn);K.column(S,fx+9,0,fz+56,8,18,stn);ctx.addCollider(fx-9,fz+56,8,8,26);ctx.addCollider(fx+9,fz+56,8,8,18);
    for(var a=0;a<Math.PI*2;a+=.22){S.add(fx+Math.cos(a)*18,0,fz+Math.sin(a)*18,4,3,4,stn())}
    ctx.addCollider(fx,fz-18,36,6,3.2);ctx.addCollider(fx,fz+18,36,6,3.2);
    for(var i=0;i<14;i++){var rx=fx+(r()-.5)*110,rz=fz+(r()-.5)*100;if(Math.abs(rx-fx)<22&&Math.abs(rz-fz)<22)continue;S.add(rx,0,rz,2+r()*5,1.5+r()*3,2+r()*4,stn())}
    /* a dolmen: three uprights and a capstone, leaning slightly */
    var dx=DOLMEN.x,dz=DOLMEN.z;
    [[-9,-5],[9,-5],[0,8]].forEach(function(p){K.column(S,dx+p[0],0,dz+p[1],7,22,stn);ctx.addCollider(dx+p[0],dz+p[1],7,7,22)});
    S.add(dx,22,dz,30,5,22,0x6e6a5e);S.add(dx+2,27,dz+1,18,3,14,0x76725f);
    /* a drystone sheepfold with a gap, and cairns up the ridge path */
    var sx=215,sz=120;for(var q=0;q<12;q++){if(q===5||q===6)continue;var aq=q/12*Math.PI*2;K.wall(ctx,sx+Math.cos(aq)*26,sz+Math.sin(aq)*26,16,Math.abs(Math.cos(aq))>.7?'z':'x',7,4,stn)}
    for(i=0;i<7;i++){var cz=-230+i*52,cx=ridge(cz)*.6+60+(i%2?12:-12);var s2=.7+r()*.3;K.blob(S,cx,s2*3,cz,s2*6,s2*5,s2*6,2,function(){return stn()});ctx.addCollider(cx,cz,s2*11,s2*11,s2*8)}
    K.scatter(ctx,{count:16,spacing:54},function(x,z){var s=.6+r()*.8;K.blob(S,x,s*3,z,s*7,s*4,s*6,2.4,function(){return stn()});ctx.addCollider(x,z,s*12,s*10,s*7)});
    /* standing stones along the north edge, ravens' nest on the tallest */
    for(i=0;i<5;i++){var ux=-200+i*80,uz=-290,uh=18+((r()*3)|0)*5;K.column(S,ux,0,uz,6,uh,stn);ctx.addCollider(ux,uz,6,6,uh)}
  }
});
})();
