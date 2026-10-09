/* Test fixture: a package, same shape as the real ones. */
(function(){
var C=Fable.content,base=new URL('./',document.currentScript.src),key='species:dummy-species';
C._packages[key]=C._loadScript(new URL('definition.js',base).href);
})();
