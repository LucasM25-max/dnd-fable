/* Whole-creature picking without raycasting millions of voxel instances. The voxelizer records a local box for each body
   part. Transform the ray into those boxes so head, torso, limbs and gear follow the animated rig, then choose the nearest
   living creature. Empty space is deliberately left to the controller's ground-plane movement picker. */
(function(){
Fable.createCreaturePicker=function(){
  var boxes=new WeakMap(),inverse=new THREE.Matrix4(),localRay=new THREE.Ray(),point=new THREE.Vector3(),worldPoint=new THREE.Vector3();
  function boxFor(mesh){
    var box=boxes.get(mesh);if(box)return box;
    var b=mesh.userData&&mesh.userData.pickBounds;
    if(b)box=new THREE.Box3(new THREE.Vector3().fromArray(b.min),new THREE.Vector3().fromArray(b.max));
    else if(mesh.isMesh&&!mesh.isInstancedMesh&&mesh.geometry){
      if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
      box=mesh.geometry.boundingBox.clone();
    }
    if(box){box.expandByScalar(.25);boxes.set(mesh,box)}
    return box;
  }
  return {
    pick:function(ray,entries){
      var nearest=null,distance=Infinity;
      Object.keys(entries).forEach(function(id){
        var e=entries[id],c=e.creature;
        if(!c||!c.alive||!c.cell||!e.root||!e.root.visible)return;
        e.root.updateMatrixWorld(true);
        e.root.traverseVisible(function(mesh){
          var box=boxFor(mesh);if(!box)return;
          inverse.copy(mesh.matrixWorld).invert();localRay.copy(ray).applyMatrix4(inverse);
          if(!localRay.intersectBox(box,point))return;
          worldPoint.copy(point).applyMatrix4(mesh.matrixWorld);
          var d=ray.origin.distanceToSquared(worldPoint);
          if(d<distance){distance=d;nearest=c}
        });
      });
      return nearest;
    }
  };
};
})();
