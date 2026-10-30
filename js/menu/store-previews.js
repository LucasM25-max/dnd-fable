/* The little 3D previews inside the Store's tiles (js/menu/shop-ui.js). One hidden WebGL renderer draws every item, and the hero in each
   victory pose, onto the 2D canvas of its tile, so the page carries one WebGL context however many tiles it shows. A tile is drawn once
   at rest and again every frame while the pointer is on it, turning.

   var pv = Fable.createTilePreview({heroId})
   pv.draw(canvas, {kind:'item'|'pose', id}, angle) -> true when it drew (false: no 3D here, the tile keeps its icon)
   pv.dispose() */
(function(){
Fable.createTilePreview=function(o){
  o=o||{};
  var T=THREE,M=Fable.storeModels,R,S,cam,entries={},seen=null;
  R=new T.WebGLRenderer({alpha:true,antialias:true});
  R.setPixelRatio(1);R.setClearColor(0x000000,0);
  S=new T.Scene();
  S.add(new T.HemisphereLight(0xe6d2ae,0x3a2616,1));
  var key=new T.DirectionalLight(0xffe6b0,.95);key.position.set(-20,40,40);S.add(key);
  var back=new T.PointLight(0xff9a40,.7,12);back.position.set(1.6,1,-1.8);S.add(back);
  cam=new T.PerspectiveCamera(28,1,.1,50);cam.position.set(0,.2,2.45);cam.lookAt(0,0,0);

  /* fit a model inside a sphere of radius .5 around the origin; long thin things (a spear) are laid on a slant to fill the square */
  function fit(obj,slant){
    var b=M.bounds(obj),sz=new T.Vector3(),c=new T.Vector3();b.getSize(sz);b.getCenter(c);
    var long=Math.max(sz.x,sz.y,sz.z),mid=sz.x+sz.y+sz.z-long-Math.min(sz.x,sz.y,sz.z);
    var radius=Math.max(sz.length()/2*.78,long/2);
    var inner=new T.Group();obj.position.sub(c);inner.add(obj);inner.scale.setScalar(.5/radius*.94);
    var tilt=new T.Group();tilt.add(inner);
    if(slant&&long/Math.max(mid,.01)>2.4)tilt.rotation.z=-.62;
    var spin=new T.Group();spin.add(tilt);
    return spin;
  }
  function build(spec){
    var spin;
    if(spec.kind==='pose'){
      var h=M.makeHero(o.heroId||'human-fighter'),def=Fable.content.victoryAnimations.get(spec.id),clip=h.clipFor(def);
      if(clip)h.anim.play(clip,{hold:true,tag:'victory'});
      /* run the clip to the moment it is at its height, then freeze it */
      for(var i=0;i<22;i++){h.anim.update(.05);h.anim.apply()}
      h.fg.root.updateMatrixWorld(true);
      spin=fit(h.fg.root,false);spin.scale.setScalar(1.12);spin.position.y=-.02;
      spin.userData.hero=h;
    }else{
      var g=M.itemGroup(spec.id);if(!g)return null;
      g.updateMatrixWorld(true);
      spin=fit(g,true);
    }
    spin.visible=false;S.add(spin);return spin;
  }
  function entry(spec){
    var k=spec.kind+':'+spec.id;
    if(entries[k]===undefined){
      try{entries[k]=build(spec)}catch(e){entries[k]=null;if(window.console)console.warn('Store preview '+k+': '+e.message)}
    }
    return entries[k];
  }
  return {
    draw:function(canvas,spec,angle){
      var e=entry(spec);if(!e)return false;
      if(seen)seen.visible=false;
      e.visible=true;seen=e;e.rotation.y=angle||0;
      var w=canvas.width,h=canvas.height;
      if(R.domElement.width!==w||R.domElement.height!==h){R.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix()}
      R.render(S,cam);
      var g=canvas.getContext('2d');g.clearRect(0,0,w,h);g.drawImage(R.domElement,0,0,w,h);
      return true;
    },
    dispose:function(){
      S.traverse(function(x){if(x.isInstancedMesh&&x.dispose)x.dispose();else if(x.geometry&&x.geometry.dispose)x.geometry.dispose()});
      R.dispose();entries={};
    }
  };
};
})();
