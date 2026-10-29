/* Visual effect recipes (implementation plan, section 15.5, 15.10). Sizes are world units: a creature is about 15 to 20 tall and a
   grid square is 15 wide. A recipe's colours can be replaced by the planner (a damage type tint), so one recipe serves several uses. */
(function(){
var E=Fable.content.effects;
var BLOOD=[0x8a1414,0x6e0f0f,0xa51c1c,0x5a0c0c];
function fx(id,name,parts){return {id:id,name:name,source:'original',parts:parts}}
var WHITE=[0xffffff,0xfff4d6,0xdfe9f5],WARM=[0xffd27a,0xffa64a,0xff7a2a],DUST=[0x9b8a6a,0x7d6f55,0xb2a07c],GREEN=[0x9dff9d,0x5cf08a,0xd8ffd0],GOLD=[0xffe08a,0xffc94d,0xfff2c0];
E.registerAll([
  fx('fx-slash-arc','Blade sweep',[{type:'arc',count:16,radius:11,from:-1.3,to:1.1,y:11,life:.2,dur:.12,size:1.5,colors:[0xaec8e6,0xe9f3ff,0xffffff],glow:true,lift:3}]),
  fx('fx-thrust-streak','Thrust streak',[{type:'burst',count:10,speed:[60,120],spread:.12,lift:0,life:[.08,.16],size:[.6,1],end:0,colors:WHITE,glow:true,gravity:0,drag:6,y:10,stagger:.04}]),
  fx('fx-chop-arc','Heavy sweep',[{type:'arc',count:18,radius:10,from:-.5,to:.5,y:15,lift:-14,life:.22,dur:.12,size:1.8,colors:[0xffd9a0,0xffffff],glow:true}]),
  fx('fx-hit','Hit',[
    {type:'burst',count:14,speed:[40,90],spread:2.4,lift:.35,life:[.18,.4],size:[.5,1],end:0,colors:WHITE,glow:true,gravity:60,drag:2,y:10},
    {type:'burst',count:7,speed:[18,40],spread:2.8,lift:.5,life:[.35,.7],size:[.6,1.1],end:.3,colors:DUST,gravity:70,drag:1.2,y:8,bounce:true},
    {type:'ring',from:2,to:11,dur:.28,color:0xffffff,opacity:.55},
    {type:'light',color:0xffe3a0,intensity:1.6,dur:.22,y:10}]),
  fx('fx-hit-crit','Critical hit',[
    {type:'burst',count:34,speed:[50,130],spread:3.2,lift:.4,life:[.25,.6],size:[.6,1.4],end:0,colors:[0xffffff,0xffd24a,0xff9a30],glow:true,gravity:55,drag:1.6,y:10},
    {type:'burst',count:12,speed:[25,55],spread:3,lift:.6,life:[.5,.9],size:[.8,1.5],end:.2,colors:DUST,gravity:80,drag:1,y:6,bounce:true},
    {type:'ring',from:2,to:20,dur:.4,color:0xffd27a,opacity:.9},{type:'ring',from:1,to:13,dur:.3,color:0xffffff,opacity:.7,delay:.04},
    {type:'light',color:0xffd27a,intensity:2.8,dur:.4,y:10,range:90}]),
  fx('fx-hit-heavy','Heavy impact',[
    {type:'burst',count:22,speed:[40,100],spread:3,lift:.3,life:[.3,.7],size:[.8,1.6],end:.2,colors:DUST,gravity:80,drag:1.2,y:4,bounce:true},
    {type:'burst',count:16,speed:[50,110],spread:3,lift:.4,life:[.2,.45],size:[.5,1],end:0,colors:WARM,glow:true,gravity:50,drag:2,y:9},
    {type:'ring',from:2,to:18,dur:.35,color:0xffc070,opacity:.7},{type:'light',color:0xffb060,intensity:2.2,dur:.3,y:8}]),
  fx('fx-miss','Whiff',[{type:'burst',count:6,speed:[25,50],spread:1.2,lift:.2,life:[.15,.3],size:[.4,.7],end:0,colors:[0xcfe0f0,0xffffff],glow:true,gravity:0,drag:5,y:10}]),
  fx('fx-block','Shield spark',[{type:'burst',count:16,speed:[40,100],spread:2,lift:.3,life:[.15,.35],size:[.5,.9],end:0,colors:[0xfff2b0,0xffffff,0xffc060],glow:true,gravity:50,drag:2,y:10},
    {type:'ring',from:1,to:9,dur:.22,color:0xfff2b0,opacity:.6},{type:'light',color:0xffe8a0,intensity:1.4,dur:.18,y:10}]),
  fx('fx-step','Footstep dust',[{type:'burst',count:3,speed:[5,12],spread:3.2,lift:.5,life:[.25,.45],size:[.7,1.2],end:1.6,colors:DUST,gravity:-4,drag:2,y:.6,radius:1.2}]),
  fx('fx-run-dust','Sprint dust',[{type:'burst',count:5,speed:[8,18],spread:3.2,lift:.4,life:[.3,.55],size:[.8,1.4],end:1.8,colors:DUST,gravity:-3,drag:2,y:.6,radius:1.5}]),
  fx('fx-land','Landing dust',[{type:'burst',count:14,speed:[14,36],spread:3.2,lift:.15,life:[.35,.7],size:[.9,1.6],end:1.7,colors:DUST,gravity:-2,drag:2,y:.6,radius:2},{type:'ring',from:1,to:9,dur:.4,color:0xb09a70,opacity:.4}]),
  fx('fx-thud','Body falls',[{type:'burst',count:18,speed:[16,40],spread:3.2,lift:.15,life:[.4,.8],size:[1,1.8],end:1.8,colors:DUST,gravity:-2,drag:2,y:.6,radius:5},{type:'ring',from:3,to:15,dur:.45,color:0xb09a70,opacity:.45}]),
  fx('fx-death','Defeat',[{type:'burst',count:26,speed:[8,26],spread:3.2,lift:1.2,life:[.7,1.4],size:[.7,1.3],end:0,colors:[0x6b6b6b,0x8a8a8a,0x4c4c4c,0xc8c0a8],gravity:-12,drag:1.2,y:3,radius:5,stagger:.2}]),
  /* blood: a spray as a creature drops (the drops that land stain the floor), and the pool that spreads under the body and stays */
  fx('fx-blood','Blood spray',[
    {type:'burst',count:26,speed:[24,70],spread:3.2,lift:.75,life:[.5,.9],size:[.7,1.4],end:.5,colors:BLOOD,gravity:140,drag:.8,y:9,radius:2,stain:[1],keepColor:true},
    {type:'burst',count:10,speed:[8,26],spread:3.2,lift:.5,life:[.4,.8],size:[.9,1.6],end:.3,colors:BLOOD,gravity:90,drag:1.4,y:6,radius:2,stain:[1.2],keepColor:true}]),
  fx('fx-blood-pool','Blood pool',[{type:'decal',count:9,radius:6,size:[2,4.2],colors:BLOOD,grow:.9}]),
  fx('fx-coin-glint','Coin glint',[{type:'burst',count:12,speed:[8,26],spread:3.2,lift:1.1,life:[.4,.8],size:[.5,.9],end:0,colors:GOLD,glow:true,gravity:30,drag:1.4,y:2,radius:3,keepColor:true},
    {type:'ring',from:2,to:9,dur:.35,color:0xffe08a,opacity:.5}]),
  fx('fx-heal','Healing',[
    {type:'burst',count:22,speed:[10,26],spread:3.2,lift:1.3,life:[.7,1.3],size:[.5,1],end:0,colors:GREEN,glow:true,gravity:-16,drag:1,y:2,radius:5,stagger:.4,keepColor:true},
    {type:'ring',from:3,to:12,dur:.7,color:0x7dffa0,opacity:.7},{type:'light',color:0x80ffa0,intensity:1.6,dur:.9,y:10}]),
  fx('fx-surge','Second Wind surge',[
    {type:'burst',count:30,speed:[14,36],spread:3.2,lift:1.2,life:[.7,1.4],size:[.6,1.2],end:0,colors:[0x8dffb0,0xfff0a0,0xffffff],glow:true,gravity:-18,drag:1,y:2,radius:5,stagger:.5,keepColor:true},
    {type:'ring',from:2,to:16,dur:.8,color:0xa8ffc0,opacity:.8},{type:'ring',from:2,to:11,dur:.6,color:0xfff0a0,opacity:.6,delay:.12},{type:'light',color:0xa0ffc0,intensity:2.2,dur:1,y:10}]),
  fx('fx-star','Heroic Inspiration',[
    {type:'burst',count:26,speed:[30,75],spread:3.2,lift:.5,life:[.5,1],size:[.6,1.2],end:0,colors:GOLD,glow:true,gravity:10,drag:1.8,y:16,keepColor:true},
    {type:'ring',from:2,to:15,dur:.55,color:0xffe08a,opacity:.8,y:16},{type:'light',color:0xffe08a,intensity:2.4,dur:.8,y:16}]),
  fx('fx-swap','Weapon change',[{type:'burst',count:10,speed:[14,30],spread:3.2,lift:.6,life:[.3,.6],size:[.4,.8],end:0,colors:[0xdfe9f5,0xffffff],glow:true,gravity:10,drag:1.5,y:10,radius:4}]),
  fx('fx-aura-sapped','Sapped',[{type:'burst',count:1,speed:[4,8],spread:3.2,lift:1,life:[.7,1.1],size:[.7,1.1],end:.3,colors:[0xb4a2e8,0x8a78c8],glow:true,gravity:-6,drag:1,y:20,radius:3,keepColor:true}]),
  fx('fx-aura-slowed','Slowed',[{type:'burst',count:1,speed:[3,6],spread:3.2,lift:.2,life:[.8,1.2],size:[.8,1.2],end:.2,colors:[0x9ad8ff,0xcff0ff],glow:true,gravity:6,drag:1,y:3,radius:4,keepColor:true}]),
  fx('fx-aura-vexed','Vexed',[{type:'burst',count:1,speed:[6,10],spread:3.2,lift:1,life:[.6,.9],size:[.6,1],end:0,colors:[0xff8c8c,0xff5a5a],glow:true,gravity:-8,drag:1,y:22,radius:2,keepColor:true}]),
  fx('fx-aura-dodging','Dodge stance',[{type:'burst',count:2,speed:[10,16],spread:3.2,lift:.4,life:[.4,.7],size:[.5,.9],end:0,colors:[0xdff2ff,0xffffff],glow:true,gravity:0,drag:2,y:8,radius:7,keepColor:true},
    {type:'ring',from:7,to:10,dur:.55,color:0xbfe3ff,opacity:.55}]),
  fx('fx-dodge','Dodge',[
    {type:'ring',from:3,to:17,dur:.38,color:0xbfe3ff,opacity:.85},{type:'ring',from:2,to:11,dur:.3,color:0xffffff,opacity:.7,delay:.08},
    {type:'burst',count:22,speed:[20,52],spread:3.2,lift:1.2,life:[.4,.85],size:[.6,1.2],end:0,colors:[0xdff2ff,0xffffff,0x9ad8ff],glow:true,gravity:-12,drag:1.6,y:3,radius:8,keepColor:true},
    {type:'light',color:0xbfe3ff,intensity:1.8,dur:.32,y:9}]),
  fx('fx-aura-prone','Prone',[{type:'burst',count:1,speed:[3,6],spread:3.2,lift:.2,life:[.6,1],size:[.6,1],end:1.4,colors:DUST,gravity:-2,drag:1,y:1,radius:6}]),
  fx('fx-aura-hidden','Hidden',[{type:'burst',count:1,speed:[4,8],spread:3.2,lift:.5,life:[.8,1.2],size:[.6,1],end:.2,colors:[0x6a8a58,0x4c6a3e],gravity:-3,drag:1,y:6,radius:5}]),
  fx('fx-victory','Victory motes',[{type:'burst',count:50,speed:[16,48],spread:3.2,lift:1.2,life:[1,2],size:[.7,1.4],end:.3,colors:GOLD,glow:true,gravity:-3,drag:.8,y:6,radius:22,stagger:1.2,keepColor:true},
    {type:'ring',from:3,to:40,dur:1.2,color:0xffe08a,opacity:.6},{type:'light',color:0xffe3a0,intensity:2,dur:1.6,y:20,range:120}]),
  fx('fx-pop','Ambush pop',[{type:'burst',count:20,speed:[20,55],spread:3.2,lift:.8,life:[.4,.8],size:[.8,1.5],end:1.2,colors:[0x4f7a2c,0x6c9a3e,0x7d6f55],gravity:40,drag:1.2,y:2,radius:5},{type:'ring',from:2,to:12,dur:.35,color:0x8fbf5a,opacity:.5}]),
  fx('fx-trail','Projectile trail',[{type:'burst',count:2,speed:[2,6],spread:3.2,lift:0,life:[.12,.22],size:[.5,.8],end:0,colors:[0xdfe6ea,0xffffff],glow:true,gravity:0,drag:3}]),
  fx('fx-skid','Backstep dust',[{type:'burst',count:8,speed:[10,24],spread:1.2,lift:.2,life:[.3,.6],size:[.8,1.3],end:1.6,colors:DUST,gravity:-2,drag:2.5,y:.6,radius:2}])
]);
})();
