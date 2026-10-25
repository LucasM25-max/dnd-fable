/* Web Worker entry for enemy planning (implementation plan, section 14.9). The planner is pure and works on a serialized copy of
   the fight, so it can run off the main thread: the page posts {id, state, actor, opts} and gets back {id, plan} or {id, error}.
   The worker loads the same rules files, in the same order, as the page does, and then the rules, items and feats content
   (weapon mastery and condition definitions are content the planner reads), but no maps, models or presentation.
   Fable.aiWorker.init(loadScript, base) brings a world up and returns a promise, and Fable.aiWorker.handle(msg) is the whole job,
   so tests run both without a Worker. */
(function(root){
var isWorker=typeof importScripts==='function'&&typeof window==='undefined';
if(isWorker){root.window=root;root.document={currentScript:null};root.Fable={content:{autoload:false}}}
var F=root.Fable;
var RULES=['rules/rng','rules/formula','rules/dice','rules/money','rules/tables','rules/stats','rules/grid','content/content-registry',
  'character/build','character/choices','character/inventory','character/sheet','character/rest','rules/statblock','rules/status','rules/handlers',
  'rules/senses','rules/creature','rules/combat','rules/attack','rules/ground','rules/actions','rules/ai-core','rules/ai-planner','rules/ai',
  'content/content-groups','content/content-loader'];
var ready=null;
F.aiWorker={
  FILES:RULES,
  /* loadScript(url) returns a promise; base is the URL of the js folder with a trailing slash */
  init:function(loadScript,base,loadFiles){
    if(ready)return ready;
    ready=Promise.resolve().then(function(){
      return loadFiles?loadFiles(RULES):null;
    }).then(function(){
      return loadScript(new URL('content/content-manifest.js',base).href);
    }).then(function(){
      var C=F.content,m=C.manifest;
      m.maps=[];m.encounters=[];m.presentation=[];m.monsters=[];m.characters=[];
      C.validateAll=function(){return {ok:true,errors:[],warnings:[]}};
      return C.createLoader({loadScript:loadScript,base:new URL('content/',base)}).loadAll();
    });
    return ready;
  },
  handle:function(msg){
    try{return {id:msg.id,plan:F.ai.planFromData(msg.state,msg.actor,msg.opts||{})}}
    catch(e){return {id:msg.id,error:String(e&&e.message||e)}}
  }
};
if(isWorker){
  var base=new URL('../',root.location.href);
  var start=F.aiWorker.init(function(url){
    /* content files read document.currentScript.src to find their own folder */
    root.document.currentScript={src:url};
    try{importScripts(url)}finally{root.document.currentScript=null}
    return Promise.resolve();
  },base,function(list){
    importScripts.apply(null,list.map(function(f){return new URL(f+'.js',base).href}));
  });
  root.onmessage=function(e){
    start.then(function(){root.postMessage(F.aiWorker.handle(e.data))},function(err){root.postMessage({id:e.data.id,error:'worker setup failed: '+(err&&err.message||err)})});
  };
}
})(typeof self!=='undefined'?self:globalThis);
