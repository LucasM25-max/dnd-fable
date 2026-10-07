/* Creates the Fable namespace and the single WebGL renderer shared by every scene. */
window.Fable=window.Fable||{};
(function(){
var cv=document.getElementById('c');
var R=new THREE.WebGLRenderer({canvas:cv,antialias:true});
R.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;
Fable.canvas=cv;Fable.renderer=R;
})();
