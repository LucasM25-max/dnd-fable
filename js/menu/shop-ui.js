/* The Armory screen (implementation plan, Phase 9): buy and sell what the shop stocks, and buy victory poses with gold.
   Everything shown comes from the shop and victory content and the roster, so a new item or pose needs no change here.
   Fable.shopUi.open(heroId, shopId) / close() / isOpen()   Escape closes it, Tab stays inside it. */
(function(){
Fable.shopUi=(function(){
  var root=null,state={hero:'human-fighter',shop:'armory',tab:'buy',qty:{}},opener=null,off=null,toastFn=null;
  var Ro=function(){return Fable.character.roster};
  function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
  function say(m){if(toastFn)toastFn(m);var l=document.getElementById('hud-live');if(l)l.textContent=m}
  function gp(cp){return Fable.money.format(cp)}
  function price(cp){var b=el('span','sh-pr');b.appendChild(el('i','coin'));b.appendChild(document.createTextNode(gp(cp)));return b}
  function build(){
    root=el('div');root.id='shop';root.hidden=true;
    root.addEventListener('mousedown',function(e){if(e.target===root)close()});
    document.body.appendChild(root);
  }
  function stepper(key,max){
    var q=Math.max(1,Math.min(state.qty[key]||1,Math.max(1,max)));state.qty[key]=q;
    var box=el('span','sh-step'),minus=el('button',null,'-'),out=el('output',null,String(q)),plus=el('button',null,'+');
    minus.type=plus.type='button';minus.setAttribute('aria-label','Fewer');plus.setAttribute('aria-label','More');
    minus.disabled=q<=1;plus.disabled=q>=max;
    minus.onclick=function(){state.qty[key]=q-1;draw(key+'-')};plus.onclick=function(){state.qty[key]=q+1;draw(key+'-')};
    box.appendChild(minus);box.appendChild(out);box.appendChild(plus);
    return {box:box,q:q};
  }
  function itemRow(c,i){
    var buy=state.tab==='buy',li=el('li','sh-row'+(buy&&i===0?' first':''));
    var nm=el('div','sh-nm',c.name);if(c.owned)nm.appendChild(el('em',null,'Owned '+c.owned));
    li.appendChild(nm);li.appendChild(el('div','sh-ds',c.description||''));
    var act=el('div','sh-act'),max=buy?c.maxAffordable:(c.canSell?c.owned-equipped(c.item):0);
    var key=state.tab+c.item,qty=1;
    if(max>1){var st=stepper(key,max);act.appendChild(st.box);qty=st.q}
    act.appendChild(price((buy?c.priceCp:c.sellCp)*qty));
    var b=el('button','sh-btn',buy?'Buy':'Sell');b.type='button';
    b.disabled=buy?!c.canAfford:!c.canSell;
    if(buy&&!c.canAfford)b.title='You cannot afford this';
    b.setAttribute('aria-label',(buy?'Buy ':'Sell ')+qty+' '+c.name);
    b.onclick=function(){
      var r=buy?Ro().purchase(state.hero,state.shop,c.item,qty):Ro().sell(state.hero,state.shop,c.item,qty);
      if(r.ok){say((buy?'Bought ':'Sold ')+qty+' '+c.name+(buy?' for ':' for ')+gp(buy?r.paidCp:r.earnedCp));state.qty[key]=1;draw(key+'-focus')}
      else say(r.reasons&&r.reasons[0]||'That did not work');
    };
    act.appendChild(b);li.appendChild(act);li.dataset.k=key;
    return li;
  }
  function equipped(item){var n=0,e=Ro().build(state.hero).equipped||{};Object.keys(e).forEach(function(k){if(e[k]===item)n++});return n}
  function poseRow(v,sel){
    var li=el('li','sh-row'),nm=el('div','sh-nm',v.name);
    if(v.owned&&sel===v.id)nm.appendChild(el('em',null,'Selected'));else if(v.owned)nm.appendChild(el('em',null,'Owned'));
    li.appendChild(nm);li.appendChild(el('div','sh-ds',v.description||''));
    var act=el('div','sh-act');
    if(!v.owned)act.appendChild(price(v.costCp));
    var b=el('button','sh-btn',v.owned?(sel===v.id?'Selected':'Use'):'Buy');b.type='button';
    b.disabled=v.owned?sel===v.id:!v.canAfford;
    b.setAttribute('aria-label',(v.owned?'Use ':'Buy ')+v.name);
    b.onclick=function(){
      var r=v.owned?Ro().setVictory(state.hero,v.id):Ro().buyVictory(state.hero,v.id);
      if(r.ok){say(v.owned?v.name+' selected':'Bought '+v.name+' for '+gp(v.costCp));draw('pose-'+v.id)}else say(r.reasons&&r.reasons[0]||'That did not work');
    };
    act.appendChild(b);li.appendChild(act);li.dataset.k='pose-'+v.id;
    return li;
  }
  function draw(focusKey){
    if(!root||root.hidden)return;
    var def=Fable.content.shops.get(state.shop),b=Ro().build(state.hero);
    root.textContent='';
    var box=el('div','sh');box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label',def.name);
    var top=el('div','sh-top');top.appendChild(el('h2',null,def.name));
    var purse=el('div','sh-purse');purse.appendChild(el('i','coin'));purse.appendChild(document.createTextNode(gp(Ro().purseCp(state.hero))));
    purse.setAttribute('aria-label','Purse '+gp(Ro().purseCp(state.hero)));
    var x=el('button','sh-x','X');x.type='button';x.setAttribute('aria-label','Close');x.onclick=close;
    var right=el('div');right.style.cssText='display:flex;gap:12px;align-items:center';right.appendChild(purse);right.appendChild(x);top.appendChild(right);box.appendChild(top);
    var tabs=el('div','sh-tabs');tabs.setAttribute('role','tablist');
    [['buy','Buy'],['sell','Sell']].concat(def.victories?[['poses','Victory poses']]:[]).forEach(function(t){
      var tb=el('button','sh-tab',t[1]);tb.type='button';tb.setAttribute('role','tab');tb.setAttribute('aria-selected',state.tab===t[0]?'true':'false');
      tb.onclick=function(){state.tab=t[0];draw('tab-'+t[0])};tb.dataset.k='tab-'+t[0];tabs.appendChild(tb);
    });
    box.appendChild(tabs);
    var list=el('ul','sh-list');
    if(state.tab==='poses'){
      var sel=Ro().victory(state.hero);
      var vs=Fable.character.shop.victories(b,Ro().victoriesOwned(state.hero));
      var free=Fable.content.victoryAnimations.filter(function(v){return !v.cost});
      free.forEach(function(v){list.appendChild(poseRow({id:v.id,name:v.name,description:v.description,costCp:0,owned:true,canAfford:true},sel))});
      vs.forEach(function(v){list.appendChild(poseRow(v,sel))});
    }else{
      var cat=Fable.character.shop.catalog(state.shop,b).map(function(c,i){return {c:c,i:i}});
      var shown=state.tab==='sell'?cat.filter(function(x){return x.c.owned>0}):cat;
      shown.forEach(function(x){list.appendChild(itemRow(x.c,x.i))});
      if(!shown.length)list.appendChild(el('li','sh-note','You have nothing this shop will buy.'));
    }
    box.appendChild(list);
    if(state.tab==='sell')box.appendChild(el('p','sh-note','The shop pays half price. Equipped items cannot be sold.'));
    root.appendChild(box);
    var f=focusKey&&root.querySelector('[data-k^="'+focusKey.replace(/-focus$/,'').replace(/-$/,'')+'"]');
    var target=f&&(f.querySelector&&f.querySelector('.sh-btn:not(:disabled)')||f)||root.querySelector('.sh-tab[aria-selected=true]');
    if(target&&target.focus)target.focus({preventScroll:true});
  }
  function onKey(e){
    if(!root||root.hidden)return;
    if(e.code==='Escape'){e.preventDefault();e.stopPropagation();close();return}
    if(e.code==='Tab'){
      var f=[].slice.call(root.querySelectorAll('button:not(:disabled)'));if(!f.length)return;
      var i=f.indexOf(document.activeElement);
      if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&(i<0||i===f.length-1)){e.preventDefault();f[0].focus()}
    }
    e.stopPropagation();
  }
  function open(hero,shopId,opts){
    if(!root)build();
    state.hero=hero||state.hero;state.shop=shopId||state.shop;state.tab='buy';state.qty={};
    toastFn=opts&&opts.say||toastFn;opener=document.activeElement;
    root.hidden=false;draw();
    document.addEventListener('keydown',onKey,true);
    off=Ro().onChange(function(){draw()});
  }
  function close(){
    if(!root||root.hidden)return;
    root.hidden=true;root.textContent='';document.removeEventListener('keydown',onKey,true);if(off)off();off=null;
    if(opener&&opener.focus&&document.contains(opener))opener.focus();
  }
  return {open:open,close:close,isOpen:function(){return !!root&&!root.hidden}};
})();
})();
