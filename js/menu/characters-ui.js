/* The Characters screen (implementation plan, section 7 and the design document's hub screens): a full page, opened from the hub's Characters tile.
   A row of voxel heads along the top picks a character (the + at its end is for creating one, which is not built yet). Each character's page has
   the 3D model on the left with the same equipment panel as the hub under it (js/menu/equipment-panel.js), and the character sheet on the right,
   cut down to what a player reads and uses (js/character/sheet-view.js). Switch makes a character the one the hub shows and the next fight plays.

   Fable.charactersUi.open({say, from, select, manual})   shows the page (select: the id to start on, the active character by default)
   Fable.charactersUi.close() / isOpen() / selected()     Escape closes an open list of equipment choices first, then the page; the left and right arrows move along the row
   Fable.charactersUi.select(id)                          the same as clicking that head
   Fable.charactersUi.stage()                             the 3D stage, for tests */
(function(){
Fable.charactersUi=(function(){
  var root=null,els={},state={sel:null,open:{}},stage=null,panel=null,offChange=null,offActive=null,opener=null,toastFn=null,manual=false;
  function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
  function Ro(){return Fable.character.roster}
  function say(m){if(toastFn)toastFn(m)}
  function defOf(id){return Fable.content.characters.get(id)}
  function nameOf(id){var b=Ro().build(id),d=defOf(id);return (b&&b.name)||(d&&d.name)||id}
  function lineOf(id){
    var m=Fable.character.sheetView.model(Ro().sheet(id));
    return m?m.line:(defOf(id)&&defOf(id).name)||'';
  }
  function calm(){return Fable.hudSettings&&Fable.hudSettings.reducedMotion&&Fable.hudSettings.reducedMotion()}
  function build(){root=el('div');root.id='chars';root.hidden=true;document.body.appendChild(root)}

  /* ---------- the row of heads ---------- */
  function face(host,id){
    host.textContent='';
    var ok=false;
    if(Fable.headPortrait){try{ok=Fable.headPortrait.fill(host,'hero',{heroId:id,w:60,h:60,yaw:-.4})}catch(e){ok=false}}
    if(!ok){host.classList.add('flat');host.textContent=nameOf(id).charAt(0).toUpperCase()}
  }
  function drawRoster(){
    var row=els.roster,keep=document.activeElement&&row.contains(document.activeElement)?document.activeElement.dataset.id||'add':null;
    row.textContent='';
    var active=Ro().active();
    Ro().characters().forEach(function(id){
      var on=id===state.sel,b=el('button','ch-head'+(on?' on':'')+(id===active?' playing':''));
      b.type='button';b.id='ch-tab-'+id;b.dataset.id=id;b.setAttribute('role','tab');
      b.setAttribute('aria-selected',on?'true':'false');b.setAttribute('aria-controls','ch-panel');b.tabIndex=on?0:-1;
      b.setAttribute('aria-label',nameOf(id)+', '+lineOf(id)+(id===active?', playing now':''));
      var f=el('span','ch-face');face(f,id);b.appendChild(f);
      b.appendChild(el('span','ch-hn',nameOf(id)));
      if(id===active)b.appendChild(el('i','ch-badge','Playing'));
      b.onclick=function(){select(id)};
      row.appendChild(b);
    });
    var add=el('button','ch-add');add.type='button';add.dataset.id='add';add.setAttribute('aria-label','Create a new character');
    add.appendChild(el('span','ch-plus','+'));add.appendChild(el('span','ch-hn','New'));
    add.onclick=function(){say('Creating a new character is coming soon.')};
    row.appendChild(add);
    if(keep){var again=keep==='add'?row.querySelector('.ch-add'):row.querySelector('.ch-head[data-id="'+keep+'"]');if(again)try{again.focus({preventScroll:true})}catch(e){}}
  }

  /* ---------- the name plate: who this is, and the switch ---------- */
  function drawPlate(){
    var id=state.sel,R=Ro(),active=R.active()===id,p=els.plate;
    p.textContent='';
    var who=el('div','ch-who');who.appendChild(el('h3',null,nameOf(id)));who.appendChild(el('p',null,lineOf(id)));p.appendChild(who);
    if(active){
      var s=el('span','ch-playing');s.innerHTML=(Fable.hudIcons?Fable.hudIcons.svg('check'):'')+'<b>Playing now</b>';
      s.setAttribute('role','status');p.appendChild(s);
    }else{
      var b=el('button','ch-switch','Switch to '+nameOf(id));b.type='button';b.dataset.k='switch';
      b.onclick=function(){
        var r=R.setActive(id);
        if(r.ok)say(nameOf(id)+' will play your next fight.');
        else say(r.reasons&&r.reasons[0]||'That did not work');
      };
      p.appendChild(b);
    }
    els.purse.textContent=Fable.money.format(R.purseCp(id));
    els.purseBox.setAttribute('aria-label','Purse '+Fable.money.format(R.purseCp(id)));
  }

  /* ---------- the sheet ---------- */
  function section(title,note){
    var s=el('section','sh-sec'),h=el('header','sh-sech');h.appendChild(el('h4',null,title));if(note)h.appendChild(el('span',null,note));s.appendChild(h);return s;
  }
  function drawSheet(){
    var id=state.sel,R=Ro(),host=els.sheet,top=host.scrollTop;
    var sheet=R.sheet(id),m=Fable.character.sheetView.model(sheet,{xp:R.xp(id),levelStatus:R.levelStatus(id)});
    host.textContent='';
    if(!m){host.appendChild(el('p','sh-err','This character\'s sheet could not be worked out.'));return}
    var lu=R.levelStatus(id);

    /* level and experience */
    var hd=el('div','sh-top');
    var lv=el('div','sh-lv'+(lu.ready?' ready':''));lv.appendChild(el('small',null,'Level'));lv.appendChild(el('b',null,String(m.level)));hd.appendChild(lv);
    var xp=el('div','sh-xp');
    var xl=el('div','sh-xpl');xl.appendChild(el('b',null,m.xp?(m.xp.next===null?'Maximum level':m.xp.value.toLocaleString('en-GB')+' / '+m.xp.next.toLocaleString('en-GB')+' XP'):''));
    xl.appendChild(el('span',null,m.hitDice?'Hit dice '+m.hitDice:''));xp.appendChild(xl);
    var bar=el('div','sh-xpb');bar.setAttribute('role','progressbar');bar.setAttribute('aria-label','Experience to the next level');bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');
    var pct=m.xp?Math.round(m.xp.frac*100):0;bar.setAttribute('aria-valuenow',String(pct));bar.appendChild(el('i'));bar.firstChild.style.width=pct+'%';xp.appendChild(bar);
    hd.appendChild(xp);
    if(lu.ready){
      var up=el('button','sh-lvup','Level up to '+lu.nextLevel);up.type='button';
      up.onclick=function(){Fable.levelUpUi.open(id,{onDone:function(r){if(r&&r.ok)say('Level '+r.level+' reached')}})};
      hd.appendChild(up);
    }
    host.appendChild(hd);

    /* the six numbers */
    var vit=el('div','sh-vitals');
    m.vitals.forEach(function(v){
      var t=el('div','sh-vit v-'+v.id);t.tabIndex=0;if(v.tip)t.title=v.tip;
      t.setAttribute('aria-label',v.label+' '+v.value+(v.tip?'. '+v.tip:''));
      t.appendChild(el('small',null,v.label));t.appendChild(el('b',null,v.value));vit.appendChild(t);
    });
    host.appendChild(vit);

    /* abilities with their saving throws */
    var ab=section('Abilities','Saving throws underneath'),ag=el('div','sh-abil');
    m.abilities.forEach(function(a){
      var t=el('div','sh-ab'+(a.saveProficient?' prof':''));t.tabIndex=0;t.title=a.name+' '+a.score+'. '+(a.tip||'')+(a.saveTip?'\nSave: '+a.saveTip:'');
      t.setAttribute('aria-label',a.name+' '+a.score+', modifier '+a.mod+', saving throw '+a.save+(a.saveProficient?', proficient':''));
      t.appendChild(el('small',null,a.abbr));t.appendChild(el('b',null,a.mod));t.appendChild(el('span','sh-score',String(a.score)));
      var sv=el('span','sh-save');sv.appendChild(el('i'));sv.appendChild(document.createTextNode('Save '+a.save));t.appendChild(sv);
      ag.appendChild(t);
    });
    ab.appendChild(ag);host.appendChild(ab);

    /* attacks: what is in the hands first */
    var at=section('Attacks'),tbl=el('table','sh-att'),th=el('thead'),hr=el('tr');
    ['Attack','Hit','Damage','Notes'].forEach(function(h){var c=el('th',null,h);c.scope='col';hr.appendChild(c)});
    th.appendChild(hr);tbl.appendChild(th);
    var tb=el('tbody');
    m.attacks.forEach(function(a){
      var tr=el('tr',a.state+(a.available?'':' off'));
      var n=el('th',null,a.name);n.scope='row';
      if(a.state==='held'){var h=el('i','sh-held','Held');n.appendChild(h)}
      tr.appendChild(n);tr.appendChild(el('td','hit',a.hit));tr.appendChild(el('td','dmg',a.damage));
      var nt=el('td','nt',a.available?a.notes:(a.reason||a.notes));tr.appendChild(nt);
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);at.appendChild(tbl);host.appendChild(at);

    /* skills */
    var sk=section('Skills','Trained skills are lit'),ul=el('ul','sh-skills');
    m.skills.forEach(function(s){
      var li=el('li',s.proficient?'prof':'');if(s.tip)li.title=s.tip;
      li.appendChild(el('i','pip'));
      var nm=el('span','nm',s.name);nm.appendChild(el('small',null,s.ability));li.appendChild(nm);
      li.appendChild(el('b',null,s.value));
      if(s.proficient)li.setAttribute('aria-label',s.name+' '+s.value+', trained');else li.setAttribute('aria-label',s.name+' '+s.value);
      ul.appendChild(li);
    });
    sk.appendChild(ul);host.appendChild(sk);

    /* features and feats: a name and where it came from; the words open on a click */
    var ft=section('Features and feats'),fl=el('ul','sh-feats');
    m.features.forEach(function(f){
      var li=el('li','sh-feat'),open=!!state.open[id+':'+f.id];
      var b=el('button','sh-fb');b.type='button';b.setAttribute('aria-expanded',open?'true':'false');
      b.appendChild(el('b',null,f.name));
      if(f.uses)b.appendChild(el('em',null,f.uses));
      b.appendChild(el('span',null,f.tag));
      b.appendChild(el('i','sh-chev'));
      var body=el('p','sh-fd',f.description);body.hidden=!open;
      b.onclick=function(){var o=body.hidden;body.hidden=!o;b.setAttribute('aria-expanded',o?'true':'false');if(o)state.open[id+':'+f.id]=1;else delete state.open[id+':'+f.id]};
      li.appendChild(b);li.appendChild(body);fl.appendChild(li);
    });
    ft.appendChild(fl);host.appendChild(ft);

    /* training */
    if(m.proficiencies.length){
      var pr=section('Training'),dl=el('dl','sh-train');
      m.proficiencies.forEach(function(p){dl.appendChild(el('dt',null,p.label));dl.appendChild(el('dd',null,p.text))});
      pr.appendChild(dl);host.appendChild(pr);
    }
    var cw=el('p','sh-carry'+(m.carrying.over?' over':''),'Carrying '+m.carrying.weight+' of '+m.carrying.capacity+' lb');host.appendChild(cw);
    host.scrollTop=top;
  }

  /* ---------- the page ---------- */
  function skeleton(){
    root.textContent='';
    root.appendChild(el('div','ch-bg'));
    var page=el('div','ch-page');page.setAttribute('role','dialog');page.setAttribute('aria-modal','true');page.setAttribute('aria-label','Characters');root.appendChild(page);
    var top=el('header','ch-top');
    var back=el('button','ch-back');back.type='button';back.setAttribute('aria-label','Back to the main menu');
    back.innerHTML='<svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>';back.onclick=close;
    var ttl=el('div','ch-ttl');ttl.appendChild(el('small',null,'Your heroes'));ttl.appendChild(el('h2',null,'Characters'));
    var roster=el('div','ch-roster');roster.setAttribute('role','tablist');roster.setAttribute('aria-label','Characters');
    var purse=el('div','ch-purse');purse.appendChild(el('span','coin'));var pb=el('b');purse.appendChild(pb);
    top.appendChild(back);top.appendChild(ttl);top.appendChild(roster);top.appendChild(purse);page.appendChild(top);
    var body=el('main','ch-body');body.id='ch-panel';body.setAttribute('role','tabpanel');
    var left=el('section','ch-left');left.setAttribute('aria-label','Model and equipment');
    var plate=el('div','ch-plate');left.appendChild(plate);
    var sw=el('div','ch-stage'),cv=el('canvas');cv.tabIndex=0;cv.setAttribute('role','img');cv.setAttribute('aria-label','3D model of the character. Drag, or use the left and right arrow keys, to turn it.');
    sw.appendChild(cv);left.appendChild(sw);
    var eq=el('div','ch-eq');left.appendChild(eq);
    var right=el('section','ch-right');right.setAttribute('aria-label','Character sheet');right.tabIndex=-1;
    body.appendChild(left);body.appendChild(right);page.appendChild(body);
    els={page:page,back:back,roster:roster,plate:plate,stage:sw,canvas:cv,eq:eq,sheet:right,purse:pb,purseBox:purse};
    roster.addEventListener('keydown',onRosterKey);
  }
  function select(id,quiet){
    if(!root||root.hidden)return;
    if(Ro().characters().indexOf(id)<0)return;
    var changed=id!==state.sel;
    state.sel=id;
    drawRoster();drawPlate();drawSheet();
    if(changed){
      if(panel)panel.setHero(id);
      if(stage)stage.setHero(id,!quiet);
      els.sheet.scrollTop=0;
    }
  }
  function onRosterKey(e){
    var ids=Ro().characters(),i=ids.indexOf(state.sel),n=-1;
    if(e.target&&e.target.classList&&e.target.classList.contains('ch-add'))return;
    if(e.key==='ArrowRight')n=(i+1)%ids.length;else if(e.key==='ArrowLeft')n=(i+ids.length-1)%ids.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=ids.length-1;else return;
    e.preventDefault();select(ids[n]);
    var t=els.roster.querySelector('.ch-head[data-id="'+ids[n]+'"]');if(t)t.focus();
  }
  function focusables(scope){return [].slice.call(scope.querySelectorAll('button:not(:disabled):not([tabindex="-1"]),[tabindex="0"]')).filter(function(n){return n.offsetParent!==null})}
  function onKey(e){
    if(!root||root.hidden)return;
    /* the level up screen sits above this page and takes its own keys */
    if(Fable.levelUpUi&&Fable.levelUpUi.isOpen())return;
    if(e.code==='Escape'){
      e.preventDefault();e.stopPropagation();
      if(panel&&panel.closeList())return;
      close();return;
    }
    if(e.code==='Tab'){
      var f=focusables(els.page);if(!f.length)return;
      var i=f.indexOf(document.activeElement);
      if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus()}
      else if(!e.shiftKey&&(i<0||i===f.length-1)){e.preventDefault();f[0].focus()}
    }
  }
  function hubDim(on){var m=document.getElementById('menu-layer');if(m)m.classList.toggle('chars-open',!!on)}
  function open(o){
    o=o||{};
    if(root&&!root.hidden)return;
    if(!root)build();
    toastFn=o.say||toastFn;manual=!!o.manual;opener=o.from||document.activeElement;
    var ids=Ro().characters();
    state.sel=ids.indexOf(o.select)>=0?o.select:(Ro().active()||ids[0]);
    state.open={};
    skeleton();
    root.hidden=false;root.classList.remove('in');void root.offsetWidth;root.classList.add('in');
    hubDim(true);
    panel=Fable.equipmentPanel.create(state.sel,{say:say,className:'in-page'});els.eq.appendChild(panel.el);
    try{stage=Fable.createCharacterStage(els.canvas,{manual:manual});stage.setHero(state.sel,false);stage.start()}
    catch(e){stage=null;els.stage.classList.add('flat');if(window.console)console.warn('Characters: no 3D model ('+e.message+')')}
    drawRoster();drawPlate();drawSheet();
    if(stage)stage.resize();
    offChange=Ro().onChange(function(id){if(id===state.sel||id==='*'){drawPlate();drawSheet();drawRoster()}});
    offActive=Ro().onActive(function(){drawRoster();drawPlate()});
    document.addEventListener('keydown',onKey,true);
    window.addEventListener('resize',onResize);
    var t=els.roster.querySelector('.ch-head.on');if(t&&!manual)try{t.focus({preventScroll:true})}catch(e){}
  }
  function onResize(){if(stage)stage.resize()}
  function close(){
    if(!root||root.hidden)return;
    if(panel){panel.destroy();panel=null}
    if(stage){stage.dispose();stage=null}
    if(offChange){offChange();offChange=null}
    if(offActive){offActive();offActive=null}
    document.removeEventListener('keydown',onKey,true);window.removeEventListener('resize',onResize);
    root.hidden=true;root.classList.remove('in');hubDim(false);
    root.textContent='';els={};
    if(opener&&opener.focus&&document.contains(opener))try{opener.focus()}catch(e){}
  }
  return {open:open,close:close,isOpen:function(){return !!root&&!root.hidden},selected:function(){return state.sel},select:select,stage:function(){return stage}};
})();
})();
