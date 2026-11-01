/* The brain of the tutorial companion (no DOM, so it runs in the Node tests). A script is data: who speaks, the opening spiel that
   always plays, and reactive lines that answer what the player does. The engine decides WHICH line is spoken and WHEN; the dialogue
   box (js/hud/elminster.js) only draws it.

     Fable.dialogue.register(id, script) / Fable.dialogue.get(id) / Fable.dialogue.check(script) -> list of problems ([] when sound)
     var d = Fable.dialogue.create(script, {rng, muted})
     d.start(now)               queue the opening spiel (it always plays, whatever is muted)
     d.event(kind, data, now)   the player or the fight did something; may queue a line
     d.tick(now)                call every frame: ends a line when it has been read, starts the next
     d.advance(now)             the player clicked the box: finish the line being read, start the next
     d.current()                {id, text, speaker, started, duration, pri, intro} or null
     d.mute(on) / d.muted()     reactive lines off (the opening spiel and urgent lines still play)

   script = {
     speaker: {id, name, title},
     intro:   [{id, text, teaches?}],       teaches is an event kind: when the player has already done it, the line is dropped unspoken
     lines:   [{id, on, text, when?, once?, pri?, chance?, cooldown?, ttl?}]
        on        the event kind that can trigger it
        text      a string or an array of strings (one is picked)
        when      function(data, ctx) -> boolean; the line only fits when it is true. ctx = {seen(id), count(kind), now}
        once      speak at most once in the whole fight
        pri       0 chatter (dropped when the speaker is busy or has just spoken), 1 normal, 2 important (waits its turn), 3 urgent (cuts in)
        chance    0..1, the odds a chatter line is spoken at all (default 1)
        cooldown  ms before the same line may be spoken again (default: never twice for pri 0, 20 s otherwise)
        ttl       ms a queued line stays worth saying (default 6000); a line that waited longer is dropped
   }
   A line's text may hold {name} style fields filled from the event data. Nothing here touches the fight. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var D=Fable.dialogue=Fable.dialogue||{};
var scripts={};

D.register=function(id,script){
  if(scripts[id])throw new Error('Dialogue "'+id+'" is already registered');
  var bad=D.check(script);
  if(bad.length)throw new Error('Dialogue "'+id+'": '+bad[0]);
  scripts[id]=script;return script;
};
D.get=function(id){return scripts[id]||null};
D.ids=function(){return Object.keys(scripts)};
D.reset=function(){scripts={}};

D.check=function(sc){
  var bad=[],ids={};
  if(!sc||typeof sc!=='object')return ['the script must be an object'];
  if(!sc.speaker||typeof sc.speaker.id!=='string'||typeof sc.speaker.name!=='string')bad.push('speaker needs an id and a name');
  function lineBad(l,where){
    if(!l||typeof l.id!=='string'||!l.id){bad.push(where+' needs an id');return}
    if(ids[l.id])bad.push(where+' repeats the id '+l.id);
    ids[l.id]=true;
    var t=Array.isArray(l.text)?l.text:[l.text];
    if(!t.length||t.some(function(x){return typeof x!=='string'||!x}))bad.push(l.id+' needs text');
    if(l.pri!==undefined&&[0,1,2,3].indexOf(l.pri)<0)bad.push(l.id+' pri must be 0 to 3');
    if(l.chance!==undefined&&!(l.chance>=0&&l.chance<=1))bad.push(l.id+' chance must be between 0 and 1');
    if(l.when!==undefined&&typeof l.when!=='function')bad.push(l.id+' when must be a function');
  }
  if(!Array.isArray(sc.intro)||!sc.intro.length)bad.push('the opening spiel needs at least one line');
  else sc.intro.forEach(function(l){lineBad(l,'intro line')});
  if(!Array.isArray(sc.lines))bad.push('lines must be an array');
  else sc.lines.forEach(function(l){lineBad(l,'line');if(l&&typeof l.on!=='string')bad.push((l&&l.id)+' needs an event kind (on)')});
  return bad;
};

/* how long a line stays up: time to read it, with a floor so a short one is not a flash */
D.duration=function(text){return Math.max(2600,1100+String(text).length*52)};
function fill(text,data){return String(text).replace(/\{(\w+)\}/g,function(m,k){return data&&data[k]!==undefined?String(data[k]):''})}

D.create=function(script,opts){
  opts=opts||{};
  var rng=opts.rng||Math.random,isMuted=!!opts.muted,SEARCH_GAP=2200,QUEUE_MAX=3;
  var seen={},spokeAt={},counts={},queue=[],cur=null,lastEnd=-1e9,started=false;

  function ctx(now){return {now:now,seen:function(id){return !!seen[id]},count:function(k){return counts[k]||0}}}
  function mk(l,text,data,now,intro){
    return {id:l.id,text:fill(text,data),pri:intro?2:(l.pri||0),intro:!!intro,speaker:script.speaker,queuedAt:now,ttl:l.ttl||6000,teaches:l.teaches||null,once:!!l.once,duration:D.duration(fill(text,data))};
  }
  function pickText(l){var t=l.text;return Array.isArray(t)?t[Math.floor(rng()*t.length)%t.length]:t}
  function begin(item,now){cur=item;cur.started=now;seen[item.id]=true;spokeAt[item.id]=now}
  function startNext(now){
    while(queue.length){
      var q=queue.shift();
      if(!q.intro&&now-q.queuedAt>q.ttl)continue;
      if(q.teaches&&(counts[q.teaches]||0)>0)continue;      /* the player already showed they know it */
      begin(q,now);return true;
    }
    return false;
  }
  function insert(item){
    /* higher priority first; same priority keeps the order it arrived in; the intro keeps its own order */
    /* what the player just did is answered right after the line being spoken, ahead of the rest of the opening spiel, which then goes on */
    var i=queue.length,k;
    for(k=0;k<queue.length;k++)if(queue[k].intro){i=item.intro?queue.length:k;break}
    if(item.pri>=3&&!item.intro)i=0;           /* urgent news goes ahead of everything */
    else if(!item.intro)while(i>0&&queue[i-1].pri<item.pri)i--;
    queue.splice(i,0,item);
    var drops=queue.filter(function(x){return !x.intro});
    while(drops.length>QUEUE_MAX){
      var low=drops.reduce(function(a,b){return b.pri<a.pri||(b.pri===a.pri&&b.queuedAt<a.queuedAt)?b:a});
      queue.splice(queue.indexOf(low),1);drops.splice(drops.indexOf(low),1);
    }
  }

  var api={
    start:function(now){
      if(started)return;
      started=true;
      script.intro.forEach(function(l){insert(mk(l,pickText(l),{},now,true))});
      if(!cur)startNext(now);
    },
    event:function(kind,data,now){
      counts[kind]=(counts[kind]||0)+1;
      /* a line waiting for something the player has just done is no longer needed */
      queue=queue.filter(function(q){return !(q.teaches&&q.teaches===kind)});
      var c=ctx(now),best=null;
      script.lines.forEach(function(l){
        if(l.on!==kind)return;
        if(l.once&&seen[l.id])return;
        var cd=l.cooldown!==undefined?l.cooldown:(l.pri>0?20000:Infinity);
        if(spokeAt[l.id]!==undefined&&now-spokeAt[l.id]<cd)return;
        if(l.when){var ok;try{ok=l.when(data||{},c)}catch(e){ok=false}if(!ok)return}
        var pri=l.pri||0;
        if(!best||pri>(best.pri||0))best=l;
      });
      if(!best)return false;
      var pri=best.pri||0;
      if(isMuted&&pri<3)return false;
      if(pri===0){
        /* chatter: only into a silence, only sometimes */
        if(cur||queue.length||now-lastEnd<SEARCH_GAP)return false;
        if(best.chance!==undefined&&rng()>=best.chance)return false;
      }
      var item=mk(best,pickText(best),data,now,false);
      if(!cur){begin(item,now);return true}
      if(pri>=3&&!cur.intro&&cur.pri<3){
        /* urgent news cuts in; what was being said goes back to be finished if it still matters */
        var back=cur;cur=null;if(back.pri>=1)queue.unshift(Object.assign(back,{queuedAt:now}));
        begin(item,now);return true;
      }
      if(pri===0)return false;
      /* it waits for the line being spoken, so that line's length does not count against it */
      item.ttl+=cur.duration;
      insert(item);return true;
    },
    tick:function(now){
      if(cur&&now-cur.started>=cur.duration){cur=null;lastEnd=now}
      if(!cur&&queue.length&&now-lastEnd>=(queue[0].intro?250:350))startNext(now);
      return cur;
    },
    advance:function(now){
      if(cur){cur=null;lastEnd=now-400;return startNext(now)}
      return false;
    },
    current:function(){return cur},
    pending:function(){return queue.length},
    seen:function(id){return !!seen[id]},
    count:function(k){return counts[k]||0},
    mute:function(on){isMuted=!!on},
    muted:function(){return isMuted},
    clear:function(now){queue=[];cur=null;lastEnd=now===undefined?-1e9:now}
  };
  return api;
};
})(typeof window!=='undefined'?window:globalThis);
