/* Self-contained Fighter class package: features first (the class refers to them), then the class. */
(function(){
var C=Fable.content,base=new URL('./',document.currentScript.src),key='classes:fighter';
function load(name){return C._loadScript(new URL(name,base).href)}
C._packages[key]=load('features.js').then(function(){return load('definition.js')});
})();
