/* Weapons lying on the ground (implementation plan, section 14.6): a thrown dagger or javelin shows where it landed, and a
   creature that picks it up takes it away. View only; the rules own the list (state.ground) and tell this where to draw.

   var wi = Fable.createWorldItems({scene, grid})
   wi.add(item)        draw a ground item {id, item, cell}
   wi.remove(id)       take one away
   wi.sync(list)       make the drawn set match state.ground
   wi.update(t)        a slow glint so a weapon is easy to spot on the grass
   wi.dispose() */
(function(){
Fable.createWorldItems=function(o){
  var grid=o.grid,cell=grid.cell,G=Fable.grid;
  var group=new THREE.Group();group.name='world-items';o.scene.add(group);
  var drawn={};
  var steel=new THREE.MeshLambertMaterial({color:0xcfd6dc}),wood=new THREE.MeshLambertMaterial({color:0x6b4a2a}),grip=new THREE.MeshLambertMaterial({color:0x3a2a1c});
  var glintMat=new THREE.MeshBasicMaterial({color:0xfff2b0,transparent:true,opacity:.35,depthWrite:false,side:THREE.DoubleSide});
  var glintGeo=new THREE.RingGeometry(cell*.2,cell*.26,28);glintGeo.rotateX(-Math.PI/2);
  function box(w,h,d,m,x,y,z){var b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y,z);return b}
  function model(kind){
    var g=new THREE.Group(),L=cell*(kind==='javelin'?.8:.42);
    if(kind==='javelin'){
      g.add(box(L,.5,.5,wood,0,.4,0));g.add(box(L*.16,.55,.7,steel,L*.46,.42,0));
    }else{
      g.add(box(L*.62,.35,.9,steel,L*.2,.35,0));g.add(box(.7,.5,2,grip,-L*.14,.38,0));g.add(box(L*.22,.45,.6,grip,-L*.3,.36,0));
    }
    return g;
  }
  var api={
    add:function(it){
      if(drawn[it.id]||!it.cell)return;
      var p=G.center(grid,it.cell.c,it.cell.r),g=new THREE.Group();
      g.add(model(it.item));
      var ring=new THREE.Mesh(glintGeo,glintMat.clone());ring.position.y=.3;ring.userData.glint=true;g.add(ring);
      /* a stable tilt from the id, so two weapons on one square do not overlap */
      var h=0;for(var i=0;i<it.id.length;i++)h=(h*31+it.id.charCodeAt(i))|0;
      g.rotation.y=((h&255)/255)*Math.PI*2;
      g.position.set(p.x+((h>>8&7)-3.5)*.3,0,p.z+((h>>11&7)-3.5)*.3);
      group.add(g);drawn[it.id]=g;
    },
    remove:function(id){
      var g=drawn[id];if(!g)return;
      group.remove(g);g.traverse(function(n){if(n.geometry&&n.geometry!==glintGeo)n.geometry.dispose();if(n.material&&n.userData.glint)n.material.dispose()});
      delete drawn[id];
    },
    sync:function(list){
      var keep={};
      (list||[]).forEach(function(it){keep[it.id]=true;api.add(it)});
      Object.keys(drawn).forEach(function(id){if(!keep[id])api.remove(id)});
    },
    update:function(t){
      Object.keys(drawn).forEach(function(id){
        drawn[id].children.forEach(function(n){if(n.userData.glint)n.material.opacity=.22+.2*(.5+.5*Math.sin(t*2.2+id.length))});
      });
    },
    count:function(){return Object.keys(drawn).length},
    dispose:function(){Object.keys(drawn).forEach(api.remove);o.scene.remove(group);glintGeo.dispose();glintMat.dispose();steel.dispose();wood.dispose();grip.dispose()}
  };
  return api;
};
})();
