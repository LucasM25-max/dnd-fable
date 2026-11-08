/* The codex: what the player has met and found, for the Bestiary and the Collection (the hub's tiles). Saved in localStorage apart from any hero
   (a monster met is met whoever played the fight); when storage is blocked everything still works for the visit and is simply not remembered.

   Fable.codex.noteFight(defIds)            a fight began with these monsters (a list of monster ids, repeats count once each)
   Fable.codex.noteDefeat(defId)            one of them fell
   Fable.codex.monster(id)                  {fights, defeated} for a monster that has been in a fight, or null
   Fable.codex.hasMet(id)                   true once the monster has been in a fight
   Fable.codex.metCount()                   how many different monsters have been met
   Fable.codex.noteItems(ids)               items a hero has held (every item id in any hero's pack); returns true when something new was added
   Fable.codex.hasFound(id)                 true when the item has ever been in a hero's pack
   Fable.codex.foundIds()                   every item id found, in the order they were found
   Fable.codex.absorb(roster)               reads every character's pack through Fable.character.roster and notes the items
   Fable.codex.reset()                      forget everything              Fable.codex._forget()   drop the in-memory copy (tests) */
(function(G){
G.Fable=G.Fable||{};
var C=G.Fable.codex={},STORE='dicebound.codex.v1';
var mem=null;
function blank(){return {v:1,monsters:{},items:[]}}
function ls(){try{return G.localStorage||null}catch(e){return null}}
function count(n){return typeof n==='number'&&isFinite(n)&&n>=0&&Math.floor(n)===n?n:0}
function load(){
  if(mem)return mem;
  var out=blank(),st=ls();
  try{
    var j=st&&JSON.parse(st.getItem(STORE)||'null');
    if(j&&j.v===1){
      if(j.monsters&&typeof j.monsters==='object'&&!Array.isArray(j.monsters)){
        Object.keys(j.monsters).forEach(function(id){
          var m=j.monsters[id];
          if(m&&typeof m==='object')out.monsters[id]={fights:Math.max(1,count(m.fights)),defeated:count(m.defeated)};
        });
      }
      if(Array.isArray(j.items)){
        j.items.forEach(function(id){if(typeof id==='string'&&id&&out.items.indexOf(id)<0)out.items.push(id)});
      }
    }
  }catch(e){}
  mem=out;return mem;
}
function save(){var st=ls();try{if(st)st.setItem(STORE,JSON.stringify(load()))}catch(e){}}
function ok(id){return typeof id==='string'&&id.length>0}

C.noteFight=function(ids){
  var m=load(),once={},any=false;
  (ids||[]).forEach(function(id){
    if(!ok(id)||once[id])return;
    once[id]=true;
    var r=m.monsters[id]||(m.monsters[id]={fights:0,defeated:0});
    r.fights++;any=true;
  });
  if(any)save();
};
C.noteDefeat=function(id){
  if(!ok(id))return;
  var m=load(),r=m.monsters[id]||(m.monsters[id]={fights:1,defeated:0});
  r.defeated++;save();
};
C.monster=function(id){var r=load().monsters[id];return r?{fights:r.fights,defeated:r.defeated}:null};
C.hasMet=function(id){return !!load().monsters[id]};
C.metCount=function(){return Object.keys(load().monsters).length};

C.noteItems=function(ids){
  var m=load(),added=false;
  (ids||[]).forEach(function(id){if(ok(id)&&m.items.indexOf(id)<0){m.items.push(id);added=true}});
  if(added)save();
  return added;
};
C.hasFound=function(id){return load().items.indexOf(id)>=0};
C.foundIds=function(){return load().items.slice()};
/* every item in every hero's pack counts as found, so what a hero carries now (the starting kit, a purchase, a reward) is always in the Collection */
C.absorb=function(roster){
  var ids=[];
  try{
    roster.characters().forEach(function(cid){
      (roster.build(cid).inventory||[]).forEach(function(e){if(e&&e.qty>0)ids.push(e.item)});
    });
  }catch(e){}
  return C.noteItems(ids);
};
C.reset=function(){mem=blank();var st=ls();try{if(st)st.removeItem(STORE)}catch(e){}};
C._forget=function(){mem=null};
})(typeof window!=='undefined'?window:globalThis);
