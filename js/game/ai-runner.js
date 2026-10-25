/* Runs enemy planning (implementation plan, section 14.9). Fable.createAiRunner({base}) returns
     runner.plan(state, creature, opts, done(plan, error))   plans on a Web Worker when the browser allows one, otherwise on the page
     runner.mode                                             'worker' or 'inline'
     runner.dispose()
   A page opened from a file cannot start a Worker, and a Worker that fails or stays silent is dropped: the plan is then made on the
   page with the very same code, so the result does not depend on which one ran. The worker gets a serialized copy of the fight and
   hands back plain data, so the fight cannot change while it thinks. */
(function(){
Fable.createAiRunner=function(o){
  o=o||{};
  var worker=null,next=1,waiting={},mode='inline',dead=false;
  var TIMEOUT=8000;
  function drop(){
    if(worker){try{worker.terminate()}catch(e){}worker=null}
    mode='inline';
    var w=waiting;waiting={};
    Object.keys(w).forEach(function(k){w[k].fallback()});
  }
  try{
    if(typeof Worker!=='undefined'&&o.base&&!(typeof location!=='undefined'&&location.protocol==='file:')){
      worker=new Worker(o.base+'rules/ai-worker.js');
      worker.onmessage=function(e){
        var m=e.data,w=waiting[m.id];
        if(!w)return;
        delete waiting[m.id];clearTimeout(w.timer);
        if(m.error)w.fallback();else w.done(m.plan,null);
      };
      worker.onerror=function(){drop()};
      mode='worker';
    }
  }catch(e){worker=null;mode='inline'}
  function inline(s,c,opts,done){
    var plan=null,err=null;
    try{plan=Fable.ai.plan(s,c,opts)}catch(e){err=e}
    done(plan,err);
  }
  var runner={
    get mode(){return mode},
    plan:function(s,c,opts,done){
      if(!worker||dead){inline(s,c,opts,done);return}
      var id=next++,state;
      try{state=Fable.combat.serialize(s)}catch(e){inline(s,c,opts,done);return}
      var w={done:done,fallback:function(){clearTimeout(w.timer);inline(s,c,opts,done)}};
      w.timer=setTimeout(function(){if(waiting[id]){delete waiting[id];drop();w.fallback()}},TIMEOUT);
      waiting[id]=w;
      try{worker.postMessage({id:id,state:state,actor:c.id,opts:opts||{}})}catch(e){delete waiting[id];drop();w.fallback()}
    },
    dispose:function(){dead=true;if(worker){try{worker.terminate()}catch(e){}worker=null}waiting={}}
  };
  return runner;
};
})();
