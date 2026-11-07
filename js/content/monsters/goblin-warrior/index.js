/* Self-contained Goblin Warrior package. */
(function(){
var C=Fable.content,base=new URL('./',document.currentScript.src),key='monsters:goblin-warrior';
function load(name){return C._loadScript(new URL(name,base).href)}
C._packages[key]=Promise.all([load('model.js'),load('features.js')]).then(function(){return load('definition.js')});
})();
