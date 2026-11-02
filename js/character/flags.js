/* Small pieces of player state that are not part of a hero: has the first-launch tutorial been played, which difficulty was chosen last,
   and which encounters were played recently (so the generator does not repeat itself). Saved in localStorage; when storage is
   blocked (a private window) everything still works for the visit and is simply not remembered.

   Fable.flags.tutorialDone() / setTutorialDone(bool)
   Fable.flags.difficulty() / setDifficulty(id)      'low' | 'moderate' | 'high' (moderate until chosen)
   Fable.flags.recent() / pushRecent(key)            the last few encounter keys, oldest first
   Fable.flags.reset()                               forget everything (the tutorial plays again) */
(function(G){
G.Fable=G.Fable||{};
var F=G.Fable.flags={},STORE='dicebound.flags.v1',LEVELS=['low','moderate','high'],KEEP=6;
var mem=null;
function blank(){return {v:1,tutorialDone:false,difficulty:'moderate',recent:[]}}
function ls(){try{return G.localStorage||null}catch(e){return null}}
function load(){
  if(mem)return mem;
  var out=blank(),st=ls();
  try{
    var j=st&&JSON.parse(st.getItem(STORE)||'null');
    if(j&&j.v===1){
      out.tutorialDone=j.tutorialDone===true;
      if(LEVELS.indexOf(j.difficulty)>=0)out.difficulty=j.difficulty;
      if(Array.isArray(j.recent))out.recent=j.recent.filter(function(k){return typeof k==='string'}).slice(-KEEP);
    }
  }catch(e){}
  mem=out;return mem;
}
function save(){var st=ls();try{if(st)st.setItem(STORE,JSON.stringify(load()))}catch(e){}}
F.tutorialDone=function(){return load().tutorialDone};
F.setTutorialDone=function(v){load().tutorialDone=!!v;save()};
F.difficulty=function(){return load().difficulty};
F.setDifficulty=function(id){if(LEVELS.indexOf(id)<0)return false;load().difficulty=id;save();return true};
F.recent=function(){return load().recent.slice()};
F.pushRecent=function(key){
  if(typeof key!=='string'||!key)return;
  var m=load();m.recent.push(key);m.recent=m.recent.slice(-KEEP);save();
};
F.reset=function(){mem=blank();var st=ls();try{if(st)st.removeItem(STORE)}catch(e){}};
/* tests drop the in-memory copy so the next call reads storage again */
F._forget=function(){mem=null};
})(typeof window!=='undefined'?window:globalThis);
