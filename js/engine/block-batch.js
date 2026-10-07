/* Batched voxel blocks: thousands of boxes drawn as one InstancedMesh. */
(function(){
var geo=new THREE.BoxGeometry(1,1,1);
Fable.rng=function(a){a|=0;return function(){var t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}};
Fable.BlockBatch=function(opts){
  opts=opts||{};var a=[],jr=Fable.rng(7);
  return {
    /* x,z = centre, y0 = bottom, w,h,d = size, c = hex colour */
    add:function(x,y0,z,w,h,d,c){a.push(x,y0+h/2,z,w,h,d,c)},
    build:function(parent){
      var n=a.length/7,im=new THREE.InstancedMesh(geo,new THREE.MeshLambertMaterial(),n),m=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3(),col=new THREE.Color();
      for(var i=0;i<n;i++){var o=i*7;p.set(a[o],a[o+1],a[o+2]);s.set(a[o+3],a[o+4],a[o+5]);m.compose(p,q,s);im.setMatrixAt(i,m);col.setHex(a[o+6]).multiplyScalar(.9+jr()*.1);im.setColorAt(i,col)}
      im.castShadow=!opts.noCast;im.receiveShadow=true;im.frustumCulled=false;parent.add(im);return im;
    }
  };
};
})();
