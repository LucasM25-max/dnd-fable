/* Self-contained Goblin Minion package. */
(function(){
var C=Fable.content,base=new URL('./',document.currentScript.src),key='monsters:goblin-minion';
function load(name){return C._loadScript(new URL(name,base).href)}
C._packages[key]=load('model.js').then(function(){return load('definition.js')});
})();
