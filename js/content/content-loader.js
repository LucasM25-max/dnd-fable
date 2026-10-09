/* Loads content from the manifest, group by group in the order defined in content-groups.js, then validates every
   cross reference. Core code never needs per-content script tags. */
window.Fable=window.Fable||{};
(function(){
var C=Fable.content=Fable.content||{};
var ID_RE=/^[a-z0-9]+(-[a-z0-9]+)*$/;
var ready=false,callbacks=[],packages=C._packages=C._packages||{};

C.whenReady=function(fn){if(ready)fn();else callbacks.push(fn)};

function browserLoadScript(url){
  return new Promise(function(resolve,reject){
    var s=document.createElement('script');
    s.src=url;s.async=false;
    s.onload=function(){resolve()};
    s.onerror=function(){reject(new Error('Failed to load content script: '+url))};
    document.head.appendChild(s);
  });
}

/* createLoader({loadScript, base}) wires a script loader into the content system and returns {loadAll}.
   The browser uses document script tags; the Node tests pass a loader that runs files directly. */
C.createLoader=function(opts){
  opts=opts||{};
  var loadScript=opts.loadScript,base=opts.base;
  if(typeof loadScript!=='function')throw new Error('createLoader needs a loadScript(url) function');
  if(!base)throw new Error('createLoader needs a base URL');
  C._loadScript=loadScript;

  function load(rel){return loadScript(new URL(rel,base).href)}

  function loadEntry(group,id){
    if(group.mode==='file')return load(C.groups.path(group,id));
    var key=C.groups.packageKey(group,id);
    return load(C.groups.path(group,id)).then(function(){
      if(!packages[key])throw new Error('Content package "'+key+'" did not expose a load promise');
      return packages[key];
    });
  }

  async function loadAll(){
    var G=C.groups,m=C.manifest||{};
    Object.keys(m).forEach(function(k){
      if(!G.get(k))throw new Error('content-manifest.js: unknown group "'+k+'" (known groups: '+G.order.map(function(g){return g.key}).join(', ')+')');
    });
    for(var g=0;g<G.order.length;g++){
      var group=G.order[g],ids=m[group.key]===undefined?[]:m[group.key],seen={};
      if(!Array.isArray(ids))throw new Error('content-manifest.js: "'+group.key+'" must be an array');
      for(var i=0;i<ids.length;i++){
        var id=ids[i];
        if(typeof id!=='string'||!ID_RE.test(id))throw new Error('content-manifest.js: "'+group.key+'" entry "'+id+'" must be lowercase words joined by hyphens');
        if(seen[id])throw new Error('content-manifest.js: "'+group.key+'" lists "'+id+'" twice');
        seen[id]=1;
        await loadEntry(group,id);
      }
    }
    return C.validateAll();
  }
  return {loadAll:loadAll};
};

function start(){
  var qs=new URLSearchParams(location.search),src=qs.get('sources');
  /* ?sources=srd52 limits content to those source tags, to preview a shipping build. */
  if(src&&C.getAllowedSources&&!C.getAllowedSources())C.setAllowedSources(src.split(',').map(function(s){return s.trim()}).filter(Boolean));
  var base=new URL('./',document.currentScript.src);
  C.createLoader({loadScript:browserLoadScript,base:base}).loadAll().then(function(){
    ready=true;
    callbacks.splice(0).forEach(function(fn){try{fn()}catch(e){setTimeout(function(){throw e},0)}});
  }).catch(function(err){
    console.error(err);
    var toast=document.getElementById('toast');
    if(toast){toast.textContent='Content failed to load. See the browser console.';toast.classList.add('show')}
  });
}

/* Tests set Fable.content.autoload=false and drive createLoader themselves. */
if(C.autoload!==false&&typeof document!=='undefined'&&document.currentScript)start();
})();
