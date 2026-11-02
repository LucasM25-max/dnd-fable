/* Marks drawn on the ground itself (implementation plan, section 13.7): a faint grid around the creature whose turn it is,
   a darker tint on squares that are solid (trees, walls), and a ring under the active creature, gold for the hero and red
   for an enemy. View only; it is told where to draw and never asks the rules anything.

   var wm = Fable.createWorldMarks({scene, grid})
   wm.setActive(cell, team)      move the grid window and the ring
   wm.follow(x, z)               keep the ring under a walking creature
   wm.setTarget(info)            mark the creature the pointer is on: info {x, z, ok, others:[{x,z}]} or null. One circle on the floor under the
                                 target, and a fainter one under each other enemy the armed attack could reach. Nothing else: no brackets, no
                                 arrow, no line. The colours are the movement colours: blue when the attack can be made, red when it cannot.
   wm.setHints(cells)            the tutorial only: glow the squares in cells [{c, r}] (the ones the player is asked to click); [] or null clears them
   wm.setBeacon(pos)             the tutorial only: a pulsing gold ring under the creature the player is asked to attack, {x, z} or null
   wm.update(t)                  pulse the ring, the target circle and the tutorial marks */
(function(){
var RADIUS=9,Y=.4;
function reduced(){try{return window.matchMedia('(prefers-reduced-motion:reduce)').matches}catch(e){return false}}

Fable.createWorldMarks=function(o){
  var grid=o.grid,cell=grid.cell,G=Fable.grid;
  var group=new THREE.Group();group.name='world-marks';o.scene.add(group);

  var span=RADIUS*2+2,maxSeg=(span+1)*2;
  var pos=new Float32Array(maxSeg*2*3);
  var lineGeo=new THREE.BufferGeometry();
  lineGeo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  var lines=new THREE.LineSegments(lineGeo,new THREE.LineBasicMaterial({color:0xf0d89a,transparent:true,opacity:.2,depthWrite:false}));
  lines.frustumCulled=false;lines.renderOrder=2;group.add(lines);

  var solidGeo=new THREE.PlaneGeometry(cell*.96,cell*.96);solidGeo.rotateX(-Math.PI/2);
  var solid=new THREE.InstancedMesh(solidGeo,new THREE.MeshBasicMaterial({color:0xa8322b,transparent:true,opacity:.22,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),span*span);
  solid.count=0;solid.frustumCulled=false;solid.renderOrder=2;group.add(solid);

  var ringGeo=new THREE.RingGeometry(cell*.36,cell*.44,40);ringGeo.rotateX(-Math.PI/2);
  var ringMat=new THREE.MeshBasicMaterial({color:0xf0b94d,transparent:true,opacity:.95,depthWrite:false,side:THREE.DoubleSide});
  var ring=new THREE.Mesh(ringGeo,ringMat);ring.renderOrder=4;ring.visible=false;group.add(ring);
  var fillGeo=new THREE.PlaneGeometry(cell*.94,cell*.94);fillGeo.rotateX(-Math.PI/2);
  var fill=new THREE.Mesh(fillGeo,new THREE.MeshBasicMaterial({color:0xf0b94d,transparent:true,opacity:.16,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
  fill.renderOrder=3;fill.visible=false;group.add(fill);

  /* the target circle: the same two colours as the move preview, blue for can and red for cannot */
  var OK=Fable.hudModels.COLORS.ok,DENY=Fable.hudModels.COLORS.deny;
  var tgt=new THREE.Group();tgt.visible=false;group.add(tgt);
  var tRingMat=new THREE.MeshBasicMaterial({color:OK,transparent:true,opacity:.95,depthWrite:false,side:THREE.DoubleSide});
  var tRingGeo=new THREE.RingGeometry(cell*.42,cell*.5,48);tRingGeo.rotateX(-Math.PI/2);
  var tRing=new THREE.Mesh(tRingGeo,tRingMat);tRing.renderOrder=6;tgt.add(tRing);
  var tFillMat=new THREE.MeshBasicMaterial({color:OK,transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide});
  var tFillGeo=new THREE.CircleGeometry(cell*.42,40);tFillGeo.rotateX(-Math.PI/2);
  var tFill=new THREE.Mesh(tFillGeo,tFillMat);tFill.renderOrder=5;tFill.position.y=-.05;tgt.add(tFill);
  var faintMat=new THREE.MeshBasicMaterial({color:OK,transparent:true,opacity:.4,depthWrite:false,side:THREE.DoubleSide});
  var faint=[];
  for(var fi=0;fi<4;fi++){var fm=new THREE.Mesh(tRingGeo,faintMat);fm.renderOrder=4;fm.visible=false;fm.scale.set(.9,1,.9);group.add(fm);faint.push(fm)}
  var targetOk=true;

  /* tutorial marks: glowing squares and a beacon ring, drawn only while a lesson asks for them */
  var HINT_MAX=12,hintGeo=new THREE.PlaneGeometry(cell*.92,cell*.92);hintGeo.rotateX(-Math.PI/2);
  var hintMat=new THREE.MeshBasicMaterial({color:0xf6d36b,transparent:true,opacity:.35,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
  var hints=new THREE.InstancedMesh(hintGeo,hintMat,HINT_MAX);hints.count=0;hints.frustumCulled=false;hints.renderOrder=5;group.add(hints);
  var hintEdgeGeo=new THREE.RingGeometry(cell*.38,cell*.44,4,1,Math.PI/4);hintEdgeGeo.rotateX(-Math.PI/2);
  var hintEdges=new THREE.InstancedMesh(hintEdgeGeo,new THREE.MeshBasicMaterial({color:0xfff1c4,transparent:true,opacity:.9,depthWrite:false,side:THREE.DoubleSide}),HINT_MAX);
  hintEdges.count=0;hintEdges.frustumCulled=false;hintEdges.renderOrder=6;group.add(hintEdges);
  var beaconMat=new THREE.MeshBasicMaterial({color:0xf6d36b,transparent:true,opacity:.95,depthWrite:false,side:THREE.DoubleSide});
  var beaconGeo=new THREE.RingGeometry(cell*.56,cell*.66,48);beaconGeo.rotateX(-Math.PI/2);
  var beacon=new THREE.Mesh(beaconGeo,beaconMat);beacon.renderOrder=6;beacon.visible=false;group.add(beacon);

  var dummy=new THREE.Object3D();

  return {
    setActive:function(c,team){
      if(!c){ring.visible=false;fill.visible=false;lines.visible=false;solid.count=0;return}
      lines.visible=true;
      var c0=Math.max(0,c.c-RADIUS),c1=Math.min(grid.cols,c.c+RADIUS+1),r0=Math.max(0,c.r-RADIUS),r1=Math.min(grid.rows,c.r+RADIUS+1);
      var k=0;
      function seg(x0,z0,x1,z1){pos[k++]=x0;pos[k++]=Y;pos[k++]=z0;pos[k++]=x1;pos[k++]=Y;pos[k++]=z1}
      var xa=grid.x0+c0*cell,xb=grid.x0+c1*cell,za=grid.z0+r0*cell,zb=grid.z0+r1*cell;
      for(var cc=c0;cc<=c1;cc++){var x=grid.x0+cc*cell;seg(x,za,x,zb)}
      for(var rr=r0;rr<=r1;rr++){var z=grid.z0+rr*cell;seg(xa,z,xb,z)}
      lineGeo.setDrawRange(0,k/3);lineGeo.attributes.position.needsUpdate=true;
      var n=0;
      for(var r=r0;r<r1;r++)for(var cl=c0;cl<c1;cl++){
        if(!G.isBlocked(grid,cl,r))continue;
        var p=G.center(grid,cl,r);
        dummy.position.set(p.x,Y,p.z);dummy.updateMatrix();solid.setMatrixAt(n++,dummy.matrix);
      }
      solid.count=n;solid.instanceMatrix.needsUpdate=true;
      var q=G.center(grid,c.c,c.r),col=team==='enemy'?0xe8584c:0xf0b94d;
      ringMat.color.setHex(col);fill.material.color.setHex(col);
      ring.position.set(q.x,Y+.1,q.z);fill.position.set(q.x,Y+.05,q.z);ring.visible=true;fill.visible=true;
    },
    /* the ring stays under the creature while it walks */
    follow:function(x,z){ring.position.x=x;ring.position.z=z;fill.position.x=x;fill.position.z=z},
    setTarget:function(info){
      if(!info){tgt.visible=false;faint.forEach(function(f){f.visible=false});return}
      targetOk=info.ok!==false;
      var col=targetOk?OK:DENY;
      tRingMat.color.setHex(col);tFillMat.color.setHex(col);faintMat.color.setHex(col);
      tFillMat.opacity=targetOk?.22:.16;
      tgt.position.set(info.x,Y+.15,info.z);tgt.visible=true;
      var others=info.others||[];
      faint.forEach(function(f,i){
        var q=others[i];
        if(q){f.position.set(q.x,Y+.1,q.z);f.visible=true}else f.visible=false;
      });
    },
    setHints:function(list){
      list=(list||[]).slice(0,HINT_MAX);
      list.forEach(function(q,i){
        var p=G.center(grid,q.c,q.r);
        dummy.position.set(p.x,Y+.2,p.z);dummy.updateMatrix();
        hints.setMatrixAt(i,dummy.matrix);hintEdges.setMatrixAt(i,dummy.matrix);
      });
      hints.count=hintEdges.count=list.length;
      hints.instanceMatrix.needsUpdate=true;hintEdges.instanceMatrix.needsUpdate=true;
    },
    setBeacon:function(pos){
      if(!pos){beacon.visible=false;return}
      beacon.position.set(pos.x,Y+.25,pos.z);beacon.visible=true;
    },
    update:function(t){
      if(hints.count){hintMat.opacity=reduced()?.4:.28+.2*(.5+.5*Math.sin(t*4))}
      if(beacon.visible){var bk=reduced()?1:1+Math.sin(t*4.5)*.09;beacon.scale.set(bk,1,bk)}
      if(tgt.visible){
        var rm=reduced(),k=rm?1:1+Math.sin(t*5)*.05;
        tRing.scale.set(k,1,k);
      }
      if(reduced()){ring.scale.set(1,1,1);return}
      var k2=1+Math.sin(t*3)*.05;ring.scale.set(k2,1,k2);
    },
    dispose:function(){o.scene.remove(group);hintGeo.dispose();hintEdgeGeo.dispose();beaconGeo.dispose()}
  };
};
})();
