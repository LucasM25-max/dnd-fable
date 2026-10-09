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
function loadRules(){['js/rules/rng.js','js/rules/formula.js','js/rules/dice.js'].forEach(runFile)}
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

module.exports={ROOT,fresh,runFile,loadRules,loadRegistry,nodeLoadScript,dirUrl};
