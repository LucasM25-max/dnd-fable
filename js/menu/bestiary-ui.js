/* The Bestiary: a full page opened from the hub's Bestiary tile, laid out like the Characters screen. A row of voxel heads along the top picks a
   monster. Each monster's page has its 3D model on the podium on the left and its stat block on the right (what it is, its numbers, its
   attacks and where it lives). A monster that has not yet been in one of the player's fights (Fable.codex) is greyed out everywhere: a dark
   head with no name, a shadow on the podium and a page that says so. The first fight against it, won or lost, fills its page in.

   Fable.bestiaryUi.open({say, from, select, manual})   shows the page (select: the id to start on, the first monster met by default)
   Fable.bestiaryUi.close() / isOpen() / selected()     Escape closes the page; the left and right arrows move along the row
   Fable.bestiaryUi.select(id)                          the same as clicking that head
   Fable.bestiaryUi.stage()                             the 3D stage, for tests */
(function(){
Fable.bestiaryUi=(function(){
  var root=null,els={},state={sel:null,closed:{}},stage=null,opener=null,toastFn=null,manual=false;
  function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
  function say(m){if(toastFn)toastFn(m)}
  function SB(){return Fable.statblock}
  function signed(n){return (n<0?'-':'+')+Math.abs(n)}
  function titleCase(s){return Fable.itemInfo.titleCase(s)}
  function met(id){return !!(Fable.codex&&Fable.codex.hasMet(id))}
  function build(){root=el('div');root.id='bestiary';root.hidden=true;document.body.appendChild(root)}

  /* every monster in the game, weakest first (then by name), so the page reads as a ladder */
  function crOf(d){var v=d.challenge?SB().parseCr(d.challenge.cr):0;return isNaN(v)?0:v}
  function monsters(){
    return Fable.content.monsters.list().slice().sort(function(a,b){return crOf(a)-crOf(b)||(a.name<b.name?-1:a.name>b.name?1:0)});
  }
  function defOf(id){return Fable.content.monsters.get(id)}
  function nameOf(id){var d=defOf(id);return met(id)?d.name:'Unknown'}
  function metList(){return monsters().filter(function(d){return met(d.id)})}
  function lineOf(id){var d=defOf(id);return met(id)?[d.size,d.creatureType].filter(Boolean).join(' ')+(d.alignment?', '+d.alignment:''):'Not yet met in a fight'}

  /* ---------- the row of heads ---------- */
  function face(host,id,known){
    host.textContent='';
    var ok=false;
    if(Fable.headPortrait){try{ok=Fable.headPortrait.fill(host,'monster',{monsterId:id,w:60,h:60,yaw:-.4})}catch(e){ok=false}}
    if(!ok){host.classList.add('flat');host.textContent=known?defOf(id).name.charAt(0).toUpperCase():'?'}
  }
  function drawRoster(){
    var row=els.roster,keep=document.activeElement&&row.contains(document.activeElement)?document.activeElement.dataset.id:null;
    row.textContent='';
    monsters().forEach(function(d){
      var id=d.id,known=met(id),on=id===state.sel,b=el('button','ch-head bs-head'+(on?' on':'')+(known?'':' locked'));
      b.type='button';b.id='bs-tab-'+id;b.dataset.id=id;b.setAttribute('role','tab');
      b.setAttribute('aria-selected',on?'true':'false');b.setAttribute('aria-controls','bs-panel');b.tabIndex=on?0:-1;
      b.setAttribute('aria-label',known?d.name+', '+lineOf(id):'Unknown creature, not yet met in a fight');
      var f=el('span','ch-face');face(f,id,known);b.appendChild(f);
      b.appendChild(el('span','ch-hn',known?d.name:'???'));
      b.onclick=function(){select(id)};
      row.appendChild(b);
    });
    if(keep){var again=row.querySelector('.ch-head[data-id="'+keep+'"]');if(again)try{again.focus({preventScroll:true})}catch(e){}}
    var all=monsters().length,n=metList().length;
    els.count.textContent=n+' / '+all;
    els.countBox.setAttribute('aria-label',n+' of '+all+' creatures discovered');
  }

  /* ---------- the name plate ---------- */
  function drawPlate(){
    var id=state.sel,p=els.plate,known=met(id),rec=Fable.codex.monster(id);
    p.textContent='';
    var who=el('div','ch-who');who.appendChild(el('h3',null,known?defOf(id).name:'Unknown creature'));who.appendChild(el('p',null,lineOf(id)));p.appendChild(who);
    var tag=el('span','bs-record'+(known?'':' none'));
    tag.setAttribute('role','status');
    if(known){
      tag.appendChild(el('b',null,String(rec.defeated)));tag.appendChild(el('small',null,'defeated'));
      tag.setAttribute('aria-label','Defeated '+rec.defeated+' time'+(rec.defeated===1?'':'s')+' in '+rec.fights+' fight'+(rec.fights===1?'':'s'));
    }else{tag.appendChild(el('b',null,'?'));tag.setAttribute('aria-label','Not yet met')}
    p.appendChild(tag);
  }

  /* ---------- the page ---------- */
  function section(title,note){
    var s=el('section','sh-sec'),h=el('header','sh-sech');h.appendChild(el('h4',null,title));if(note)h.appendChild(el('span',null,note));s.appendChild(h);return s;
  }
  function drawSheet(){
    var id=state.sel,host=els.sheet,top=host.scrollTop,d=defOf(id);
    host.textContent='';
    els.stage.classList.toggle('locked',!met(id));
    if(!d){host.appendChild(el('p','sh-err','Nothing to show here.'));return}
    if(!met(id)){
      var q=el('div','bs-unknown');
      q.appendChild(el('span','bs-q','?'));
      q.appendChild(el('h4',null,'Not yet met'));
      q.appendChild(el('p',null,'You have not faced this creature in a fight. Meet it, win or lose, and its page fills in: what it is, how tough it is and what it does.'));
      host.appendChild(q);
      return;
    }
    var rec=Fable.codex.monster(id),sb=null;
    try{sb=SB().derive(d)}catch(e){sb=null}
    if(!sb){host.appendChild(el('p','sh-err','This creature\'s stat block could not be worked out.'));return}

    /* challenge and the record of fights */
    var hd=el('div','sh-top');
    var cr=el('div','sh-lv bs-cr');cr.appendChild(el('small',null,'CR'));cr.appendChild(el('b',null,String(sb.challenge.cr)));hd.appendChild(cr);
    var xp=el('div','sh-xp'),xl=el('div','sh-xpl');
    xl.appendChild(el('b',null,sb.challenge.xp.toLocaleString('en-GB')+' XP when defeated'));
    xl.appendChild(el('span',null,'Met in '+rec.fights+' fight'+(rec.fights===1?'':'s')+', defeated '+rec.defeated));
    xp.appendChild(xl);hd.appendChild(xp);host.appendChild(hd);

    if(d.lore)host.appendChild(el('p','bs-lore',d.lore));

    /* the numbers */
    var vit=el('div','sh-vitals');
    var spd=Object.keys(sb.speed).map(function(k){return (k==='walk'?'':k+' ')+sb.speed[k]+' ft'}).join(', ');
    [['Armor Class',String(sb.ac.value),d.ac&&d.ac.label?d.ac.label:'','ac'],
     ['Hit Points',String(sb.hp.average),'Average of '+sb.hp.dice,'hp'],
     ['Speed',spd,'How far it moves in a turn',''],
     ['Initiative',signed(sb.initiative.value),'Added to its roll for turn order',''],
     ['Passive Perception',String(sb.passivePerception.value),'What it notices without looking',''],
     ['Reach',sb.reachFt+' ft','How far its melee attacks reach','']].forEach(function(v){
      var t=el('div','sh-vit v-'+v[3]);t.tabIndex=0;if(v[2])t.title=v[2];
      t.setAttribute('aria-label',v[0]+' '+v[1]+(v[2]?'. '+v[2]:''));
      t.appendChild(el('small',null,v[0]));t.appendChild(el('b',null,v[1]));vit.appendChild(t);
    });
    host.appendChild(vit);

    /* the six abilities */
    var ab=section('Abilities'),ag=el('div','sh-abil');
    SB().ABILITIES.forEach(function(k){
      var a=sb.abilities[k],t=el('div','sh-ab');t.tabIndex=0;
      t.setAttribute('aria-label',k.toUpperCase()+' '+a.score+', modifier '+signed(a.mod));
      t.appendChild(el('small',null,k.toUpperCase()));t.appendChild(el('b',null,signed(a.mod)));t.appendChild(el('span','sh-score',String(a.score)));
      ag.appendChild(t);
    });
    ab.appendChild(ag);host.appendChild(ab);

    /* what it does: each action with its words, opening on a click */
    var ft=section('Actions and traits','Click one to read it'),fl=el('ul','sh-feats'),seen={};
    function addAction(a,cost){
      if(seen[a.source.id])return;seen[a.source.id]=1;
      var key=id+':'+a.source.id,open=!state.closed[key],li=el('li','sh-feat');
      var b=el('button','sh-fb');b.type='button';b.setAttribute('aria-expanded',open?'true':'false');
      b.appendChild(el('b',null,a.source.name));b.appendChild(el('span',null,cost));b.appendChild(el('i','sh-chev'));
      var body=el('p','sh-fd',a.description);body.hidden=!open;
      b.onclick=function(){var o=body.hidden;body.hidden=!o;b.setAttribute('aria-expanded',o?'true':'false');if(o)delete state.closed[key];else state.closed[key]=1};
      li.appendChild(b);li.appendChild(body);fl.appendChild(li);
    }
    sb.actions.forEach(function(a){addAction(a,a.cost==='bonus'?'Bonus Action':a.cost==='reaction'?'Reaction':'Action')});
    ft.appendChild(fl);host.appendChild(ft);

    /* skills, senses, languages and where it lives */
    var pr=section('Details'),dl=el('dl','sh-train');
    var sk=Object.keys(sb.skills).map(function(k){return sb.skills[k].name+' '+signed(sb.skills[k].value)}).join(', ');
    var senses=[];
    Object.keys(sb.senses).forEach(function(k){if(k!=='passivePerception')senses.push(titleCase(k)+' '+sb.senses[k]+' ft')});
    senses.push('Passive Perception '+sb.passivePerception.value);
    var langs=sb.languages.map(function(l){var r=Fable.content.languages&&Fable.content.languages.get(l);return r?r.name:titleCase(l)}).join(', ');
    var gear=(d.equipment||[]).map(function(e){var it=Fable.content.items.get(e.item);return (it?it.name:titleCase(e.item))+(e.qty>1?' x'+e.qty:'')}).join(', ');
    var hab=(d.environments||[]).map(titleCase).join(', ');
    [['Skills',sk],['Senses',senses.join(', ')],['Languages',langs],['Carries',gear],['Found in',hab]].forEach(function(r){
      if(!r[1])return;dl.appendChild(el('dt',null,r[0]));dl.appendChild(el('dd',null,r[1]));
    });
    pr.appendChild(dl);host.appendChild(pr);
    host.scrollTop=top;
  }

  function skeleton(){
    root.textContent='';
    root.appendChild(el('div','ch-bg'));
    var page=el('div','ch-page');page.setAttribute('role','dialog');page.setAttribute('aria-modal','true');page.setAttribute('aria-label','Bestiary');root.appendChild(page);
    var top=el('header','ch-top');
    var back=el('button','ch-back');back.type='button';back.setAttribute('aria-label','Back to the main menu');
    back.innerHTML='<svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>';back.onclick=close;
    var ttl=el('div','ch-ttl');ttl.appendChild(el('small',null,'Creatures of the realm'));ttl.appendChild(el('h2',null,'Bestiary'));
    var roster=el('div','ch-roster');roster.setAttribute('role','tablist');roster.setAttribute('aria-label','Creatures');
    var cnt=el('div','ch-purse bs-count');cnt.appendChild(el('small',null,'Discovered'));var cb=el('b');cnt.appendChild(cb);
    top.appendChild(back);top.appendChild(ttl);top.appendChild(roster);top.appendChild(cnt);page.appendChild(top);
    var body=el('main','ch-body');body.id='bs-panel';body.setAttribute('role','tabpanel');
    var left=el('section','ch-left');left.setAttribute('aria-label','Model');
    var plate=el('div','ch-plate');left.appendChild(plate);
    var sw=el('div','ch-stage'),cv=el('canvas');cv.tabIndex=0;cv.setAttribute('role','img');cv.setAttribute('aria-label','3D model of the creature. Drag, or use the left and right arrow keys, to turn it.');
    sw.appendChild(cv);left.appendChild(sw);
    var right=el('section','ch-right bs-sheet');right.setAttribute('aria-label','Stat block');right.tabIndex=-1;
    body.appendChild(left);body.appendChild(right);page.appendChild(body);
    els={page:page,back:back,roster:roster,plate:plate,stage:sw,canvas:cv,sheet:right,count:cb,countBox:cnt};
    roster.addEventListener('keydown',onRosterKey);
  }
  function select(id,quiet){
    if(!root||root.hidden)return;
    if(!defOf(id))return;
    var changed=id!==state.sel;
    state.sel=id;
    drawRoster();drawPlate();drawSheet();
    if(changed){
      if(stage)stage.setHero(id,!quiet);
      els.sheet.scrollTop=0;
    }
  }
  function onRosterKey(e){
    var ids=monsters().map(function(d){return d.id}),i=ids.indexOf(state.sel),n=-1;
    if(e.key==='ArrowRight')n=(i+1)%ids.length;else if(e.key==='ArrowLeft')n=(i+ids.length-1)%ids.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=ids.length-1;else return;
    e.preventDefault();select(ids[n]);
    var t=els.roster.querySelector('.ch-head[data-id="'+ids[n]+'"]');if(t)t.focus();
  }
  function focusables(scope){return [].slice.call(scope.querySelectorAll('button:not(:disabled):not([tabindex="-1"]),[tabindex="0"]')).filter(function(n){return n.offsetParent!==null})}
  function onKey(e){
    if(!root||root.hidden)return;
    if(e.code==='Escape'){e.preventDefault();e.stopPropagation();close();return}
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
    var all=monsters();
    if(!all.length){say('There are no creatures in the game yet.');return}
    var first=metList()[0]||all[0];
    state.sel=o.select&&defOf(o.select)?o.select:first.id;
    state.closed={};
    skeleton();
    root.hidden=false;root.classList.remove('in');void root.offsetWidth;root.classList.add('in');
    hubDim(true);
    try{stage=Fable.createCharacterStage(els.canvas,{manual:manual,monster:true});stage.setHero(state.sel,false);stage.start()}
    catch(e){stage=null;els.stage.classList.add('flat');if(window.console)console.warn('Bestiary: no 3D model ('+e.message+')')}
    drawRoster();drawPlate();drawSheet();
    if(stage)stage.resize();
    document.addEventListener('keydown',onKey,true);
    window.addEventListener('resize',onResize);
    var t=els.roster.querySelector('.ch-head.on');if(t&&!manual)try{t.focus({preventScroll:true})}catch(e){}
  }
  function onResize(){if(stage)stage.resize()}
  function close(){
    if(!root||root.hidden)return;
    if(stage){stage.dispose();stage=null}
    document.removeEventListener('keydown',onKey,true);window.removeEventListener('resize',onResize);
    root.hidden=true;root.classList.remove('in');hubDim(false);
    root.textContent='';els={};
    if(opener&&opener.focus&&document.contains(opener))try{opener.focus()}catch(e){}
  }
  return {open:open,close:close,isOpen:function(){return !!root&&!root.hidden},selected:function(){return state.sel},select:select,stage:function(){return stage}};
})();
})();
