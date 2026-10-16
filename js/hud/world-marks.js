/* Marks drawn on the ground itself (implementation plan, section 13.7): a faint grid around the creature whose turn it is,
   a darker tint on squares that are solid (trees, walls), and a ring under the active creature, gold for the hero and red
   for an enemy. View only; it is told where to draw and never asks the rules anything.

   var wm = Fable.createWorldMarks({scene, grid})
   wm.setActive(cell, team)      move the grid window and the ring
   wm.follow(x, z)               keep the ring under a walking creature
   wm.update(t)                  pulse the ring */
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
    update:function(t){
      if(reduced()){ring.scale.set(1,1,1);return}
      var k=1+Math.sin(t*3)*.05;ring.scale.set(k,1,k);
    },
    dispose:function(){o.scene.remove(group)}
  };
};
})();
