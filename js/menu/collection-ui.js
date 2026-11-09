/* The Collection: a full page opened from the hub's Collection tile, in the Store's wood and gold. Tabs along the top switch between everything a
   player can get: Character (species, backgrounds, classes, subclasses and feats), Victory Animations, Weapons, Armour, Magic Items and Gear.
   Every tile is one thing in the game. What a hero has found is lit; what has not been found is greyed out. A click opens its details with a big 3D
   preview (the same stage as the Store), what it does, and how to get it: whether it can be had right now, and where.

   What counts as found: an item that has ever been in a hero's pack (Fable.codex), or sits in an Equipment Pack a hero carries; a victory
   animation any hero owns; a species, background, class, subclass or feat that one of the heroes has (their sheets).

   Fable.collectionUi.open({say, from, tab, manual})   shows the page (tab: 'character' | 'victory' | 'weapons' | 'armour' | 'magic' | 'gear')
   Fable.collectionUi.close() / isOpen() / tab()       Escape closes the details first, then the page
   Fable.collectionUi.setTab(id)                       the same as clicking that tab
   Fable.collectionUi.openDetail(kind, id) / closeDetail()   the details of one thing ('item' | 'pose' | 'species' | 'background' | 'class' | 'subclass' | 'feat')
   Fable.collectionUi.summary()                        {found, total} for every tab, for tests
   Fable.collectionUi.howTo(kind, id)                  {obtainable, owned, lines:[text]}, for tests */
(function(){
Fable.collectionUi=(function(){
  var root=null,els={},state={tab:'character',sel:null},pv=null,stage=null,tiles=[],opener=null,toastFn=null,manual=false,paintT=0,offChange=null;
  var data=null;
  function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
  function say(m){if(toastFn)toastFn(m)}
  function Ro(){return Fable.character.roster}
  function C(){return Fable.content}
  function Info(){return Fable.itemInfo}
  function gp(cp){return Fable.money.format(cp)}
  function calm(){return Fable.hudSettings&&Fable.hudSettings.reducedMotion&&Fable.hudSettings.reducedMotion()}

  /* ---------- what there is ---------- */
  var KINDS={
    item:{label:'Item',icon:null},
    pose:{label:'Victory animation',icon:'star'},
    species:{label:'Species',icon:'heart'},
    background:{label:'Background',icon:'scroll'},
    'class':{label:'Class',icon:'sword'},
    subclass:{label:'Subclass',icon:'surge'},
    feat:{label:'Feat',icon:'mind'}
  };
  var TABS=[
    {id:'character',name:'Character',note:'Who your hero can be',groups:[['Species','species'],['Backgrounds','background'],['Classes','class'],['Subclasses','subclass'],['Feats','feat']]},
    {id:'victory',name:'Victory Animations',note:'How your hero celebrates',groups:[['Victory Animations','pose']]},
    {id:'weapons',name:'Weapons',note:'Steel for every hand',groups:[['Simple Weapons','item','weapon:simple'],['Martial Weapons','item','weapon:martial']]},
    {id:'armour',name:'Armour',note:'Worn and carried',groups:[['Armour','item','armor:armor'],['Shields','item','armor:shield']]},
    {id:'magic',name:'Magic Items',note:'Things that hum',groups:[['Magic Items','item','magic']]},
    {id:'gear',name:'Gear',note:'Everything for the road',groups:[['Adventuring Gear','item','gear'],['Equipment Packs','item','pack'],['Tools','item','tool']]}
  ];
  function itemsOf(rule){
    return C().items.list().filter(function(it){
      if(rule==='magic')return !!it.magic;
      if(it.magic)return false;
      var p=rule.split(':');
      if(p[0]==='weapon')return it.type==='weapon'&&it.category===p[1];
      if(p[0]==='armor')return it.type==='armor'&&((p[1]==='shield')===(it.category==='shield'));
      return it.type===rule;
    });
  }
  function reg(kind){
    return kind==='species'?C().species:kind==='background'?C().backgrounds:kind==='class'?C().classes:kind==='subclass'?C().subclasses:kind==='feat'?C().feats:null;
  }
  function listOf(kind,rule){
    if(kind==='item')return itemsOf(rule).map(function(d){return d.id});
    if(kind==='pose')return C().victoryAnimations.list().map(function(d){return d.id});
    var r=reg(kind);return r?r.list().map(function(d){return d.id}):[];
  }
  function defOf(kind,id){
    if(kind==='item')return C().items.get(id);
    if(kind==='pose')return C().victoryAnimations.get(id);
    var r=reg(kind);return r?r.get(id):null;
  }

  /* ---------- who has what ---------- */
  function readData(){
    var R=Ro(),heroes=R.characters(),d={heroes:heroes,names:{},held:{},found:{},options:{species:{},background:{},'class':{},subclass:{},feat:{}},poses:{}};
    heroes.forEach(function(hid){
      var b=R.build(hid),sh=null;
      d.names[hid]=(b&&b.name)||hid;
      ((b&&b.inventory)||[]).forEach(function(e){if(e&&e.qty>0)d.held[e.item]=(d.held[e.item]||0)+e.qty});
      try{sh=R.sheet(hid)}catch(e){sh=null}
      if(sh&&sh.identity){
        function own(kind,id,how){if(!id)return;(d.options[kind][id]=d.options[kind][id]||[]).push({hero:d.names[hid],how:how||''})}
        own('species',sh.identity.species&&sh.identity.species.id);
        own('background',sh.identity.background&&sh.identity.background.id);
        (sh.identity.classes||[]).forEach(function(c){own('class',c.id);if(c.subclass)own('subclass',c.subclass.id)});
        (sh.feats||[]).forEach(function(f){own('feat',f.id,f.source&&f.source.name?(f.source.type==='background'?f.source.name+' background':f.source.name):'')});
      }
      R.victoriesOwned(hid).forEach(function(v){(d.poses[v]=d.poses[v]||[]).push(d.names[hid])});
    });
    /* an Equipment Pack a hero carries holds what is inside it */
    Object.keys(d.held).forEach(function(id){
      var it=C().items.get(id);
      if(it&&it.type==='pack')(it.contents||[]).forEach(function(c){d.found[c.item]=d.found[c.item]||'pack:'+id});
    });
    data=d;return d;
  }
  function isFound(id){return !!(Fable.codex&&Fable.codex.hasFound(id))||!!data.held[id]||!!data.found[id]}
  function owned(kind,id){
    if(kind==='item')return isFound(id);
    if(kind==='pose')return !!data.poses[id];
    return !!(data.options[kind]&&data.options[kind][id]);
  }

  /* ---------- how to get it ---------- */
  function shopRows(id){
    var out=[];
    C().shops.list().forEach(function(s){
      (s.stock||[]).forEach(function(r){if(r.item===id)out.push({shop:s,price:r.price||(C().items.get(id)||{}).cost})});
    });
    return out;
  }
  function premadeWith(test){
    return data.heroes.filter(function(hid){return test(Ro().build(hid),hid)}).map(function(hid){return data.names[hid]});
  }
  function howTo(kind,id){
    if(!data)readData();
    var has=owned(kind,id),lines=[],can=false,store=false,def=defOf(kind,id);
    if(!def)return {obtainable:false,owned:false,lines:['Unknown.'],store:false};
    if(kind==='item'){
      shopRows(id).forEach(function(r){
        can=true;store=true;
        lines.push('Sold in '+r.shop.name+' for '+(r.price?gp(Fable.money.toCp(r.price)):'its listed price')+'.');
      });
      var kit=premadeWith(function(b){return (b.inventory||[]).some(function(e){return e.item===id})});
      if(kit.length){can=can||false;lines.push('Part of '+kit.join(' and ')+'\'s kit.')}
      C().encounters.list().forEach(function(en){
        var its=(en.rewards&&en.rewards.items)||[];
        if(its.some(function(e){return e.item===id})){can=true;lines.push('A reward for '+en.name+'.')}
      });
      var inPack=C().items.list().filter(function(p){return p.type==='pack'&&(p.contents||[]).some(function(c){return c.item===id})});
      if(inPack.length){
        var names=inPack.slice(0,3).map(function(p){return p.name});
        lines.push('Comes inside '+names.join(', ')+(inPack.length>3?' and '+(inPack.length-3)+' more':'')+'.');
      }
      if(!can&&!lines.length)lines.push('No shop sells it and no fight rewards it yet.');
      else if(!can&&has)lines.push('You have it now, but there is no way to get another yet.');
      else if(!can)lines.push('There is no way to get it on its own yet.');
    }else if(kind==='pose'){
      if(!def.cost){can=true;lines.push('Every hero knows this one from the start.')}
      else{
        var vs=C().shops.list().filter(function(s){return s.victories});
        if(vs.length){can=true;store=true;lines.push('Sold in '+vs[0].name+' (Cosmetics) for '+gp(Fable.money.toCp(def.cost))+'.')}
        else lines.push('No shop sells it yet.');
      }
    }else if(kind==='feat'){
      var who=data.options.feat[id]||[];
      who.forEach(function(w){lines.push(w.hero+' has it'+(w.how?' through '+w.how:'')+'.')});
      var cat=def.category;
      lines.push(cat==='origin'?'An Origin feat: a background can grant it, and a Human can choose one with Versatile.':
        cat==='fighting-style'?'A Fighting Style: a Fighter chooses one at level 1.':'Chosen when a hero gains a feat.');
      lines.push('Heroes cannot be built from scratch yet, so only the ready made ones carry feats.');
    }else{
      var holders=data.options[kind][id]||[];
      holders.forEach(function(w){lines.push(w.hero+' is a ready made hero with it.')});
      if(!holders.length)lines.push('No ready made hero has it.');
      lines.push('Creating your own hero is coming soon.');
    }
    return {obtainable:can,owned:has,lines:lines,store:store};
  }

  /* ---------- the page ---------- */
  function build(){root=el('div');root.id='collection';root.hidden=true;document.body.appendChild(root)}
  function tabById(id){return TABS.filter(function(t){return t.id===id})[0]||TABS[0]}
  function groupsOf(tab){
    return tab.groups.map(function(g){return {name:g[0],kind:g[1],rule:g[2],ids:listOf(g[1],g[2])}});
  }
  function counts(tab){
    var f=0,t=0;
    groupsOf(tab).forEach(function(g){g.ids.forEach(function(id){t++;if(owned(g.kind,id))f++})});
    return {found:f,total:t};
  }
  function summary(){
    if(!data)readData();
    var o={};TABS.forEach(function(t){o[t.id]=counts(t)});return o;
  }

  function skeleton(){
    root.textContent='';tiles=[];
    root.appendChild(el('div','st-bg'));
    var page=el('div','st-page');page.setAttribute('role','dialog');page.setAttribute('aria-modal','true');page.setAttribute('aria-label','Collection');root.appendChild(page);
    var top=el('header','st-top');
    var back=el('button','st-back');back.type='button';back.setAttribute('aria-label','Back to the main menu');
    back.innerHTML='<svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>';back.onclick=close;
    var ttl=el('div','st-ttl');ttl.appendChild(el('small',null,'Everything to find'));ttl.appendChild(el('h2',null,'Collection'));
    var tabs=el('div','st-tabs cl-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Kinds of collectable');
    TABS.forEach(function(t){
      var b=el('button','st-tab');b.type='button';b.setAttribute('role','tab');b.id='cl-tab-'+t.id;b.dataset.tab=t.id;b.setAttribute('aria-controls','cl-panel');
      b.appendChild(el('span','cl-tn',t.name));b.appendChild(el('em','cl-tc'));
      b.onclick=function(){setTab(t.id)};tabs.appendChild(b);
    });
    tabs.addEventListener('keydown',onTabKey);
    var tot=el('div','st-purse cl-total');tot.appendChild(el('small',null,'Found'));tot.appendChild(el('b'));
    top.appendChild(back);top.appendChild(ttl);top.appendChild(tabs);top.appendChild(tot);page.appendChild(top);
    var head=el('div','cl-head');head.appendChild(el('h3'));head.appendChild(el('span'));
    var body=el('main','cl-body');body.id='cl-panel';body.setAttribute('role','tabpanel');body.tabIndex=-1;
    page.appendChild(head);page.appendChild(body);
    var keys=el('div','st-keys');keys.innerHTML='<span><kbd>&larr;</kbd><kbd>&rarr;</kbd><kbd>&uarr;</kbd><kbd>&darr;</kbd> Browse</span><span><kbd>Enter</kbd> Look</span><span><kbd>Tab</kbd> Move</span><span><kbd>Esc</kbd> Back</span>';
    page.appendChild(keys);
    els={page:page,back:back,tabs:tabs,total:tot.querySelector('b'),totalBox:tot,head:head,body:body};
  }

  /* ---------- a tab's tiles ---------- */
  function makeTile(kind,id){
    var def=defOf(kind,id),has=owned(kind,id),b=el('button','cl-tile'+(has?' got':' missing'));
    b.type='button';b.dataset.kind=kind;b.dataset.id=id;
    if(kind==='item'&&def.magic)b.classList.add('magic');
    var how=howTo(kind,id);
    b.setAttribute('aria-label',def.name+', '+KINDS[kind].label.toLowerCase()+', '+(has?'found':'not found yet')+(has?'':(how.obtainable?', can be obtained now':', not obtainable yet')));
    var pic=el('span','cl-pic'),ic=el('span','cl-ic');
    var glyph=kind==='item'?Info().iconFor(def):KINDS[kind].icon;
    ic.innerHTML=Fable.hudIcons?Fable.hudIcons.svg(glyph):'';pic.appendChild(ic);
    var cv=null;
    if(kind==='item'||kind==='pose'){cv=el('canvas','cl-pv');cv.width=cv.height=192;cv.setAttribute('aria-hidden','true');pic.appendChild(cv)}
    b.appendChild(pic);
    var bar=el('span','cl-bar');bar.appendChild(el('b','cl-nm',def.name));
    var tag=el('span','cl-tag'+(has?' done':''));
    if(has){
      var n=kind==='item'?data.held[id]:0;
      tag.textContent=n>1?'Owned x'+n:'Found';
    }else{
      tag.textContent=how.store?'In the Store':how.obtainable?'Obtainable':'Locked';
      if(how.obtainable)tag.classList.add('avail');
    }
    bar.appendChild(tag);b.appendChild(bar);
    if(!has){var lk=el('i','cl-lock');lk.setAttribute('aria-hidden','true');b.appendChild(lk)}
    b.addEventListener('click',function(){openDetail(kind,id,b)});
    if(cv)tiles.push({el:b,cv:cv,kind:kind,id:id,drawn:false});
    return b;
  }
  function soon(label){
    var d=el('div','cl-tile soon');d.setAttribute('aria-label',label+', coming soon');
    d.appendChild(el('span','cl-q','?'));d.appendChild(el('b',null,'Coming soon'));return d;
  }
  function drawTab(){
    var tab=tabById(state.tab),body=els.body;
    clearTimeout(paintT);tiles=[];body.textContent='';body.scrollTop=0;
    els.head.firstChild.textContent=tab.name;els.head.lastChild.textContent=tab.note;
    groupsOf(tab).forEach(function(g){
      /* a short group sits beside the others; a long one takes the whole width */
      var sec=el('section','cl-group '+(g.ids.length<=4?'cl-small':'cl-wide'));sec.setAttribute('aria-label',g.name);sec.style.setProperty('--n',String(Math.max(1,g.ids.length)));
      var h=el('h4',null,g.name);var c=0;g.ids.forEach(function(id){if(owned(g.kind,id))c++});
      if(g.ids.length)h.appendChild(el('span',null,c+' / '+g.ids.length));
      sec.appendChild(h);
      var grid=el('div','cl-grid');
      g.ids.forEach(function(id){grid.appendChild(makeTile(g.kind,id))});
      if(!g.ids.length)grid.appendChild(soon(g.name));
      sec.appendChild(grid);body.appendChild(sec);
    });
    paintTiles();
  }
  function drawCounts(){
    var all=0,got=0;
    TABS.forEach(function(t){
      var c=counts(t);all+=c.total;got+=c.found;
      var b=els.tabs.querySelector('[data-tab="'+t.id+'"]');
      b.querySelector('.cl-tc').textContent=c.found+'/'+c.total;
      b.setAttribute('aria-selected',t.id===state.tab?'true':'false');b.tabIndex=t.id===state.tab?0:-1;
      b.setAttribute('aria-label',t.name+', '+c.found+' of '+c.total+' found');
    });
    els.total.textContent=got+' / '+all;
    els.totalBox.setAttribute('aria-label',got+' of '+all+' found');
    els.body.setAttribute('aria-labelledby','cl-tab-'+state.tab);
  }
  function setTab(id){
    if(!root||root.hidden)return;
    if(!TABS.some(function(t){return t.id===id}))return;
    if(els.modal)closeDetail(true);
    state.tab=id;drawCounts();drawTab();
  }
  function onTabKey(e){
    var i=TABS.map(function(t){return t.id}).indexOf(state.tab),n=-1;
    if(e.key==='ArrowRight')n=(i+1)%TABS.length;else if(e.key==='ArrowLeft')n=(i+TABS.length-1)%TABS.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=TABS.length-1;else return;
    e.preventDefault();e.stopPropagation();setTab(TABS[n].id);
    var t=els.tabs.querySelector('[data-tab="'+TABS[n].id+'"]');if(t)t.focus();
  }

  /* ---------- the little 3D pictures in the tiles, drawn a few at a time so opening a long tab never stalls ---------- */
  function paintTiles(){
    if(!pv)return;
    var i=0,mine=tiles;
    function next(){
      if(!pv||!root||root.hidden||mine!==tiles)return;
      var n=0;
      while(i<mine.length&&n<(manual?1e9:4)){
        var t=mine[i++];n++;
        var ok=false;try{ok=pv.draw(t.cv,{kind:t.kind,id:t.id},t.kind==='pose'?.3:.62)}catch(e){ok=false}
        if(ok){t.drawn=true;t.el.classList.add('has3d')}
      }
      if(i<mine.length)paintT=setTimeout(next,0);
    }
    next();
  }

  /* ---------- the details of one thing ---------- */
  function openDetail(kind,id,from){
    if(!root||root.hidden)return;
    var def=defOf(kind,id);if(!def)return;
    closeDetail(true);
    state.sel={kind:kind,id:id,from:from||null};
    var has=owned(kind,id),how=howTo(kind,id);
    var m=el('div','st-modal cl-modal'+(has?'':' locked')),panel=el('div','st-md');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',def.name);
    m.addEventListener('mousedown',function(e){if(e.target===m)closeDetail()});
    var view=el('div','st-view'),cv=null;
    if(kind==='item'||kind==='pose'){cv=el('canvas','st-vcv');cv.setAttribute('aria-hidden','true');view.appendChild(cv)}
    else{
      var big=el('div','cl-big');big.innerHTML=Fable.hudIcons?Fable.hudIcons.svg(KINDS[kind].icon):'';view.appendChild(big);
    }
    if(!has)view.appendChild(el('span','cl-shade','Not found yet'));
    var x=el('button','st-mx');x.type='button';x.dataset.k='close';x.setAttribute('aria-label','Close the details');x.appendChild(el('span',null,'Close'));x.appendChild(el('kbd',null,'Esc'));x.onclick=function(){closeDetail()};
    view.appendChild(x);
    var info=el('div','st-info');
    info.appendChild(el('small',null,kind==='item'?Info().kindLine(def):KINDS[kind].label+(kind==='feat'&&def.category?', '+Info().titleCase(def.category):'')));
    info.appendChild(el('h3',null,def.name));
    var desc=def.description||'';
    info.appendChild(el('p','st-ds cl-ds',desc));
    if(kind==='item'){
      var st=Info().statsOf(def);
      if(st.length){var dl=el('dl','st-stats');st.forEach(function(r){dl.appendChild(el('dt',null,r[0]));dl.appendChild(el('dd',null,r[1]))});info.appendChild(dl)}
    }
    var status=el('p','st-ownline'+(has?' has':''));
    status.textContent=has?(kind==='item'&&data.held[id]?'You have '+data.held[id]:kind==='item'&&data.found[id]?'You have it in your pack':'You have this'):'You have not found this yet';
    info.appendChild(status);
    var hw=el('section','cl-how'),hh=el('h4',null,'How to get it');
    hh.appendChild(has&&!how.obtainable?el('em','got','Yours'):el('em',how.obtainable?'yes':'no',how.obtainable?'Available now':'Not available yet'));
    hw.appendChild(hh);
    var ul=el('ul');how.lines.forEach(function(l){ul.appendChild(el('li',null,l))});hw.appendChild(ul);info.appendChild(hw);
    if(how.store&&!has&&Fable.shopUi){
      var foot=el('div','st-foot'),btn=el('button','st-cta','Visit the Store');btn.type='button';btn.dataset.k='cta';
      btn.onclick=function(){
        var hero=Fable.activeHero?Fable.activeHero():'human-fighter';
        close();Fable.shopUi.open(hero,'armory',{say:toastFn});
      };
      foot.appendChild(btn);info.appendChild(foot);
    }
    panel.appendChild(view);panel.appendChild(info);m.appendChild(panel);root.appendChild(m);
    els.modal=m;els.info=info;
    els.page.setAttribute('aria-hidden','true');
    if(cv){
      try{
        stage=Fable.createStoreStage(cv,{heroId:Fable.activeHero?Fable.activeHero():'human-fighter',manual:manual});
        if(kind==='pose')stage.setPose(id);else stage.setItem(id);
        stage.start();
      }catch(e){stage=null;m.classList.add('flat')}
    }
    var c=info.querySelector('.st-cta');(c||x).focus({preventScroll:true});
  }
  function closeDetail(quiet){
    if(!els.modal)return;
    var from=state.sel&&state.sel.from;
    if(stage){stage.dispose();stage=null}
    els.modal.remove();els.modal=null;els.info=null;state.sel=null;
    if(els.page)els.page.removeAttribute('aria-hidden');
    if(!quiet&&from&&document.contains(from))try{from.focus({preventScroll:true})}catch(e){}
  }

  /* ---------- keys ---------- */
  function focusables(scope){return [].slice.call(scope.querySelectorAll('button:not(:disabled):not([tabindex="-1"]),[tabindex="0"]')).filter(function(n){return n.offsetParent!==null})}
  function onKey(e){
    if(!root||root.hidden)return;
    if(e.code==='Escape'){e.preventDefault();e.stopPropagation();if(els.modal)closeDetail();else close();return}
    if(els.modal){
      if(e.code==='Tab'){
        var f=focusables(els.modal);if(!f.length)return;
        var i=f.indexOf(document.activeElement);
        if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&(i<0||i===f.length-1)){e.preventDefault();f[0].focus()}
      }
      e.stopPropagation();return;
    }
    var ae=document.activeElement;
    if(ae&&ae.classList&&ae.classList.contains('cl-tile')&&{ArrowRight:1,ArrowLeft:1,ArrowDown:1,ArrowUp:1}[e.code]){
      var all=[].slice.call(els.body.querySelectorAll('.cl-tile:not(.soon)')),cur=all.indexOf(ae);
      if(cur>=0){
        e.preventDefault();e.stopPropagation();
        var n=cur;
        if(e.code==='ArrowRight')n=cur+1;else if(e.code==='ArrowLeft')n=cur-1;
        else{
          /* up and down stay in the column: the nearest tile above or below whose left edge lines up */
          var dir=e.code==='ArrowDown'?1:-1,r=ae.getBoundingClientRect(),best=-1,bd=1e9;
          all.forEach(function(t,j){
            var q=t.getBoundingClientRect();
            if(dir>0?q.top>r.top+4:q.top<r.top-4){
              var dy=Math.abs(q.top-r.top),dx=Math.abs(q.left-r.left),score=dy*4+dx;
              if(score<bd){bd=score;best=j}
            }
          });
          if(best>=0)n=best;
        }
        n=Math.max(0,Math.min(all.length-1,n));
        all[n].focus();
        return;
      }
    }
    if(e.code==='Tab'){
      var f2=focusables(els.page);if(!f2.length)return;
      var i2=f2.indexOf(document.activeElement);
      if(e.shiftKey&&i2<=0){e.preventDefault();f2[f2.length-1].focus()}else if(!e.shiftKey&&(i2<0||i2===f2.length-1)){e.preventDefault();f2[0].focus()}
    }
  }

  /* ---------- open and close ---------- */
  function hubDim(on){var m=document.getElementById('menu-layer');if(m)m.classList.toggle('collection-open',!!on)}
  function refresh(){
    if(!root||root.hidden||!els.body)return;
    readData();drawCounts();
    var sel=state.sel,top=els.body.scrollTop,focusId=document.activeElement&&document.activeElement.dataset?document.activeElement.dataset.id:null;
    if(!els.modal){drawTab();els.body.scrollTop=top;if(focusId){var again=els.body.querySelector('.cl-tile[data-id="'+focusId+'"]');if(again)try{again.focus({preventScroll:true})}catch(e){}}}
    else if(sel){openDetail(sel.kind,sel.id,sel.from)}
  }
  function open(o){
    o=o||{};
    if(root&&!root.hidden)return;
    if(!root)build();
    toastFn=o.say||toastFn;manual=!!o.manual;opener=o.from||document.activeElement;
    /* whatever the heroes carry now counts as found, and is remembered even after it is sold */
    try{Fable.codex.absorb(Ro())}catch(e){}
    readData();
    state.tab=TABS.some(function(t){return t.id===o.tab})?o.tab:'character';state.sel=null;
    skeleton();
    root.hidden=false;root.classList.remove('in');void root.offsetWidth;root.classList.add('in');
    hubDim(true);
    try{pv=Fable.createTilePreview({heroId:Fable.activeHero?Fable.activeHero():'human-fighter'})}catch(e){pv=null;if(window.console)console.warn('Collection: no 3D previews ('+e.message+')')}
    drawCounts();drawTab();
    offChange=Ro().onChange(function(){try{Fable.codex.absorb(Ro())}catch(e){}refresh()});
    document.addEventListener('keydown',onKey,true);
    var t=els.tabs.querySelector('.st-tab[aria-selected="true"]');if(t&&!manual)try{t.focus({preventScroll:true})}catch(e){}
  }
  function close(){
    if(!root||root.hidden)return;
    closeDetail(true);
    clearTimeout(paintT);
    root.hidden=true;root.classList.remove('in');hubDim(false);
    if(pv){pv.dispose();pv=null}
    if(offChange){offChange();offChange=null}
    root.textContent='';els={};tiles=[];data=null;
    document.removeEventListener('keydown',onKey,true);
    if(opener&&opener.focus&&document.contains(opener))try{opener.focus()}catch(e){}
  }
  return {open:open,close:close,isOpen:function(){return !!root&&!root.hidden},tab:function(){return state.tab},setTab:setTab,
    openDetail:function(k,i){openDetail(k,i)},closeDetail:function(){closeDetail()},summary:summary,howTo:howTo,stage:function(){return stage}};
})();
})();
