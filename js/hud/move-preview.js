/* Hover to move (implementation plan, section 13.7). The rules layer produces the path and the cost; this only draws it:
   a dashed voxel arc from the hero to the hovered square, a ring and tint on the destination, dots along the real route,
   a soft blue tint on every square the remaining movement reaches, and a label with the distance in feet. A denied move turns
   the arc, ring and label red and says why. Pure view: it never asks the rules anything.

   var mp = Fable.createMovePreview({scene, camera, grid, hud})
   mp.setReachable([{c, r}])              tint the squares the hero can still reach
   mp.show(plan, fromXZ, destCell)        plan is a Fable.combat.planMove result
   mp.hide()
   mp.update(t, w, h)                     every frame: marches the dashes and places the label */
(function(){
var BLUE=0x4aa3ff,RED=0xe8584c;
var Y=.45;
function reduced(){try{return window.matchMedia('(prefers-reduced-motion:reduce)').matches}catch(e){return false}}

function flatMesh(size,color,opacity,cap){
  var g=new THREE.PlaneGeometry(size,size);g.rotateX(-Math.PI/2);
  var m=new THREE.InstancedMesh(g,new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:opacity,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),cap);
  m.count=0;m.frustumCulled=false;m.renderOrder=3;
  return m;
}

Fable.createMovePreview=function(o){
  var scene=o.scene,camera=o.camera,grid=o.grid,cell=grid.cell;
  var group=new THREE.Group();group.name='move-preview';scene.add(group);
  var dummy=new THREE.Object3D();

  var reach=flatMesh(cell*.92,BLUE,.17,1600);group.add(reach);
  var dest=flatMesh(cell*.94,BLUE,.34,1);group.add(dest);
  var trail=flatMesh(cell*.2,BLUE,.75,200);group.add(trail);
  var ringGeo=new THREE.RingGeometry(cell*.33,cell*.43,40);ringGeo.rotateX(-Math.PI/2);
  var ring=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:BLUE,transparent:true,opacity:.95,depthWrite:false,side:THREE.DoubleSide}));
  ring.position.y=Y+.1;ring.renderOrder=4;ring.visible=false;group.add(ring);
  var DASH_CAP=170;
  var dashGeo=new THREE.BoxGeometry(2.3,1.5,2.3);
  var dashes=new THREE.InstancedMesh(dashGeo,new THREE.MeshBasicMaterial({color:BLUE}),DASH_CAP);
  dashes.count=0;dashes.frustumCulled=false;dashes.renderOrder=5;group.add(dashes);

  var label=document.createElement('div');
  label.className='mv-label';
  label.setAttribute('aria-hidden','true');
  o.hud.root.appendChild(label);

  var state={shown:false,from:null,to:null,tone:'ok',apex:new THREE.Vector3(),curve:null,len:0,labelKey:''};
  var vec=new THREE.Vector3();

  function tone(t){
    var c=t==='ok'?BLUE:RED;
    dashes.material.color.setHex(c);ring.material.color.setHex(c);dest.material.color.setHex(c);trail.material.color.setHex(c);
  }

  function makeCurve(from,to){
    var a=new THREE.Vector3(from.x,7,from.z),b=new THREE.Vector3(to.x,1.5,to.z);
    var dist=a.distanceTo(b),lift=Math.min(26,7+dist*.16);
    var mid=a.clone().lerp(b,.5);mid.y+=lift*1.9;
    var curve=new THREE.QuadraticBezierCurve3(a,mid,b);
    state.curve=curve;
    state.len=curve.getLength();
    state.apex.copy(curve.getPoint(.5));
  }

  function placeDashes(t){
    if(!state.curve){dashes.count=0;return}
    var spacing=5.2,n=Math.min(DASH_CAP,Math.floor(state.len/spacing));
    var phase=reduced()?0:(t*9)%spacing;
    var count=0;
    for(var i=0;i<n;i++){
      var d=i*spacing+phase;
      if(d>state.len)break;
      var p=state.curve.getPointAt(d/state.len);
      dummy.position.copy(p);
      /* the dashes thin out towards both ends so the arc reads as leaving the hero and landing on the square */
      var u=d/state.len,s=Math.min(1,.55+Math.min(u,1-u)*5);
      dummy.scale.setScalar(s);dummy.rotation.set(0,0,0);dummy.updateMatrix();
      dashes.setMatrixAt(count++,dummy.matrix);
    }
    dashes.count=count;dashes.instanceMatrix.needsUpdate=true;
  }

  function setLabel(m){
    var key=m?m.tone+m.main+m.unit+m.sub:'';
    if(key===state.labelKey)return;
    state.labelKey=key;
    if(!m){label.classList.remove('show');return}
    label.className='mv-label'+(m.tone==='deny'?' deny':'');
    label.innerHTML='<div class="plate sm"><span class="edge"><span class="in"><b>'+o.hud.escape(m.main)+(m.unit?'<small>'+m.unit+'</small>':'')+'</b>'+(m.sub?'<span>'+o.hud.escape(m.sub)+'</span>':'')+'</span></span></div>';
  }

  var api={
    setReachable:function(list){
      var n=Math.min(list.length,1600);
      for(var i=0;i<n;i++){
        var p=Fable.grid.center(grid,list[i].c,list[i].r);
        dummy.position.set(p.x,Y,p.z);dummy.scale.setScalar(1);dummy.rotation.set(0,0,0);dummy.updateMatrix();
        reach.setMatrixAt(i,dummy.matrix);
      }
      reach.count=n;reach.instanceMatrix.needsUpdate=true;
    },
    show:function(plan,from,destCell){
      var m=Fable.hudModels.moveLabel(plan);
      if(!plan||!m||!destCell){api.hide();return}
      var G=Fable.grid,p=G.center(grid,destCell.c,destCell.r);
      state.shown=true;state.tone=m.tone;state.to=p;state.from=from;
      tone(m.tone);
      makeCurve(from,p);
      dummy.position.set(p.x,Y+.05,p.z);dummy.scale.setScalar(1);dummy.rotation.set(0,0,0);dummy.updateMatrix();
      dest.setMatrixAt(0,dummy.matrix);dest.count=1;dest.instanceMatrix.needsUpdate=true;
      ring.position.set(p.x,Y+.1,p.z);ring.visible=true;
      var path=plan.path||[],n=0;
      for(var i=1;i<path.length-1&&n<200;i++){
        var q=G.center(grid,path[i].c,path[i].r);
        dummy.position.set(q.x,Y+.08,q.z);dummy.scale.setScalar(1);dummy.updateMatrix();trail.setMatrixAt(n++,dummy.matrix);
      }
      trail.count=n;trail.instanceMatrix.needsUpdate=true;
      placeDashes(0);
      setLabel(m);
    },
    hide:function(){
      state.shown=false;state.curve=null;dashes.count=0;dest.count=0;trail.count=0;ring.visible=false;
      setLabel(null);
    },
    update:function(t,w,h){
      if(!state.shown){label.classList.remove('show');return}
      placeDashes(t);
      if(!reduced()){var k=1+Math.sin(t*5)*.07;ring.scale.set(k,1,k)}else ring.scale.set(1,1,1);
      vec.copy(state.apex).project(camera);
      var visible=vec.z<1&&vec.z>-1;
      var x=(vec.x*.5+.5)*w,y=(-vec.y*.5+.5)*h;
      x=Math.max(60,Math.min(w-60,x));y=Math.max(90,Math.min(h-120,y));
      label.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px) translate(-50%,-100%)';
      label.classList.toggle('show',visible);
    },
    dispose:function(){scene.remove(group);if(label.parentNode)label.parentNode.removeChild(label)}
  };
  return api;
};
})();
