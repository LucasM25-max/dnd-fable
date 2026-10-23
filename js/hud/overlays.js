/* Panels that open over the fight (implementation plan, section 13.13): the character sheet (C) and Controls and settings (H).
   They pause nothing and take no turn; the fight waits for the player as always. Esc closes them first. The sheet reads the
   hero's computed sheet and the fight's own numbers (hit points, pools), so it shows what is true now. */
(function(){
var KEYMAP=[
  ['Hover a square','Preview a move'],['Click','Move there, or attack the target you aimed at'],['1-9, 0','Use that ability slot'],
  ['Space','End turn'],['Esc','Cancel aiming, close a panel, then the menu'],['C','Character sheet'],['L','Combat log'],['H or ?','Controls and settings'],
  ['R / Enter','Reroll with Heroic Inspiration, when asked'],['K','Keep the roll, when asked'],['Q / E','Turn the camera'],['Drag, wheel','Orbit and zoom'],['Enter','Skip the action that is playing'],['F','Cycle playback speed'],['M','Mute or unmute']
];
function plateHtml(hud,inner){return hud.plate(inner,'ov-p')}
Fable.hudModules.overlays=function(hud){
  var host=document.createElement('div');
  host.className='ovl';host.hidden=true;
  hud.root.appendChild(host);
  var open=null,heroRef=null,stateRef=null,returnFocus=null;
  function frame(title,body,cls){
    return plateHtml(hud,'<header><h2>'+hud.escape(title)+'</h2><button type="button" class="ov-x" aria-label="Close" data-tip="Close (Esc)">'+Fable.hudIcons.svg('close')+'</button></header><div class="ov-b '+(cls||'')+'">'+body+'</div>');
  }
  function sheetHtml(){
    var v=Fable.hudModels.sheetView(heroRef);if(!v)return '<p>No sheet.</p>';
    var ab='<ul class="shabil">'+v.abilities.map(function(a){return '<li><small>'+a.name+'</small><b>'+a.mod+'</b><span>'+a.score+'</span></li>'}).join('')+'</ul>';
    var stats='<div class="shs"><div><small>Armor Class</small><b>'+v.ac+'</b></div><div><small>Hit points</small><b>'+hud.escape(v.hp)+'</b></div><div><small>Speed</small><b>'+hud.escape(v.speed)+'</b></div><div><small>Inspiration</small><b>'+(v.inspiration?'Ready':'None')+'</b></div></div>';
    var atk='<h3>Attacks</h3><table><tbody>'+v.attacks.map(function(a){return '<tr><td>'+hud.escape(a.name)+'</td><td>'+a.bonus+' to hit</td><td>'+hud.escape(a.damage)+'</td><td>'+hud.escape(a.mastery)+'</td></tr>'}).join('')+'</tbody></table>';
    var res=v.resources.length?'<h3>Pools</h3><ul class="shpool">'+v.resources.map(function(r){return '<li>'+hud.escape(r.name)+' <b>'+r.current+' / '+r.max+'</b></li>'}).join('')+'</ul>':'';
    var feats='<h3>Features</h3><ul class="shfeat">'+v.features.map(function(f){return '<li><b>'+hud.escape(f.name)+'</b><p>'+hud.escape(f.description)+'</p></li>'}).join('')+'</ul>';
    return '<div class="sh-top">'+ab+stats+'</div>'+atk+res+feats;
  }
  function settingsHtml(){
    var S=Fable.hudSettings,a=S.all();
    function opt(cur,rows){return rows.map(function(r){return '<option value="'+r[0]+'"'+(cur===r[0]?' selected':'')+'>'+r[1]+'</option>'}).join('')}
    function rng(k,label,v){return '<label class="shrng"><span>'+label+'</span><input type="range" min="0" max="1" step="0.05" value="'+v+'" data-k="'+k+'"><output>'+Math.round(v*100)+'%</output></label>'}
    function tog(k,label,help){return '<label class="shsw"><input type="checkbox" data-k="'+k+'"'+(a[k]?' checked':'')+'><span>'+label+'</span><small>'+help+'</small></label>'}
    var body='<div class="shset">'+
      '<label class="shrng"><span>HUD size</span><input type="range" min="0.85" max="1.3" step="0.05" value="'+a.scale+'" data-k="scale"><output>'+Math.round(a.scale*100)+'%</output></label>'+
      '<label class="shrng"><span>Dice card time</span><input type="range" min="2" max="8" step="1" value="'+a.feed+'" data-k="feed"><output>'+a.feed+' s</output></label>'+
      '<label class="shrng"><span>Motion</span><select data-k="motion"><option value="auto"'+(a.motion==='auto'?' selected':'')+'>Follow my system</option><option value="reduced"'+(a.motion==='reduced'?' selected':'')+'>Reduced</option><option value="full"'+(a.motion==='full'?' selected':'')+'>Full</option></select></label>'+
      '<label class="shrng"><span>Playback speed</span><select data-k="speed">'+opt(a.speed,[['normal','Normal'],['fast','Fast'],['instant','Instant (no animation)']])+'</select></label>'+
      '<label class="shrng"><span>Effects quality</span><select data-k="quality">'+opt(a.quality,[['auto','Auto'],['high','High'],['medium','Medium'],['low','Low']])+'</select></label>'+
      rng('volMaster','Master volume',a.volMaster)+rng('volMusic','Music',a.volMusic)+rng('volSfx','Effects',a.volSfx)+rng('volVoice','Voices',a.volVoice)+rng('shake','Camera shake',a.shake)+
      tog('mute','Mute all sound','Silences music, effects and voices.')+
      tog('barks','Speech bubbles','Creatures call out short lines in a fight.')+
      tog('numbers','Floating damage numbers','Numbers rise over a creature when it is hit.')+
      tog('nameplates','Name plates over creatures','Name and health above each creature.')+
      tog('log','Combat log open','The log can also be folded with L.')+
      tog('confirmEnd','Confirm ending a turn early','Asks first if you still have your Action and an enemy in reach.')+
      tog('contrast','High contrast','Brighter text and thicker edges.')+
      '<button type="button" class="reset">Restore defaults</button></div>';
    var keys='<h3>Controls</h3><dl class="shkeys">'+KEYMAP.map(function(k){return '<dt><kbd>'+hud.escape(k[0])+'</kbd></dt><dd>'+hud.escape(k[1])+'</dd>'}).join('')+'</dl>';
    return '<div class="shtwo">'+body+'<div>'+keys+'</div></div>';
  }
  function render(){
    if(!open)return;
    host.innerHTML=open==='sheet'?frame(heroRef.name,sheetHtml(),'shsheet'):frame('Controls and settings',settingsHtml(),'shhelp');
  }
  host.addEventListener('click',function(e){
    if(e.target===host){hud.closeOverlay();return}
    if(e.target.closest&&e.target.closest('.ov-x')){hud.closeOverlay();return}
    if(e.target.closest&&e.target.closest('.reset')){Fable.hudSettings.reset();render();return}
  });
  host.addEventListener('input',function(e){
    var k=e.target.getAttribute&&e.target.getAttribute('data-k');
    if(!k)return;
    var v=e.target.type==='checkbox'?e.target.checked:e.target.type==='range'?+e.target.value:e.target.value;
    Fable.hudSettings.set(k,v);
    var out=e.target.nextElementSibling;
    if(out&&out.tagName==='OUTPUT')out.textContent=(k==='scale'||/^vol|^shake/.test(k))?Math.round(v*100)+'%':v+' s';
  });
  hud.openOverlay=function(name,s){
    if(open===name){hud.closeOverlay();return}
    stateRef=s;heroRef=s.creatures.filter(function(c){return c.team==='player'})[0];
    returnFocus=document.activeElement;open=name;lastKey='';render();host.hidden=false;
    host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');host.setAttribute('aria-label',name==='sheet'?'Character sheet':'Controls and settings');
    var x=host.querySelector('.ov-x');if(x)try{x.focus({preventScroll:true})}catch(e){}
  };
  hud.closeOverlay=function(){
    if(!open)return;
    open=null;host.hidden=true;host.innerHTML='';
    if(returnFocus&&returnFocus.focus)try{returnFocus.focus({preventScroll:true})}catch(e){}
  };
  hud.overlayOpen=function(){return open};
  var lastKey='';
  return {update:function(s){
    if(open!=='sheet')return;
    stateRef=s;
    var k=JSON.stringify(Fable.hudModels.sheetView(heroRef));
    if(k===lastKey)return;
    lastKey=k;
    var top=host.querySelector('.ov-b')?host.querySelector('.ov-b').parentNode.scrollTop:0;
    render();
    var n=host.querySelector('.ov-b');if(n&&n.parentNode)n.parentNode.scrollTop=top;
  }};
};
})();
