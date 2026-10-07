/* Loads content packages from the manifest. Core code never needs per-content script tags. */
window.Fable=window.Fable||{};
(function(){
var C=Fable.content=Fable.content||{},BASE=new URL('./',document.currentScript.src);
var ready=false,callbacks=[],packages={};
C._packages=packages;

function loadScript(url){
  return new Promise(function(resolve,reject){
    var s=document.createElement('script');
    s.src=url;s.async=false;
    s.onload=function(){resolve()};
    s.onerror=function(){reject(new Error('Failed to load content script: '+url))};
    document.head.appendChild(s);
  });
}
C._loadScript=loadScript;
C.whenReady=function(fn){if(ready)fn();else callbacks.push(fn)};

function loadPackage(kind,id){
  var key=kind+':'+id;
  return loadScript(new URL(kind+'/'+id+'/index.js',BASE).href)
    .then(function(){
      if(!packages[key])throw new Error('Content package "'+key+'" did not expose a load promise');
      return packages[key];
    });
}

async function loadAll(){
  var m=C.manifest||{};
  var groups=[
    ['maps',m.maps||[]],
    ['monsters',m.monsters||[]],
    ['characters',m.characters||[]],
    ['encounters',m.encounters||[]]
  ];
  for(var g=0;g<groups.length;g++){
    for(var i=0;i<groups[g][1].length;i++)await loadPackage(groups[g][0],groups[g][1][i]);
  }
}

loadAll().then(function(){
  ready=true;
  callbacks.splice(0).forEach(function(fn){try{fn()}catch(e){setTimeout(function(){throw e},0)}});
}).catch(function(err){
  console.error(err);
  var toast=document.getElementById('toast');
  if(toast){toast.textContent='Content failed to load. See the browser console.';toast.classList.add('show')}
});
})();
