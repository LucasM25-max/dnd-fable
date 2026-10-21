/* Bottom centre, above the action economy: the ability bar (implementation plan, section 13.6). Weapon attacks first, then
   features such as Second Wind, the standard actions Dash, Disengage and Dodge, and loadout swaps. Each slot shows its
   hotkey, an icon, a cost marker that uses the same shapes as the economy plate (gold circle Action, green triangle Bonus
   Action, violet diamond Reaction, grey square free), and says why it is unavailable instead of just greying out.
   Clicking an attack arms it and the player then picks a target; every other slot acts at once. */
(function(){
var COSTSHAPE={
  action:'<circle cx="6" cy="6" r="4.500"/>',bonus:'<path d="M6 1.500 11 10.500H1z"/>',reaction:'<path d="M6 .8 11.200 6 6 11.200.8 6z"/>',
  free:'<rect x="1.800" y="1.800" width="8.400" height="8.400"/>',object:'<rect x="1.800" y="1.800" width="8.400" height="8.400"/>'
};
function costMark(cost){return '<svg class="cm '+cost+'" viewBox="0 0 12 12" aria-hidden="true" focusable="false">'+(COSTSHAPE[cost]||COSTSHAPE.free)+'</svg>'}
Fable.hudModules.actionBar=function(hud){
  var host=document.createElement('div');
  host.className='abar';host.setAttribute('role','toolbar');host.setAttribute('aria-label','Abilities');
  hud.root.appendChild(host);
  var built='',slots={};
  function tipOf(sl){
    var t=sl.name+'  ('+sl.costLabel+')\n'+(sl.tip||'');
    if(!sl.ok&&sl.reason)t+='\nUnavailable: '+sl.reason;
    return t;
  }
  host.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('.slotb');
    if(!b||b.getAttribute('aria-disabled')==='true'){
      if(b&&hud.intents.denied)hud.intents.denied(b.getAttribute('data-reason')||'');
      return;
    }
    if(hud.intents.slot)hud.intents.slot(b.getAttribute('data-id'));
  });
  return {
    update:function(s,ctx){
      var hero=s.creatures.filter(function(c){return c.team==='player'})[0];
      if(!hero||s.phase==='setup')return;
      var list=Fable.hudModels.actionBar(s,hero,ctx.targeting&&ctx.targeting.attackId),key=JSON.stringify(list)+(ctx.busy?'b':'');
      if(key===built)return;
      built=key;
      var html='',lastGroup='';
      list.forEach(function(sl){
        if(lastGroup&&sl.group!==lastGroup)html+='<i class="div" aria-hidden="true"></i>';
        lastGroup=sl.group;
        var disabled=!sl.ok||ctx.busy;
        html+='<button type="button" class="slotb'+(sl.selected?' sel':'')+(disabled?' off':'')+(sl.kind==='attack'?' atk':'')+'" data-id="'+hud.escape(sl.id)+'" data-reason="'+hud.escape(sl.reason||'')+'" '+
          'data-tip="'+hud.escape(tipOf(sl))+'" data-tip-up aria-disabled="'+(disabled?'true':'false')+'" aria-pressed="'+(sl.selected?'true':'false')+'" '+
          'aria-label="'+hud.escape(sl.name+', '+sl.costLabel+(sl.sub?', '+sl.sub:'')+(sl.reason&&disabled?', unavailable: '+sl.reason:''))+'"'+(sl.hotkey?' aria-keyshortcuts="'+sl.hotkey+'"':'')+'>'+
          '<span class="frame">'+Fable.hudIcons.svg(sl.icon)+'</span>'+
          (sl.hotkey?'<kbd class="hk">'+sl.hotkey+'</kbd>':'')+costMark(sl.cost)+
          (sl.uses?'<b class="uses">'+sl.uses.current+'</b>':'')+
          '</button>';
      });
      host.innerHTML=hud.plate('<div class="row">'+html+'</div>','sm');
    }
  };
};
})();
