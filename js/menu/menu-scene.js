/* Hub scene: voxel tavern, podium, human fighter, embers. */
(function(){
var b=Fable.b;
var S=new THREE.Scene();S.background=new THREE.Color(0x120a06);S.fog=new THREE.Fog(0x120a06,70,150);
var cam=new THREE.PerspectiveCamera(38,1,.1,300);

// lights
S.add(new THREE.HemisphereLight(0xb89b7a,0x2a1a10,.75));
var sun=new THREE.DirectionalLight(0xffd9a0,.75);sun.position.set(-26,46,48);sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);var sc=sun.shadow.camera;sc.left=-40;sc.right=40;sc.top=40;sc.bottom=-40;sc.near=10;sc.far=140;S.add(sun);
var fireL=new THREE.PointLight(0xff7a22,1.5,70);fireL.position.set(0,6,-24);S.add(fireL);


var tav=Fable.buildTavern(S),T=tav.T,flames=tav.flames;
var fg=Fable.createHumanFighter(),F=fg.root,H=fg.H,C=fg.C,AL=fg.AL,AR=fg.AR;
F.position.set(0,2.05,6);S.add(F);
function disc(R,y,h,c,lo,hi,g){for(var x=-R;x<=R;x++)for(var z=-R;z<=R;z++){var d=Math.sqrt(x*x+z*z);if(d<=hi&&d>=lo)b(T,x,y,6+z,1,h,1,c,2,g)}}
disc(10,.9,1.8,0x2d1b55,0,10.3);disc(8,1.9,.3,0x6a4ad8,0,8.3);disc(10,1.95,.3,0xffd23f,8.4,9.3,1);

// embers
var N=50,pg=new THREE.BufferGeometry(),pp=new Float32Array(N*3),pv=[];
for(var k=0;k<N;k++){pp[k*3]=(Math.random()-.5)*10;pp[k*3+1]=Math.random()*20+3;pp[k*3+2]=-27+Math.random()*3;pv.push(.04+Math.random()*.08)}
pg.setAttribute('position',new THREE.BufferAttribute(pp,3));
S.add(new THREE.Points(pg,new THREE.PointsMaterial({color:0xffb347,size:.6,transparent:true,opacity:.9})));

var mx=0,my=0,reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
window.addEventListener('pointermove',function(e){mx=e.clientX/window.innerWidth*2-1;my=e.clientY/window.innerHeight*2-1});

function resize(w,h){cam.aspect=w/h;cam.position.z=w/h<1.2?68:47;cam.updateProjectionMatrix()}
function update(ms){
  var t=reduce?0:ms/1000;
  F.position.y=2.05+Math.sin(t*1.7)*.1;
  F.rotation.y+=(mx*.35-F.rotation.y)*.06;
  H.rotation.y=mx*.3;H.rotation.x=my*.12;
  C.rotation.x=.1+Math.sin(t*1.3)*.05;
  AL.rotation.x=-.3+Math.sin(t*1.7)*.02;AR.rotation.x=-.9+Math.sin(t*1.7+1)*.03;
  flames.forEach(function(f,i){f.scale.y=(i%2?2:3.2)+Math.sin(t*9+i*1.7)*.7;f.position.y=2.6+f.scale.y*.5+(i%2?.8:0);f.scale.x=f.scale.z=1.5+Math.sin(t*7+i)*.3});
  fireL.intensity=1.5+Math.sin(t*11)*.25+Math.sin(t*17)*.15;
  var a=pg.attributes.position.array;
  for(var k=0;k<N;k++){a[k*3+1]+=reduce?0:pv[k];a[k*3]+=Math.sin(t*2+k)*.01;if(a[k*3+1]>28){a[k*3+1]=3;a[k*3]=(Math.random()-.5)*10}}
  pg.attributes.position.needsUpdate=true;
  cam.position.x+=(mx*3-cam.position.x)*.05;cam.position.y=12-my*1.2;
  cam.lookAt(0,10.5,0);
  
}
Fable.menuScene={scene:S,camera:cam,update:update,resize:resize};
})();
