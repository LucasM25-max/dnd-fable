/* The equipment panel: what a character holds and wears, and how to change it. One component, two homes: the bottom left of the main menu
   (for the character that will play) and the bottom left of each page of the Characters screen (for that character).

   Three slots (Right hand, Left hand, Body) show what is in them as the item's real voxel model; a click opens a list of what the character
   carries that fits there, and Empty. Below, everything carried is shown once: gear that is held or worn is lit and marked with its slot,
   gear that is not is greyed out (a click equips it, a click on a lit one puts it away), and the backpack (potions, packs) is never greyed.
   The rules are Fable.character.inventory through Fable.character.equipView; a change goes through Fable.character.roster.equip, so the hub's
   3D model, the stat line here and the next fight all follow at once, and the choice is saved.

   var p = Fable.equipmentPanel.create(heroId, {say(message), className})
     p.el            the panel element (put it anywhere)
     p.setHero(id)   show another character
     p.refresh()     redraw (it already redraws when the roster changes)
     p.closeList()   close the open list of choices, true when one was open
     p.destroy()     remove it and stop listening */
(function(){
var SLOT_ICON={mainhand:'sword',offhand:'guard',body:'guard'};
function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
function Ro(){return Fable.character.roster}
function EV(){return Fable.character.equipView}
function pluralQty(n){return n>1?'x'+n:''}

/* the real voxel model of an item, or its glyph when 3D is not available */
function paintIcon(host,itemId,px,fallbackIcon){
  host.textContent='';
  var ok=false;
  if(itemId&&Fable.headPortrait){try{ok=Fable.headPortrait.itemFill(host,itemId,{w:px,h:px,slant:true})}catch(e){ok=false}}
  if(!ok&&Fable.hudIcons){host.insertAdjacentHTML('beforeend',Fable.hudIcons.svg(fallbackIcon||'book'));host.classList.add('flat')}
  else host.classList.remove('flat');
}
function glyphFor(it){
  if(!it)return 'book';
  if(it.use&&it.use.icon==='potion'||it.id==='potion-of-healing')return 'potion';
  if(it.type==='armor')return 'guard';
  if(it.id==='dagger')return 'dagger';
  if(it.id==='javelin'||it.id==='spear')return 'javelin';
  if(it.type==='weapon')return 'sword';
  return 'book';
}

var uid=0;
function create(heroId,opts){
  opts=opts||{};
  var id=heroId,root=el('section','eqp'+(opts.className?' '+opts.className:'')),listId='eqp-list-'+(++uid);
  root.setAttribute('aria-label','Equipment');
  var live=el('div','sr-only');live.setAttribute('role','status');live.setAttribute('aria-live','polite');
  var open=null;            /* {slot, from} while a list of choices is showing */
  var off=null,gone=false,docDown=null;

  function say(msg){
    if(!msg)return;
    live.textContent='';setTimeout(function(){live.textContent=msg},30);
    if(opts.say)opts.say(msg);
  }
  function build(){return Ro().build(id)}

  /* ---------- the list of choices for one slot ---------- */
  function closeList(restoreFocus){
    if(!open)return false;
    var from=open.from;
    var pop=root.querySelector('.eqp-pop');if(pop)pop.remove();
    if(from)from.setAttribute('aria-expanded','false');
    open=null;
    if(docDown){document.removeEventListener('pointerdown',docDown,true);docDown=null}
    if(restoreFocus&&from&&document.contains(from))try{from.focus({preventScroll:true})}catch(e){}
    return true;
  }
  function choose(slot,itemId){
    var m=EV().plan(build(),slot,itemId);
    closeList(true);
    if(!m.ok){say(m.reasons[0]||'That cannot be changed');return}
    var r=Ro().equip(id,m.build.equipped);
    if(!r.ok){say(r.reasons[0]||'That cannot be changed');return}
    var name=itemId?Fable.content.items.get(itemId).name:'',where=EV().slotLabel(slot).toLowerCase();
    say((itemId?name+' in the '+where:'The '+where+' is empty')+(m.notes&&m.notes.length?'. '+m.notes.join(', ')+'.':'.'));
  }
  function openList(slotModel,from){
    if(open&&open.slot===slotModel.id){closeList(true);return}
    closeList();
    var pop=el('div','eqp-pop');pop.id=listId;pop.setAttribute('role','listbox');pop.setAttribute('aria-label',slotModel.label);
    pop.appendChild(el('div','eqp-pop-h',slotModel.label));
    var rows=[];
    slotModel.options.forEach(function(o){
      var b=el('button','eqp-opt'+(o.current?' on':'')+(o.ok?'':' no'));b.type='button';b.setAttribute('role','option');
      b.setAttribute('aria-selected',o.current?'true':'false');
      var ic=el('span','eqp-oic');paintIcon(ic,o.item,40,glyphFor(Fable.content.items.get(o.item)));b.appendChild(ic);
      var tx=el('span','eqp-otx');tx.appendChild(el('b',null,o.name));
      var meta=[];
      if(o.current)meta.push('Equipped');
      else if(o.elsewhere.length)meta.push('In the '+EV().slotLabel(o.elsewhere[0]).toLowerCase());
      if(o.qty>1)meta.push('x'+o.qty);
      if(o.ok&&!o.current&&o.notes&&o.notes.length)meta.push(o.notes.join(', '));
      if(!o.ok)meta.push(o.reasons[0]||'Cannot be equipped');
      tx.appendChild(el('small',null,meta.join('  ')));b.appendChild(tx);
      if(o.ok)b.onclick=function(){if(o.current)closeList(true);else choose(slotModel.id,o.item)};
      else b.setAttribute('aria-disabled','true');
      pop.appendChild(b);rows.push(b);
    });
    var e=el('button','eqp-opt eqp-empty'+(slotModel.item?'':' on'));e.type='button';e.setAttribute('role','option');
    e.setAttribute('aria-selected',slotModel.item?'false':'true');
    var eic=el('span','eqp-oic flat');eic.innerHTML=Fable.hudIcons?Fable.hudIcons.svg('close'):'';e.appendChild(eic);
    var etx=el('span','eqp-otx');etx.appendChild(el('b',null,slotModel.id==='body'?'Take armor off':'Empty hand'));
    etx.appendChild(el('small',null,slotModel.item?'Put '+slotModel.item.name+' away':'Nothing held'));e.appendChild(etx);
    if(slotModel.item)e.onclick=function(){choose(slotModel.id,null)};else e.onclick=function(){closeList(true)};
    pop.appendChild(e);rows.push(e);
    if(!slotModel.options.length)pop.insertBefore(el('p','eqp-none','Nothing carried fits here.'),e);
    root.appendChild(pop);
    from.setAttribute('aria-expanded','true');
    open={slot:slotModel.id,from:from,rows:rows};
    /* the arrow keys walk the list; the one held now (or the first) takes focus */
    var start=rows.filter(function(r){return r.classList.contains('on')})[0]||rows[0];
    if(start)try{start.focus({preventScroll:true})}catch(er){}
    pop.addEventListener('keydown',function(ev){
      var i=rows.indexOf(document.activeElement);
      if(ev.key==='ArrowDown'||ev.key==='ArrowRight'){ev.preventDefault();rows[(i+1)%rows.length].focus()}
      else if(ev.key==='ArrowUp'||ev.key==='ArrowLeft'){ev.preventDefault();rows[(i+rows.length-1)%rows.length].focus()}
      else if(ev.key==='Home'){ev.preventDefault();rows[0].focus()}
      else if(ev.key==='End'){ev.preventDefault();rows[rows.length-1].focus()}
      else if(ev.key==='Tab'){closeList(false)}
    });
    docDown=function(ev){if(!root.contains(ev.target))closeList(false)};
    document.addEventListener('pointerdown',docDown,true);
  }

  /* ---------- the panel ---------- */
  function slotCard(s){
    var b=el('button','eqp-slot'+(s.item?' filled':' empty'));b.type='button';b.dataset.slot=s.id;
    b.setAttribute('aria-haspopup','listbox');b.setAttribute('aria-expanded',open&&open.slot===s.id?'true':'false');b.setAttribute('aria-controls',listId);
    b.setAttribute('aria-label',s.label+': '+(s.item?s.item.name:'empty')+'. Change');
    var ic=el('span','eqp-ico');
    if(s.item)paintIcon(ic,s.item.id,64,glyphFor(Fable.content.items.get(s.item.id)));
    else{ic.classList.add('flat','ghost');ic.innerHTML=Fable.hudIcons?Fable.hudIcons.svg(s.id==='body'?'guard':'fist'):''}
    b.appendChild(ic);
    b.appendChild(el('span','eqp-lab',s.label));
    b.appendChild(el('b','eqp-nm',s.item?s.item.name:'Empty'));
    b.appendChild(el('i','eqp-chev'));
    b.onclick=function(){openList(s,b)};
    b.addEventListener('keydown',function(ev){if(ev.key==='ArrowDown'&&!open){ev.preventDefault();openList(s,b)}});
    return b;
  }
  var SLOT_TAG={mainhand:'R',offhand:'L',body:'B'};
  function gearChip(g){
    var b=el('button','eqp-chip is-'+g.state);b.type='button';b.dataset.item=g.item;
    var ic=el('span','eqp-cic');paintIcon(ic,g.item,44,glyphFor(Fable.content.items.get(g.item)));b.appendChild(ic);
    if(g.state!=='stowed'){
      b.appendChild(el('span','eqp-pip',g.slots.map(function(s){return SLOT_TAG[s]}).join('')));
    }
    var q=g.state==='partial'?g.equippedQty+'/'+g.qty:pluralQty(g.qty);
    if(q)b.appendChild(el('span','eqp-q',q));
    var hint=EV().hint(build(),g.item);
    var stateWord=g.state==='equipped'?(g.slots.map(function(s){return EV().slotLabel(s).toLowerCase()}).join(' and ')):g.state==='partial'?g.equippedQty+' of '+g.qty+' held':'not equipped';
    b.title=g.name+' ('+stateWord+'). '+hint+'.';
    b.setAttribute('aria-label',g.name+(g.qty>1?', '+g.qty+' carried':'')+', '+stateWord+'. '+hint);
    b.setAttribute('aria-pressed',g.state==='stowed'?'false':'true');
    b.onclick=function(){
      closeList();
      var r=EV().quick(build(),g.item);
      if(!r.ok){say(r.reasons[0]||'That cannot be changed');return}
      var res=Ro().equip(id,r.build.equipped);
      if(!res.ok){say(res.reasons[0]||'That cannot be changed');return}
      var nm=g.name,wh=EV().slotLabel(r.slot).toLowerCase();
      say((r.action==='equip'?nm+' in the '+wh:nm+' put away')+(r.notes&&r.notes.length?'. '+r.notes.join(', ')+'.':'.'));
    };
    return b;
  }
  function packChip(p){
    var b=el('span','eqp-chip is-pack');b.tabIndex=0;b.dataset.item=p.item;
    var ic=el('span','eqp-cic');paintIcon(ic,p.item,44,glyphFor(Fable.content.items.get(p.item)));b.appendChild(ic);
    if(p.qty>1)b.appendChild(el('span','eqp-q',pluralQty(p.qty)));
    var tip=p.name+(p.qty>1?' x'+p.qty:'')+(p.usable?'. Used in a fight.':'. Carried in the backpack.');
    b.title=tip;b.setAttribute('role','img');b.setAttribute('aria-label',tip);
    return b;
  }
  function draw(){
    /* everything is drawn anew, so the keyboard is put back on whatever it was on (a slot or a carried item) */
    var ae=document.activeElement,inside=!!ae&&root.contains(ae),focusKey=null;
    if(inside&&ae.dataset){focusKey=ae.dataset.slot?'slot':ae.dataset.item?'item':null;if(focusKey==='slot')focusKey='.eqp-slot[data-slot="'+ae.dataset.slot+'"]';else if(focusKey==='item')focusKey='.eqp-chip[data-item="'+ae.dataset.item+'"]'}
    if(!focusKey&&inside&&open)focusKey='.eqp-slot[data-slot="'+open.slot+'"]';
    closeList();
    root.textContent='';
    var m;
    try{m=EV().model(build())}catch(e){root.appendChild(el('p','eqp-none','Equipment could not be read.'));if(window.console)console.warn('Equipment panel: '+e.message);return}
    var head=el('header','eqp-h');head.appendChild(el('h3',null,'Equipment'));
    var sum=el('p','eqp-sum');
    var ac=el('b',null,'AC '+m.ac);sum.appendChild(ac);
    sum.appendChild(el('span',null,m.attack?m.attack.name+' '+(m.attack.bonus<0?'-':'+')+Math.abs(m.attack.bonus)+', '+m.attack.damage+' '+m.attack.damageType:'Unarmed'));
    head.appendChild(sum);root.appendChild(head);
    var slots=el('div','eqp-slots');m.slots.forEach(function(s){slots.appendChild(slotCard(s))});root.appendChild(slots);
    var rows=el('div','eqp-rows');
    var carried=el('div','eqp-grp');carried.appendChild(el('h4',null,'Carried'));
    var cc=el('div','eqp-chips');m.gear.forEach(function(g){cc.appendChild(gearChip(g))});
    if(!m.gear.length)cc.appendChild(el('span','eqp-none','Nothing'));
    carried.appendChild(cc);rows.appendChild(carried);
    var pack=el('div','eqp-grp pack');pack.appendChild(el('h4',null,'Backpack'));
    var pc=el('div','eqp-chips');m.backpack.forEach(function(p){pc.appendChild(packChip(p))});
    if(!m.backpack.length)pc.appendChild(el('span','eqp-none','Empty'));
    pack.appendChild(pc);rows.appendChild(pack);
    root.appendChild(rows);root.appendChild(live);
    if(focusKey){var again=root.querySelector(focusKey);if(again)try{again.focus({preventScroll:true})}catch(e){}}
  }
  draw();
  off=Ro().onChange(function(changedId){if(!gone&&(changedId===id||changedId==='*'))draw()});
  return {
    el:root,
    setHero:function(next){if(next===id)return;closeList();id=next;draw()},
    refresh:draw,
    closeList:function(){return closeList(true)},
    isListOpen:function(){return !!open},
    destroy:function(){gone=true;closeList();if(off)off();off=null;root.remove()}
  };
}
Fable.equipmentPanel={create:create};
})();
