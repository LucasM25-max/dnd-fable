/* HUD settings (implementation plan, section 13.13): a few comfort and accessibility switches, kept in the browser when it lets
   us and in memory when it does not. Fable.hudSettings.get(key), set(key, value), onChange(fn), all(). Keys:
     scale          HUD size, 0.85 to 1.3
     numbers        floating damage numbers over creatures
     nameplates     name and health plates over creatures
     log            the combat log is open
     menu           the tabbed action menu above the economy plate is open (B folds it; the hotbar stays)
     feed           how long the dice card stays, in seconds (2 to 8)
     motion         'auto' follows the system, 'reduced' or 'full' forces it
     contrast       true thickens edges and brightens text
     confirmEnd     ask before ending a turn with an Action unspent and an enemy in reach
     speed          'normal', 'fast' or 'instant': how fast fights are played; Enter skips what is playing (Phase 7)
     quality        'auto' (adapts to the frame rate), 'high', 'medium' or 'low': particle and light budgets
     volMaster, volMusic, volSfx, volVoice   0 to 1      mute   silences everything
     tactics        'auto' (what the encounter says), or the enemy tier: instinct, cunning, tactician, mastermind
     explainAi      print each enemy plan and why to the browser console
     barks          creatures call out short lines in speech bubbles      shake   camera shake strength, 0 to 1 */
(function(){
var KEY='dicebound.hud.v1';
var DEFAULTS={confirmEnd:true,scale:1,numbers:true,nameplates:true,log:true,menu:true,feed:4,motion:'auto',contrast:false,
  speed:'normal',quality:'auto',volMaster:.8,volMusic:.55,volSfx:.9,volVoice:.8,mute:false,barks:true,shake:1,tactics:'auto',explainAi:false};
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
  if(k==='speed')return v==='fast'||v==='instant'?v:'normal';
  if(k==='quality')return v==='high'||v==='medium'||v==='low'?v:'auto';
  if(k==='volMaster'||k==='volMusic'||k==='volSfx'||k==='volVoice'){var n=+v;return isFinite(n)?Math.max(0,Math.min(1,n)):DEFAULTS[k]}
  if(k==='tactics')return v==='instinct'||v==='cunning'||v==='tactician'||v==='mastermind'?v:'auto';
  if(k==='shake'){var m=+v;return isFinite(m)?Math.max(0,Math.min(1,m)):1}
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
