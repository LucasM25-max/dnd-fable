/* Bottom centre, above the action economy: the hotbar and the action menu (implementation plan, section 13.6).

   The menu is the whole list of what the hero can do, sorted the way the rules sort it: tabs down the left for Actions, Bonus
   Actions and Reactions, and inside each of those tabs along the top for Attacks, Abilities, Standard actions and Gear (Spells
   will get their own the day there are spells). Above it sits the hotbar: ten slots the player pins whatever they like to. Slot 1
   is always Move. In the first fight the weapons and Second Wind are already pinned.

   Pinning: the pin on a menu slot (or right click, or Shift click) pins it to the first free hotbar slot and unpins it again;
   a menu slot can be dragged onto a hotbar slot, hotbar slots can be dragged to swap, and dragging one back into the menu or
   right clicking it unpins it. The keys 1 to 9 and 0 use the hotbar slots. The player's own layout is kept in the browser per hero.

   Each slot shows an icon, a cost marker that uses the same shapes as the economy plate (gold circle Action, green triangle Bonus
   Action, violet diamond Reaction, grey square free) and says why it is unavailable instead of just greying out. Clicking an attack
   arms it and the player then picks a target; every other slot acts at once. The model is in models-combat.js. */
(function(){
var COSTSHAPE={
  action:'<circle cx="6" cy="6" r="4.500"/>',bonus:'<path d="M6 1.500 11 10.500H1z"/>',reaction:'<path d="M6 .8 11.200 6 6 11.200.8 6z"/>',
  free:'<rect x="1.800" y="1.800" width="8.400" height="8.400"/>',object:'<rect x="1.800" y="1.800" width="8.400" height="8.400"/>',move:'<rect x="1.800" y="1.800" width="8.400" height="8.400"/>'
};
function costMark(cost){cost=cost==='move'?'free':cost;return '<svg class="cm '+cost+'" viewBox="0 0 12 12" aria-hidden="true" focusable="false">'+(COSTSHAPE[cost]||COSTSHAPE.free)+'</svg>'}
function catShape(id){
  var d={action:'<circle class="shape" cx="12" cy="12" r="8"/>',bonus:'<path class="shape" d="M12 4 21 19H3z"/>',reaction:'<path class="shape" d="M12 3 21 12 12 21 3 12z"/>'}[id];
  return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+d+'</svg>';
}
var STORE='dicebound.hotbar.v1';
function readStore(){try{return JSON.parse(window.localStorage.getItem(STORE)||'{}')||{}}catch(e){return {}}}
function writeStore(o){try{window.localStorage.setItem(STORE,JSON.stringify(o))}catch(e){}}

Fable.hudModules.actionBar=function(hud){
  var M=Fable.hudModels;
  var host=document.createElement('div');
  host.className='abar';
  host.innerHTML='<div class="hotbar" role="toolbar" aria-label="Hotbar"></div><div class="amenu" role="region" aria-label="Action menu"></div>';
  hud.root.appendChild(host);
  var hotEl=host.querySelector('.hotbar'),menuEl=host.querySelector('.amenu');
  var memory={},custom=null,heroKey='',pinsNow=M.defaultPins([]),catId='action',tabOf={},drag=null;
  var last='',lastS=null,lastCtx=null;

  function tipOf(sl,pin){
    var t=sl.name+'  ('+sl.costLabel+')'+(sl.tip?'\n'+sl.tip:'');
    if(!sl.ok&&sl.reason&&!sl.passive)t+='\nUnavailable: '+sl.reason;
    if(pin)t+='\n'+pin;
    return t;
  }
  function slotButton(sl,ctx,opts){
    opts=opts||{};
    var disabled=!sl.ok||ctx.busy,passive=!!sl.passive;
    var cls='slotb'+(sl.selected?' sel':'')+((disabled&&!passive)||opts.gone?' off':'')+(sl.kind==='attack'?' atk':'')+(passive?' passive':'');
    return '<button type="button" class="'+cls+'" data-id="'+hud.escape(sl.id)+'" data-reason="'+hud.escape(opts.gone?'Not available right now':(sl.reason||''))+'" '+
      'data-tip="'+hud.escape(tipOf(sl,opts.pinTip))+'" data-tip-up aria-disabled="'+(disabled||passive||opts.gone?'true':'false')+'" aria-pressed="'+(sl.selected?'true':'false')+'" '+
      'aria-label="'+hud.escape(sl.name+', '+sl.costLabel+(sl.sub?', '+sl.sub:'')+(sl.reason&&disabled&&!passive?', unavailable: '+sl.reason:''))+'"'+(opts.hotkey?' aria-keyshortcuts="'+opts.hotkey+'"':'')+'>'+
      '<span class="frame">'+Fable.hudIcons.svg(sl.icon)+'</span>'+
      (opts.hotkey?'<kbd class="hk">'+opts.hotkey+'</kbd>':'')+costMark(sl.cost)+
      (sl.uses?'<b class="uses">'+sl.uses.current+'</b>':'')+
      '</button>';
  }

  function render(force){
    var s=lastS,ctx=lastCtx;
    if(!s)return;
    var hero=s.creatures.filter(function(c){return c.team==='player'})[0];
    if(!hero)return;
    var key0=hero.defId||hero.id;
    if(key0!==heroKey){heroKey=key0;var st=readStore()[key0];custom=st&&Array.isArray(st)?M.normalizePins(st):null}
    var armed=ctx.targeting&&ctx.targeting.attackId;
    var list=M.actionBar(s,hero,armed),move=M.moveSlot(s,hero,armed),all=[move].concat(list);
    pinsNow=custom||M.defaultPins(all);
    var bar=M.hotbar(pinsNow,all,memory),menu=M.actionMenu(s,hero,list);
    var folded=!Fable.hudSettings.get('menu');
    var cat=menu.filter(function(c){return c.id===catId})[0]||menu[0];catId=cat.id;
    var tab=cat.tabs.filter(function(t){return t.id===tabOf[cat.id]})[0]||cat.tabs[0];tabOf[cat.id]=tab.id;
    var key=JSON.stringify([bar,menu,catId,tabOf,folded,!!custom])+(ctx.busy?'b':'');
    if(!force&&key===last)return;
    last=key;
    var pinned={};bar.forEach(function(e){if(e.id)pinned[e.id]=e.index});

    var hh='';
    bar.forEach(function(e){
      if(!e.slot){hh+='<div class="hslot empty" data-index="'+e.index+'" aria-label="Empty hotbar slot '+e.hotkey+'"><span class="frame"></span><kbd class="hk">'+e.hotkey+'</kbd></div>';return}
      hh+='<div class="hslot'+(e.gone?' gone':'')+'" data-index="'+e.index+'" data-id="'+hud.escape(e.id)+'"'+(e.index>0?' draggable="true"':'')+'>'+
        slotButton(e.slot,ctx,{hotkey:e.hotkey,gone:e.gone,pinTip:e.index>0?'Right click or drag away to unpin':'Always on the hotbar'})+'</div>';
    });
    hotEl.innerHTML=hud.plate('<div class="row">'+hh+'</div>','sm');

    var cats='';
    menu.forEach(function(c){
      cats+='<button type="button" role="tab" class="am-cat '+c.id+(c.id===catId?' on':'')+(c.used?' spent':'')+'" data-cat="'+c.id+'" aria-selected="'+(c.id===catId?'true':'false')+'" '+
        'data-tip="'+hud.escape(c.label+(c.used?': spent this turn':': '+c.count+' available'))+'" data-tip-right>'+catShape(c.id)+'<span>'+hud.escape(c.label)+'</span></button>';
    });
    var tabs='';
    cat.tabs.forEach(function(t){
      tabs+='<button type="button" role="tab" class="am-tab'+(t.id===tab.id?' on':'')+'" data-tab="'+t.id+'" aria-selected="'+(t.id===tab.id?'true':'false')+'">'+Fable.hudIcons.svg(t.icon)+'<span>'+hud.escape(t.label)+'</span></button>';
    });
    var grid='';
    tab.slots.forEach(function(sl){
      var pinnable=sl.pinnable!==false&&!sl.passive,at=pinned[sl.id];
      grid+='<div class="mslot'+(at!==undefined?' pinned':'')+'" data-id="'+hud.escape(sl.id)+'"'+(pinnable?' draggable="true"':'')+'>'+
        slotButton(sl,ctx,{pinTip:pinnable?(at!==undefined?'Right click to unpin':'Right click to pin to the hotbar'):''})+
        '<span class="mname'+(sl.ok||sl.passive?'':' off')+'">'+hud.escape(sl.name.replace(/ \(thrown\)$/,'').replace(/^Throw /,''))+'<small>'+hud.escape(sl.passive?sl.sub:sl.kind==='attack'&&/thrown/.test(sl.name)?'Thrown':(sl.sub||'').replace(/ left$/,''))+'</small></span>'+
        (pinnable?'<button type="button" class="pinb" data-pin="'+hud.escape(sl.id)+'" aria-pressed="'+(at!==undefined?'true':'false')+'" aria-label="'+(at!==undefined?'Unpin ':'Pin ')+hud.escape(sl.name)+(at!==undefined?' from':' to')+' the hotbar" data-tip="'+(at!==undefined?'Unpin from hotbar':'Pin to hotbar')+'" data-tip-up>'+Fable.hudIcons.svg('pin')+'</button>':'')+
        '</div>';
    });
    if(!tab.slots.length)grid='<p class="am-empty">'+hud.escape(tab.empty||'Nothing here')+'</p>';
    menuEl.classList.toggle('folded',folded);
    menuEl.innerHTML=hud.plate(
      '<div class="am-cats" role="tablist" aria-orientation="vertical" aria-label="Action type">'+cats+'</div>'+
      '<div class="am-main"><div class="am-bar"><div class="am-tabs" role="tablist" aria-label="'+hud.escape(cat.label)+'">'+tabs+'</div>'+
        (custom?'<button type="button" class="am-reset" data-tip="Put the hotbar back to its default" data-tip-up>Reset hotbar</button>':'')+
        '<button type="button" class="am-fold" aria-label="Hide the action menu (B)" data-tip="Hide the menu (B)" data-tip-up>'+Fable.hudIcons.svg('chevron')+'</button></div>'+
        '<div class="am-grid" role="tabpanel">'+grid+'</div></div>','sm');
    /* folded: only a thin handle remains, which brings the menu back */
    if(folded)menuEl.innerHTML='<button type="button" class="am-unfold" aria-label="Show the action menu (B)" data-tip="Show the action menu (B)" data-tip-up>'+Fable.hudIcons.svg('chevron')+'<span>Actions</span></button>';
  }

  function edit(next){
    if(!next){hud.announce('The hotbar is full. Unpin something first.');return}
    custom=next;
    var o=readStore();o[heroKey]=custom;writeStore(o);
    render(true);
  }
  function pinToggle(id){
    var was=pinsNow.indexOf(id)>0;
    var r=M.pinToggle(pinsNow,id);
    edit(r);
    if(r)hud.announce(was?'Unpinned':'Pinned to the hotbar');
  }

  host.addEventListener('click',function(e){
    var t=e.target.closest?e.target:null;if(!t)return;
    var b;
    if((b=t.closest('.pinb'))){pinToggle(b.getAttribute('data-pin'));return}
    if((b=t.closest('.am-cat'))){catId=b.getAttribute('data-cat');render(true);return}
    if((b=t.closest('.am-tab'))){tabOf[catId]=b.getAttribute('data-tab');render(true);return}
    if(t.closest('.am-fold')||t.closest('.am-unfold')){Fable.hudSettings.set('menu',!Fable.hudSettings.get('menu'));return}
    if(t.closest('.am-reset')){custom=null;var o=readStore();delete o[heroKey];writeStore(o);hud.announce('Hotbar reset');render(true);return}
    b=t.closest('.slotb');
    if(!b)return;
    var id=b.getAttribute('data-id');
    if(e.shiftKey&&t.closest('.mslot')){pinToggle(id);return}
    if(b.getAttribute('aria-disabled')==='true'){
      if(hud.intents.denied&&!b.classList.contains('passive'))hud.intents.denied(b.getAttribute('data-reason')||'');
      return;
    }
    if(hud.intents.slot)hud.intents.slot(id);
  });
  host.addEventListener('contextmenu',function(e){
    var h=e.target.closest&&e.target.closest('.hslot'),m=e.target.closest&&e.target.closest('.mslot');
    if(h){
      e.preventDefault();
      var i=+h.getAttribute('data-index');
      if(i>0&&pinsNow[i])edit(M.pinRemove(pinsNow,i));
    }else if(m&&m.querySelector('.pinb')){e.preventDefault();pinToggle(m.getAttribute('data-id'))}
  });

  /* drag and drop: menu slot -> hotbar slot pins it there; hotbar -> hotbar swaps; hotbar -> menu unpins */
  host.addEventListener('dragstart',function(e){
    var h=e.target.closest&&e.target.closest('.hslot'),m=e.target.closest&&e.target.closest('.mslot');
    var src=h&&h.getAttribute('data-id')?{id:h.getAttribute('data-id'),from:+h.getAttribute('data-index')}:m?{id:m.getAttribute('data-id'),from:-1}:null;
    if(!src||src.from===0){e.preventDefault();return}
    drag=src;
    try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',src.id)}catch(x){}
    host.classList.add('dragging');
  });
  host.addEventListener('dragend',function(){drag=null;host.classList.remove('dragging');Array.prototype.forEach.call(host.querySelectorAll('.drop'),function(n){n.classList.remove('drop')})});
  host.addEventListener('dragover',function(e){
    if(!drag)return;
    var h=e.target.closest&&e.target.closest('.hslot'),over=e.target.closest&&e.target.closest('.amenu');
    if((h&&+h.getAttribute('data-index')>0)||(over&&drag.from>0)){e.preventDefault();try{e.dataTransfer.dropEffect='move'}catch(x){}}
    Array.prototype.forEach.call(host.querySelectorAll('.drop'),function(n){n.classList.remove('drop')});
    if(h&&+h.getAttribute('data-index')>0)h.classList.add('drop');
  });
  host.addEventListener('drop',function(e){
    if(!drag)return;
    var src=drag;drag=null;
    var h=e.target.closest&&e.target.closest('.hslot'),over=e.target.closest&&e.target.closest('.amenu');
    if(h&&+h.getAttribute('data-index')>0){
      e.preventDefault();
      var to=+h.getAttribute('data-index');
      edit(src.from>0?M.pinSwap(pinsNow,src.from,to):M.pinPlace(pinsNow,src.id,to));
    }else if(over&&src.from>0){e.preventDefault();edit(M.pinRemove(pinsNow,src.from))}
  });

  Fable.hudSettings.onChange(function(k){if((k==='menu'||k==='*')&&host.isConnected)render(true)});
  hud.hotbarId=function(i){var e=null;try{e=M.hotbar(pinsNow,[],memory)[i]}catch(x){}return e&&e.id?e.id:null};
  hud.toggleMenu=function(){Fable.hudSettings.set('menu',!Fable.hudSettings.get('menu'))};
  return {
    update:function(s,ctx){
      var hero=s.creatures.filter(function(c){return c.team==='player'})[0];
      if(!hero||s.phase==='setup')return;
      lastS=s;lastCtx=ctx;
      render(false);
    }
  };
};
})();
