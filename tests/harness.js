'use strict';
/* Shims the browser globals so the plain-script rules and content files run unchanged in Node. */
const fs=require('fs'),path=require('path'),vm=require('vm'),{pathToFileURL,fileURLToPath}=require('url');
const ROOT=path.resolve(__dirname,'..');

/* Starts a clean Fable namespace. Files are plain scripts that attach to window.Fable, so each test world resets it. */
function fresh(){
  delete globalThis.Fable;
  globalThis.window=globalThis;
  globalThis.document={currentScript:null};
  globalThis.Fable={content:{autoload:false}};
  return globalThis.Fable;
}
function runFile(file){
  const abs=path.isAbsolute(file)?file:path.join(ROOT,file);
  vm.runInThisContext(fs.readFileSync(abs,'utf8'),{filename:abs});
}
function loadRules(){['js/rules/rng.js','js/rules/formula.js','js/rules/dice.js','js/rules/money.js','js/rules/tables.js'].forEach(runFile)}
function loadRegistry(){['js/content/content-registry.js','js/content/content-groups.js','js/content/content-loader.js'].forEach(runFile)}

/* Script loader with the same contract as the browser one: runs the file, rejects when it is missing. */
function nodeLoadScript(url){
  return new Promise((resolve,reject)=>{
    let file;
    try{file=fileURLToPath(url);fs.accessSync(file)}catch(e){return reject(new Error('Failed to load content script: '+url))}
    try{
      globalThis.document.currentScript={src:url};
      runFile(file);
      resolve();
    }catch(e){reject(e)}finally{globalThis.document.currentScript=null}
  });
}
function dirUrl(dir){return pathToFileURL(path.resolve(dir)+path.sep)}

/* Loads the real rules and item data (the rules, items and feats groups of the real manifest) through the real loader.
   Maps, monsters, characters and encounters are left out because they need Three.js. Resolves to Fable.content. */
async function loadData(opts){
  opts=opts||{};
  fresh();loadRules();loadRegistry();
  if(opts.sources)Fable.content.setAllowedSources(opts.sources);
  runFile('js/content/content-manifest.js');
  const m=Fable.content.manifest;
  m.maps=[];m.monsters=[];m.characters=[];m.encounters=[];
  const loader=Fable.content.createLoader({loadScript:nodeLoadScript,base:dirUrl(path.join(ROOT,'js','content'))});
  if(opts.skipValidate){Fable.content.validateAll=function(){return {ok:true,errors:[],warnings:[]}}}
  await loader.loadAll();
  return Fable.content;
}

module.exports={ROOT,fresh,runFile,loadRules,loadRegistry,nodeLoadScript,dirUrl,loadData};
