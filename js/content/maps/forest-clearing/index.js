/* Self-contained Forest Clearing package. The engine only knows the package ID. */
(function(){
var C=Fable.content,base=new URL('./',document.currentScript.src),key='maps:forest-clearing';
function load(name){return C._loadScript(new URL(name,base).href)}
C._packages[key]=load('layout.js')
  .then(function(){return load('terrain.js')})
  .then(function(){return load('flora.js')})
  .then(function(){return load('outpost.js')})
  .then(function(){return load('landmarks.js')})
  .then(function(){return load('props.js')})
  .then(function(){return load('definition.js')});
})();
