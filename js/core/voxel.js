/* Shared voxel helpers: block builder (b), colour/material cache, 1cm voxelizer. */
(function(){
var G=new THREE.BoxGeometry(1,1,1),mc={};
function mat(c){return mc[c]||(mc[c]=new THREE.MeshLambertMaterial({color:c}))}
function gl(c){var k='g'+c;return mc[k]||(mc[k]=new THREE.MeshBasicMaterial({color:c}))}
function b(p,x,y,z,w,h,d,c,sh,g){var m=new THREE.Mesh(G,g?gl(c):mat(c));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=(sh===1);m.receiveShadow=(sh!==0);p.add(m);return m}
function pick(a){return a[Math.floor(Math.random()*a.length)]}
function voxelize(part,direct){
  var cs=.1/.75,ms=[];
  part.traverse(function(o){if(o.isMesh&&(!direct||o.parent===part))ms.push(o)});
  if(!ms.length)return;
  var inv=new THREE.Matrix4().copy(part.matrixWorld).invert(),v=new THREE.Vector3(),mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9],info=[],A=['x','y','z'];
  ms.forEach(function(m){
    var rel=new THREE.Matrix4().multiplyMatrices(inv,m.matrixWorld),lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];
    for(var c=0;c<8;c++){v.set(c&1?.5:-.5,c&2?.5:-.5,c&4?.5:-.5).applyMatrix4(rel);
      for(var i=0;i<3;i++){var t=v[A[i]];lo[i]=Math.min(lo[i],t);hi[i]=Math.max(hi[i],t);mn[i]=Math.min(mn[i],t);mx[i]=Math.max(mx[i],t)}}
    info.push({ri:rel.clone().invert(),lo:lo,hi:hi,c:m.material.color.getHex()});
  });
  var o=[mn[0]-cs*2,mn[1]-cs*2,mn[2]-cs*2],n=[0,1,2].map(function(i){return Math.ceil((mx[i]-mn[i])/cs)+5}),
  nx=n[0],ny=n[1],nz=n[2],sl=nx*ny,g=new Int32Array(nx*ny*nz).fill(-1);
  info.forEach(function(f){
    var a=[0,1,2].map(function(i){return Math.max(0,Math.floor((f.lo[i]-o[i])/cs))}),e=[0,1,2].map(function(i){return Math.min(n[i]-1,Math.ceil((f.hi[i]-o[i])/cs))});
    for(var i=a[0];i<=e[0];i++)for(var j=a[1];j<=e[1];j++)for(var k=a[2];k<=e[2];k++){
      v.set(o[0]+(i+.5)*cs,o[1]+(j+.5)*cs,o[2]+(k+.5)*cs).applyMatrix4(f.ri);
      if(Math.abs(v.x)<=.5&&Math.abs(v.y)<=.5&&Math.abs(v.z)<=.5)g[i+nx*j+sl*k]=f.c}});
  var L=[];
  for(var k=1;k<nz-1;k++)for(var j=1;j<ny-1;j++)for(var i=1;i<nx-1;i++){var id=i+nx*j+sl*k;
    if(g[id]>=0&&(g[id-1]<0||g[id+1]<0||g[id-nx]<0||g[id+nx]<0||g[id-sl]<0||g[id+sl]<0))L.push(i,j,k,g[id])}
  var N=L.length/4,im=new THREE.InstancedMesh(new THREE.BoxGeometry(cs,cs,cs),new THREE.MeshLambertMaterial(),N),mm=new THREE.Matrix4(),col=new THREE.Color();
  for(var q=0;q<N;q++){mm.makeTranslation(o[0]+(L[q*4]+.5)*cs,o[1]+(L[q*4+1]+.5)*cs,o[2]+(L[q*4+2]+.5)*cs);im.setMatrixAt(q,mm);col.setHex(L[q*4+3]).multiplyScalar(.9+Math.random()*.1);im.setColorAt(q,col)}
  im.castShadow=im.receiveShadow=true;im.frustumCulled=false;part.add(im);
  ms.forEach(function(m){m.parent.remove(m)});
}

Fable.b=b;Fable.mat=mat;Fable.gl=gl;Fable.pick=pick;Fable.voxelize=voxelize;
})();
