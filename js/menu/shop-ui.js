/* The Store (implementation plan, Phase 9): a full page menu for buying, in the menu's wood and gold. The page slides sideways: tabs along the top
   jump to Featured, Character, Equipment and Cosmetics, and each holds groups of square tiles (Equipment: weapons, adventuring gear, armour;
   Cosmetics: skins, victory animations, backgrounds; Character: subclasses, species, feats). Every tile shows a small 3D preview of the thing
   (js/menu/store-previews.js, turning while the pointer is on it); a click opens a big preview with a podium (js/menu/store-stage.js), all
   its details and the buy button. Only what the game has today is for sale; a group with nothing in it says coming soon.
   Fable.shopUi.open(heroId, shopId, {say, manual}) / close() / isOpen() / stage()   Escape closes the big preview, then the page. */
(function(){
Fable.shopUi=(function(){
  var root=null,stage=null,pv=null,tiles=[],els={},state={hero:'human-fighter',shop:'armory',qty:{},sel:null,stock:[]},opener=null,off=null,toastFn=null,manual=false,paintT=0;
  var Ro=function(){return Fable.character.roster};
  function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
  function say(m){if(toastFn)toastFn(m);var l=document.getElementById('hud-live')||document.getElementById('store-live');if(l)l.textContent=m}
  function gp(cp){return Fable.money.format(cp)}
  function coin(){return el('i','coin')}
  function price(cp){var b=el('span','sh-pr');b.appendChild(coin());b.appendChild(document.createTextNode(gp(cp)));return b}
  function itemDef(id){return Fable.content.items.get(id)}
  function equipped(item){var n=0,e=Ro().build(state.hero).equipped||{};Object.keys(e).forEach(function(k){if(e[k]===item)n++});return n}

  /* ---------- what an item is, in words ---------- */
  function iconFor(it){
    if(!it)return 'book';
    if(it.id==='potion-of-healing'||(it.use&&it.use.icon==='potion'))return 'potion';
    if(it.type==='armor')return 'guard';
    if(it.id==='dagger')return 'dagger';
    if(it.id==='javelin'||it.id==='spear')return 'javelin';
    if(it.type==='weapon')return 'sword';
    return 'book';
  }
  function titleCase(s){return String(s||'').replace(/(^|[-\s])(\w)/g,function(m,a,c){return (a?' ':'')+c.toUpperCase()})}
  function kindLine(it){
    if(!it)return '';
    if(it.type==='weapon')return titleCase(it.category)+' weapon';
    if(it.type==='armor')return it.category==='shield'?'Shield':titleCase(it.category)+' armor';
    if(it.magic)return 'Magic item';
    return titleCase(it.type);
  }
  function statsOf(it){
    var out=[];
    if(!it)return out;
    if(it.type==='weapon'&&it.damage){
      out.push(['Damage',it.damage.dice+' '+it.damage.type]);
      if(it.versatile)out.push(['Two handed',(it.versatile.dice||it.versatile)+'']);
      if(it.range)out.push(['Range',it.range.normal+' / '+it.range.long+' ft']);
      if(it.properties&&it.properties.length)out.push(['Properties',it.properties.map(titleCase).join(', ')]);
      if(it.mastery)out.push(['Mastery',titleCase(it.mastery)]);
    }else if(it.type==='armor'&&it.ac){
      out.push(['Armor Class',it.ac.bonus?'+'+it.ac.bonus:String(it.ac.base)+(it.ac.dex==='full'?' + Dex':it.ac.dex==='cap'?' + Dex (max '+(it.ac.dexCap||2)+')':'')]);
      if(it.stealthDisadvantage)out.push(['Stealth','Disadvantage']);
      if(it.strengthRequirement)out.push(['Strength',String(it.strengthRequirement)]);
    }else if(it.use&&it.use.text){
      out.push(['Use',it.use.cost==='bonus'?'Bonus Action':titleCase(it.use.cost)]);
      out.push(['Effect',it.use.text.replace(/^Drink the potion as a Bonus Action to /,'').replace(/^./,function(c){return c.toUpperCase()})]);
    }
    if(it.weight!==undefined)out.push(['Weight',it.weight+' lb']);
    return out;
  }

  /* ---------- the data, read fresh whenever the roster changes ---------- */
  var cat={},poseRows={};
  function readData(){
    var b=Ro().build(state.hero),owned=Ro().victoriesOwned(state.hero),sel=Ro().victory(state.hero),purse=Ro().purseCp(state.hero);
    cat={};poseRows={};
    Fable.character.shop.catalog(state.shop,b).forEach(function(c){cat[c.item]=c});
    Fable.content.victoryAnimations.list().forEach(function(v){
      var cp=v.cost?Fable.money.toCp(v.cost):0,has=owned.indexOf(v.id)>=0;
      poseRows[v.id]={kind:'pose',id:v.id,name:v.name,description:v.description,costCp:cp,owned:has,canAfford:purse>=cp,selected:sel===v.id};
    });
  }
  function rowFor(kind,id){
    if(kind==='pose')return poseRows[id]||null;
    var c=cat[id];if(!c)return null;
    return {kind:'item',id:id,name:c.name,description:c.description,priceCp:c.priceCp,owned:c.owned,canAfford:c.canAfford,maxAffordable:c.maxAffordable};
  }
  function subOfItem(it){return it.type==='weapon'?'weapons':it.type==='armor'?'armour':'gear'}
  function ids(kind,sub){
    if(kind==='pose')return Fable.content.victoryAnimations.list().map(function(v){return v.id});
    return state.stock.filter(function(id){return subOfItem(itemDef(id))===sub});
  }

  /* ---------- the page ---------- */
  var FEATURED=[['item','potion-of-healing',true],['pose','victory-spin',true],['item','chain-shirt'],['item','shield']];
  var SECTIONS=[
    {id:'featured',name:'Featured',note:'Hand picked for the road'},
    {id:'character',name:'Character',note:'Shape who your hero is',groups:[['Subclasses'],['Species'],['Feats']]},
    {id:'equipment',name:'Equipment',note:'Arms and armour',groups:[['Weapons','item','weapons'],['Adventuring Gear','item','gear'],['Armour','item','armour']]},
    {id:'cosmetics',name:'Cosmetics',note:'Look the part',groups:[['Skins'],['Victory Animations','pose'],['Backgrounds']]}
  ];
  function build(){root=el('div');root.id='shop';root.hidden=true;document.body.appendChild(root)}

  function tileCanvas(){var c=el('canvas','st-pv');c.width=c.height=320;c.setAttribute('aria-hidden','true');return c}
  function makeTile(kind,id,big){
    var b=el('button','st-tile'+(big?' big':''));b.type='button';b.dataset.kind=kind;b.dataset.id=id;b.dataset.k='tile-'+id;
    var it=kind==='item'?itemDef(id):null;
    if(it&&it.magic)b.classList.add('magic');
    var ic=el('span','st-ic');ic.innerHTML=Fable.hudIcons?Fable.hudIcons.svg(kind==='pose'?'star':iconFor(it)):'';b.appendChild(ic);
    var cv=tileCanvas();b.appendChild(cv);
    b.appendChild(el('em','st-own'));
    if(big)b.appendChild(el('span','st-ribbon','Featured'));
    var bar=el('span','st-bar');bar.appendChild(el('b','st-nm'));bar.appendChild(el('span','st-tag'));b.appendChild(bar);
    var t={el:b,kind:kind,id:id,cv:cv,angle:kind==='pose'?.3:.62,drawn:false};
    tiles.push(t);
    b.addEventListener('click',function(){if(dragged)return;openDetail(kind,id,b)});
    b.addEventListener('pointerenter',function(e){if(e.pointerType==='mouse')spinOn(t)});
    b.addEventListener('pointerleave',function(){spinOff(t)});
    b.addEventListener('focus',function(){spinOn(t)});
    b.addEventListener('blur',function(){spinOff(t)});
    return t;
  }
  function updateTile(t){
    var r=rowFor(t.kind,t.id);if(!r)return;
    var b=t.el;
    b.querySelector('.st-nm').textContent=r.name;
    var own=b.querySelector('.st-own'),tag=b.querySelector('.st-tag');
    tag.textContent='';tag.classList.remove('poor','done');
    if(r.kind==='item'){
      own.textContent=r.owned?'x'+r.owned:'';own.hidden=!r.owned;own.title=r.owned?'You own '+r.owned:'';
      tag.appendChild(price(r.priceCp));if(!r.canAfford)tag.classList.add('poor');
      b.setAttribute('aria-label',r.name+', '+gp(r.priceCp)+(r.owned?', you own '+r.owned:''));
    }else{
      own.textContent=r.selected?'In use':r.owned?'Owned':'';own.hidden=!r.owned;
      if(r.owned){tag.textContent=r.selected?'Selected':'Use';tag.classList.add('done')}
      else{tag.appendChild(price(r.costCp));if(!r.canAfford)tag.classList.add('poor')}
      b.setAttribute('aria-label',r.name+', victory animation, '+(r.owned?(r.selected?'in use':'owned'):gp(r.costCp)));
    }
  }
  function soonTile(label){
    var d=el('div','st-tile soon');d.setAttribute('aria-label',label+', coming soon');
    d.appendChild(el('span','st-lock','?'));d.appendChild(el('b',null,'Coming soon'));return d;
  }

  function skeleton(def){
    root.textContent='';tiles=[];
    root.appendChild(el('div','st-bg'));
    var page=el('div','st');page.setAttribute('role','dialog');page.setAttribute('aria-modal','true');page.setAttribute('aria-label',def.name);root.appendChild(page);
    var top=el('header','st-top');
    var back=el('button','st-back');back.type='button';back.setAttribute('aria-label','Leave the store');back.innerHTML='<svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>';back.onclick=close;
    var ttl=el('div','st-ttl');ttl.appendChild(el('small',null,'Welcome to'));ttl.appendChild(el('h2',null,def.name));
    var purse=el('div','st-purse');purse.appendChild(el('span','coin'));purse.appendChild(el('b'));
    top.appendChild(back);top.appendChild(ttl);
    var tabs=el('div','st-tabs');tabs.setAttribute('role','tablist');
    SECTIONS.forEach(function(sc){
      var tb=el('button','st-tab',sc.name);tb.type='button';tb.setAttribute('role','tab');tb.dataset.k='sec-'+sc.id;tb.dataset.sec=sc.id;
      tb.onclick=function(){jumpTo(sc.id)};tabs.appendChild(tb);
    });
    top.appendChild(tabs);top.appendChild(purse);page.appendChild(top);
    var prog=el('div','st-prog');prog.appendChild(el('i'));page.appendChild(prog);
    var wrap=el('div','st-wrap'),track=el('div','st-track');track.tabIndex=-1;
    var prev=el('button','st-nav prev');prev.type='button';prev.setAttribute('aria-label','Slide back');prev.innerHTML='<svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>';
    var next=el('button','st-nav next');next.type='button';next.setAttribute('aria-label','Slide forward');next.innerHTML='<svg viewBox="0 0 24 24"><path d="M9 4l8 8-8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>';
    prev.onclick=function(){slide(-1)};next.onclick=function(){slide(1)};
    SECTIONS.forEach(function(sc){
      var sec=el('section','st-sec'),head=el('div','st-sech');sec.dataset.sec=sc.id;
      head.appendChild(el('h3',null,sc.name));head.appendChild(el('span',null,sc.note));sec.appendChild(head);
      var groups=el('div','st-groups');
      if(sc.id==='featured'){
        var g=el('div','st-group feat'),grid=el('div','st-tiles');
        FEATURED.forEach(function(f){if(rowFor(f[0],f[1]))grid.appendChild(makeTile(f[0],f[1],!!f[2]).el)});
        g.appendChild(grid);groups.appendChild(g);
      }else sc.groups.forEach(function(gd){
        var g=el('div','st-group'),grid=el('div','st-tiles');g.appendChild(el('h4',null,gd[0]));
        var list=gd[1]?ids(gd[1],gd[2]):[];
        list.forEach(function(id){grid.appendChild(makeTile(gd[1],id).el)});
        if(!list.length)grid.appendChild(soonTile(gd[0]));
        g.appendChild(grid);groups.appendChild(g);
      });
      sec.appendChild(groups);track.appendChild(sec);
    });
    var tail=el('div','st-tail');track.appendChild(tail);
    wrap.appendChild(prev);wrap.appendChild(track);wrap.appendChild(next);page.appendChild(wrap);
    var keys=el('div','st-keys');keys.innerHTML='<span><kbd>&larr;</kbd><kbd>&rarr;</kbd> Browse</span><span><kbd>Enter</kbd> Look</span><span><kbd>Tab</kbd> Move</span><span><kbd>Esc</kbd> Leave</span>';
    page.appendChild(keys);
    var live=el('div','sr-only');live.id='store-live';live.setAttribute('role','status');live.setAttribute('aria-live','polite');page.appendChild(live);
    els={page:page,track:track,tabs:tabs,prog:prog.firstChild,purse:purse.querySelector('b'),purseBox:purse,prev:prev,next:next,keys:keys};
    track.addEventListener('scroll',onScroll,{passive:true});
    track.addEventListener('wheel',onWheel,{passive:false});
    track.addEventListener('pointerdown',onDown);
  }

  /* ---------- sliding along the page ---------- */
  var scrollT=0,dragged=false,drag=null;
  function calm(){return Fable.hudSettings&&Fable.hudSettings.reducedMotion&&Fable.hudSettings.reducedMotion()}
  function secEl(id){return els.track.querySelector('.st-sec[data-sec="'+id+'"]')}
  function jumpTo(id){
    var s=secEl(id);if(!s)return;
    var left=s.offsetLeft-parseFloat(getComputedStyle(els.track).paddingLeft||0);
    els.track.scrollTo({left:left,behavior:calm()?'auto':'smooth'});
    setActive(id);
  }
  function slide(dir){
    var step=Math.max(240,els.track.clientWidth*.7);
    els.track.scrollBy({left:dir*step,behavior:calm()?'auto':'smooth'});
  }
  function setActive(id){
    Array.prototype.forEach.call(els.tabs.children,function(tb){tb.setAttribute('aria-selected',tb.dataset.sec===id?'true':'false')});
  }
  function onScroll(){
    if(scrollT)return;
    scrollT=requestAnimationFrame(function(){
      scrollT=0;if(!els.track)return;
      var t=els.track,x=t.scrollLeft,max=t.scrollWidth-t.clientWidth,pad=parseFloat(getComputedStyle(t).paddingLeft||0);
      var act=SECTIONS[0].id;
      SECTIONS.forEach(function(sc){var s=secEl(sc.id);if(s&&s.offsetLeft-pad<=x+t.clientWidth*.3)act=sc.id});
      if(max-x<4)act=SECTIONS[SECTIONS.length-1].id;
      setActive(act);
      els.prog.style.width=(max>0?Math.round(x/max*1000)/10:100)+'%';
      els.prev.disabled=x<4;els.next.disabled=max-x<4;
    });
  }
  /* the mouse wheel slides the page sideways, and a mouse can drag it like a finger */
  function onWheel(e){
    if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){e.preventDefault();els.track.scrollLeft+=e.deltaY*(e.deltaMode===1?32:1)}
  }
  function onDown(e){
    if(e.pointerType!=='mouse'||e.button!==0)return;
    drag={x:e.clientX,left:els.track.scrollLeft,on:false};dragged=false;
    window.addEventListener('pointermove',onDragMove);window.addEventListener('pointerup',onDragEnd);
  }
  function onDragMove(e){
    if(!drag)return;var dx=e.clientX-drag.x;
    if(!drag.on&&Math.abs(dx)>6){drag.on=true;dragged=true;els.track.classList.add('drag')}
    if(drag.on)els.track.scrollLeft=drag.left-dx;
  }
  function onDragEnd(){
    window.removeEventListener('pointermove',onDragMove);window.removeEventListener('pointerup',onDragEnd);
    if(els.track)els.track.classList.remove('drag');
    drag=null;setTimeout(function(){dragged=false},0);
  }

  /* ---------- the previews in the tiles ---------- */
  var spin=null,spinRaf=0,spinLast=0;
  function drawTile(t){
    if(!pv)return false;
    var ok=pv.draw(t.cv,{kind:t.kind,id:t.id},t.angle);
    if(ok&&!t.drawn){t.drawn=true;t.el.classList.add('has3d')}
    return ok;
  }
  function paintAll(){
    var i=0;
    function next(){
      if(!pv||!root||root.hidden)return;
      if(i<tiles.length){drawTile(tiles[i++]);paintT=setTimeout(next,0)}
    }
    if(manual){while(i<tiles.length)drawTile(tiles[i++])}else next();
  }
  function spinOn(t){
    if(!pv||calm()||!t.drawn)return;
    spin=t;spinLast=0;
    if(!spinRaf)spinRaf=requestAnimationFrame(spinStep);
  }
  function spinOff(t){
    if(spin===t){spin=null}
    t.angle=t.kind==='pose'?.3:.62;
    if(pv&&t.drawn)drawTile(t);
  }
  function spinStep(ts){
    spinRaf=0;
    if(!spin||!pv)return;
    var dt=spinLast?Math.min(.05,(ts-spinLast)/1000):0;spinLast=ts;
    spin.angle+=dt*1.9;drawTile(spin);
    spinRaf=requestAnimationFrame(spinStep);
  }

  /* ---------- the big preview of one thing ---------- */
  function openDetail(kind,id,from){
    closeDetail(true);
    var r=rowFor(kind,id);if(!r)return;
    state.sel={kind:kind,id:id,from:from};
    spin=null;
    var m=el('div','st-modal'),panel=el('div','st-md');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',r.name);
    m.addEventListener('mousedown',function(e){if(e.target===m)closeDetail()});
    var view=el('div','st-view'),cv=el('canvas','st-vcv');cv.setAttribute('aria-hidden','true');view.appendChild(cv);
    var x=el('button','st-mx');x.type='button';x.dataset.k='close';x.setAttribute('aria-label','Close the preview');x.appendChild(el('span',null,'Close'));x.appendChild(el('kbd',null,'Esc'));x.onclick=function(){closeDetail()};
    view.appendChild(x);
    var info=el('div','st-info');
    panel.appendChild(view);panel.appendChild(info);m.appendChild(panel);root.appendChild(m);
    els.modal=m;els.info=info;
    root.querySelector('.st').setAttribute('aria-hidden','true');
    try{stage=Fable.createStoreStage(cv,{heroId:state.hero,manual:manual})}
    catch(e){stage=null;m.classList.add('flat')}
    if(stage){if(kind==='pose')stage.setPose(id);else stage.setItem(id);stage.start()}
    drawInfo();
    var c=info.querySelector('.st-cta');if(c&&!c.disabled)c.focus({preventScroll:true});else x.focus({preventScroll:true});
  }
  function closeDetail(quiet){
    if(!els.modal)return;
    var from=state.sel&&state.sel.from;
    if(stage){stage.dispose();stage=null}
    els.modal.remove();els.modal=null;els.info=null;state.sel=null;
    var pg=root.querySelector('.st');if(pg)pg.removeAttribute('aria-hidden');
    if(!quiet&&from&&document.contains(from))try{from.focus({preventScroll:true})}catch(e){}
  }
  function drawInfo(){
    if(!els.info||!state.sel)return;
    var s=state.sel,r=rowFor(s.kind,s.id),d=els.info,had=d.contains(document.activeElement);d.textContent='';
    if(!r){closeDetail();return}
    var it=r.kind==='item'?itemDef(r.id):null;
    d.appendChild(el('small',null,r.kind==='pose'?'Victory animation':kindLine(it)));
    d.appendChild(el('h3',null,r.name));
    d.appendChild(el('p','st-ds',r.description||''));
    if(it){
      var st=statsOf(it);
      if(st.length){var dl=el('dl','st-stats');st.forEach(function(x){dl.appendChild(el('dt',null,x[0]));dl.appendChild(el('dd',null,x[1]))});d.appendChild(dl)}
    }
    var own=el('p','st-ownline');
    if(r.kind==='item')own.textContent=r.owned?'You own '+r.owned+(equipped(r.id)?' ('+equipped(r.id)+' equipped)':''):'You do not own this yet';
    else own.textContent=r.selected?'In use after every won fight':r.owned?'You own this':'You do not own this yet';
    if(r.owned&&r.kind==='item')own.classList.add('has');
    d.appendChild(own);
    var foot=el('div','st-foot'),btn=el('button','st-cta');btn.type='button';btn.dataset.k='cta';
    var reason='';
    if(r.kind==='pose'){
      if(r.owned){
        btn.textContent=r.selected?'In use':'Use this animation';btn.disabled=r.selected;
        btn.onclick=function(){var res=Ro().setVictory(state.hero,r.id);if(res.ok)say(r.name+' selected');else say(res.reasons&&res.reasons[0]||'That did not work')};
      }else{
        var tot=el('div','st-total');tot.appendChild(el('span',null,'Cost'));tot.appendChild(price(r.costCp));foot.appendChild(tot);
        btn.textContent='Buy';btn.disabled=!r.canAfford;
        if(!r.canAfford)reason='You need '+gp(r.costCp-Ro().purseCp(state.hero))+' more';
        btn.onclick=function(){var res=Ro().buyVictory(state.hero,r.id);if(res.ok){say('Bought '+r.name+' for '+gp(r.costCp));if(stage)stage.celebrate('buy')}else say(res.reasons&&res.reasons[0]||'That did not work')};
      }
    }else{
      var max=r.maxAffordable,key=r.id,qty=1;
      if(max>1){var sp=stepper(key,max,drawInfo);var q=el('div','st-qty');q.appendChild(el('span',null,'Quantity'));q.appendChild(sp.box);foot.appendChild(q);qty=sp.q}
      var total=el('div','st-total');total.appendChild(el('span',null,'Cost'));total.appendChild(price(r.priceCp*qty));foot.appendChild(total);
      btn.textContent='Buy'+(qty>1?' '+qty:'');btn.disabled=!r.canAfford;
      if(!r.canAfford)reason='You need '+gp(r.priceCp-Ro().purseCp(state.hero))+' more';
      btn.setAttribute('aria-label','Buy '+qty+' '+r.name);
      btn.onclick=function(){
        var res=Ro().purchase(state.hero,state.shop,r.id,qty);
        if(res.ok){say('Bought '+qty+' '+r.name+' for '+gp(res.paidCp));state.qty[key]=1;if(stage)stage.celebrate('buy')}
        else say(res.reasons&&res.reasons[0]||'That did not work');
      };
    }
    foot.appendChild(btn);
    if(reason)foot.appendChild(el('p','st-why',reason));
    d.appendChild(foot);
    /* the buttons are made anew each time, so keep the keyboard where it was */
    if(had){var fb=btn.disabled?els.modal.querySelector('[data-k=close]'):btn;if(fb)try{fb.focus({preventScroll:true})}catch(e){}}
  }
  function stepper(key,max,rerender){
    var q=Math.max(1,Math.min(state.qty[key]||1,Math.max(1,max)));state.qty[key]=q;
    var box=el('span','st-step'),minus=el('button',null,'-'),out=el('output',null,String(q)),plus=el('button',null,'+');
    minus.type=plus.type='button';minus.setAttribute('aria-label','Fewer');plus.setAttribute('aria-label','More');
    minus.disabled=q<=1;plus.disabled=q>=max;
    minus.onclick=function(){state.qty[key]=q-1;rerender()};plus.onclick=function(){state.qty[key]=q+1;rerender()};
    box.appendChild(minus);box.appendChild(out);box.appendChild(plus);
    return {box:box,q:q};
  }

  /* everything on the page that shows gold or what is owned, redrawn after the roster changed */
  function refresh(){
    if(!root||root.hidden||!els.track)return;
    readData();
    var gold=gp(Ro().purseCp(state.hero));els.purse.textContent=gold;els.purseBox.setAttribute('aria-label','Purse '+gold);
    tiles.forEach(updateTile);
    drawInfo();
    onScroll();
  }

  /* ---------- keys ---------- */
  function focusables(scope){return [].slice.call(scope.querySelectorAll('button:not(:disabled),[tabindex="0"]')).filter(function(n){return n.offsetParent!==null})}
  function onKey(e){
    if(!root||root.hidden)return;
    if(e.code==='Escape'){e.preventDefault();e.stopPropagation();if(els.modal)closeDetail();else close();return}
    if(els.modal){
      if(e.code==='Enter'||e.code==='NumpadEnter'){
        var ae=document.activeElement;
        if(ae&&ae.tagName==='BUTTON')return void e.stopPropagation();
        var cta=els.info.querySelector('.st-cta');if(cta&&!cta.disabled){e.preventDefault();cta.click()}
        e.stopPropagation();return;
      }
      if(e.code==='Tab'){
        var f=focusables(els.modal);if(!f.length)return;
        var i=f.indexOf(document.activeElement);
        if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&(i<0||i===f.length-1)){e.preventDefault();f[0].focus()}
      }
      e.stopPropagation();return;
    }
    var moves={ArrowRight:2,ArrowLeft:-2,ArrowDown:1,ArrowUp:-1};
    if(moves[e.code]!==undefined){
      var tl=[].slice.call(root.querySelectorAll('.st-tile:not(.soon)')),cur=tl.indexOf(document.activeElement);
      e.preventDefault();e.stopPropagation();
      if(cur<0){if(tl[0])tl[0].focus();return}
      var n=Math.max(0,Math.min(tl.length-1,cur+moves[e.code]));tl[n].focus();
      return;
    }
    if(e.code==='Tab'){
      var f2=focusables(root.querySelector('.st'));if(!f2.length)return;
      var i2=f2.indexOf(document.activeElement);
      if(e.shiftKey&&i2<=0){e.preventDefault();f2[f2.length-1].focus()}else if(!e.shiftKey&&(i2<0||i2===f2.length-1)){e.preventDefault();f2[0].focus()}
    }
    e.stopPropagation();
  }

  function open(hero,shopId,opts){
    if(!root)build();
    opts=opts||{};
    state.hero=hero||state.hero;state.shop=shopId||state.shop;state.qty={};state.sel=null;
    state.stock=Fable.content.shops.get(state.shop).stock.map(function(r){return r.item});
    toastFn=opts.say||toastFn;manual=!!opts.manual;opener=document.activeElement;
    var def=Fable.content.shops.get(state.shop);
    readData();skeleton(def);
    root.hidden=false;root.classList.remove('in');void root.offsetWidth;root.classList.add('in');
    try{pv=Fable.createTilePreview({heroId:state.hero})}catch(e){pv=null;if(window.console)console.warn('Store: no 3D previews ('+e.message+')')}
    document.addEventListener('keydown',onKey,true);
    off=Ro().onChange(function(){refresh()});
    refresh();setActive('featured');
    paintAll();
    var first=root.querySelector('.st-tile:not(.soon)');if(first&&!manual)try{first.focus({preventScroll:true})}catch(e){}
  }
  function close(){
    if(!root||root.hidden)return;
    closeDetail(true);
    clearTimeout(paintT);if(spinRaf){cancelAnimationFrame(spinRaf);spinRaf=0}spin=null;
    if(scrollT){cancelAnimationFrame(scrollT);scrollT=0}
    onDragEnd();
    root.hidden=true;root.classList.remove('in');
    if(pv){pv.dispose();pv=null}
    root.textContent='';els={};tiles=[];document.removeEventListener('keydown',onKey,true);if(off)off();off=null;
    if(opener&&opener.focus&&document.contains(opener))opener.focus();
  }
  return {open:open,close:close,isOpen:function(){return !!root&&!root.hidden},stage:function(){return stage},openDetail:function(k,i){openDetail(k,i)},closeDetail:function(){closeDetail()}};
})();
})();
