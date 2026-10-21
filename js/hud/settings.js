/* HUD settings (implementation plan, section 13.13): a few comfort and accessibility switches, kept in the browser when it lets
   us and in memory when it does not. Fable.hudSettings.get(key), set(key, value), onChange(fn), all(). Keys:
     scale          HUD size, 0.85 to 1.3
     numbers        floating damage numbers over creatures
     nameplates     name and health plates over creatures
     log            the combat log is open
     feed           how long the dice card stays, in seconds (2 to 8)
     motion         'auto' follows the system, 'reduced' or 'full' forces it
     contrast       true thickens edges and brightens text
     confirmEnd     ask before ending a turn with an Action unspent and an enemy in reach */
(function(){
var KEY='dicebound.hud.v1';
var DEFAULTS={confirmEnd:true,scale:1,numbers:true,nameplates:true,log:true,feed:4,motion:'auto',contrast:false};
var cur=Object.assign({},DEFAULTS),listeners=[];
try{
  var raw=window.localStorage.getItem(KEY);
  if(raw){var o=JSON.parse(raw);Object.keys(DEFAULTS).forEach(function(k){if(o&&typeof o[k]===typeof DEFAULTS[k])cur[k]=o[k]})}
}catch(e){}
function save(){try{window.localStorage.setItem(KEY,JSON.stringify(cur))}catch(e){}}
function clamp(k,v){
  if(k==='scale')return Math.max(.85,Math.min(1.3,+v||1));
  if(k==='feed')return Math.max(2,Math.min(8,Math.round(+v||4)));
  if(k==='motion')return v==='reduced'||v==='full'?v:'auto';
  return typeof DEFAULTS[k]==='boolean'?!!v:v;
}
Fable.hudSettings={
  defaults:DEFAULTS,
  get:function(k){return cur[k]},
  all:function(){return Object.assign({},cur)},
  set:function(k,v){
    if(!(k in DEFAULTS))return;
    cur[k]=clamp(k,v);save();
    listeners.slice().forEach(function(fn){fn(k,cur[k])});
  },
  reset:function(){cur=Object.assign({},DEFAULTS);save();listeners.slice().forEach(function(fn){fn('*',null)})},
  onChange:function(fn){listeners.push(fn);return function(){listeners=listeners.filter(function(f){return f!==fn})}},
  reducedMotion:function(){
    if(cur.motion==='reduced')return true;if(cur.motion==='full')return false;
    try{return window.matchMedia('(prefers-reduced-motion:reduce)').matches}catch(e){return false}
  }
};
})();
