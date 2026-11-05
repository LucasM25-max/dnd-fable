/* The Level Up screen (implementation plan, section 7). One modal that works over the hub and over the results screen of a fight,
   so the player takes a level the moment it is earned or whenever they come back to it. It only asks and shows: the rules are
   Fable.character.levelup (what a level brings) and Fable.character.roster.levelUp (taking it, and saving it).

   Fable.levelUpUi.open(heroId, {sound(id), onDone(result)})   shows the screen and returns a function that closes it
     the player sees the new hit points, the proficiency bonus and every feature the level grants with how it is used; Enter takes the
     level, Escape (or Not yet) leaves it for later; a taken level plays a short celebration and reports {ok, level} to onDone
   Fable.levelUpUi.isOpen() */
(function(){
var open=null;
function esc(t){return String(t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function signed(n){return (n<0?'-':'+')+Math.abs(n)}
var COST={action:'Action',bonus:'Bonus Action',reaction:'Reaction',free:'Free action'};
var ICON={'action-surge':'surge','tactical-mind':'mind','second-wind':'heart'};
function usesText(f){
  var u=f.uses;if(!u)return '';
  var re=u.recharge||{},when=re.short?'short or long rest':re.long?'long rest':'';
  return u.max+(u.max===1?' use':' uses')+(when?', back after a '+when:'');
}
function featureCard(f,i){
  var tags=[];
  if(f.action)tags.push(COST[f.action.cost]||f.action.cost);else tags.push('Always on');
  var ut=usesText(f);if(ut)tags.push(ut);
  return '<li class="lv-feat" style="--i:'+i+'"><span class="lv-ico" aria-hidden="true">'+Fable.hudIcons.svg(ICON[f.id]||'star')+'</span>'+
    '<div><h3>'+esc(f.name)+'</h3><p>'+esc(f.description)+'</p><div class="lv-tags">'+tags.map(function(t){return '<b>'+esc(t)+'</b>'}).join('')+'</div></div></li>';
}
function sparks(){
  var h='';
  for(var i=0;i<18;i++)h+='<i style="--a:'+(i*20)+'deg;--d:'+(.04*i).toFixed(2)+'s;--r:'+(120+(i%3)*50)+'px"></i>';
  return '<div class="lv-sparks" aria-hidden="true">'+h+'</div>';
}

Fable.levelUpUi={
  isOpen:function(){return !!open},
  open:function(heroId,o){
    o=o||{};
    if(open)return open.close;
    var R=Fable.character.roster,pv=R.levelPreview(heroId);
    if(!pv){if(o.onDone)o.onDone({ok:false});return function(){}}
    var b=R.build(heroId),name=b.name||'Your hero';
    var root=document.createElement('div');
    root.id='lvl';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','lv-t');
    var prevFocus=document.activeElement,done=false;
    var hp=pv.hp,pb=pv.proficiency;
    root.innerHTML='<div class="lv-rays" aria-hidden="true"></div>'+
      '<div class="lv-card"><div class="lv-edge">'+
      '<div class="lv-kicker">'+esc(name)+'  -  '+esc(pv.className)+'</div>'+
      '<h2 id="lv-t" class="lv-title"><span>Level up</span></h2>'+
      '<div class="lv-lv" aria-label="Level '+pv.fromLevel+' to level '+pv.toLevel+'"><b class="lv-from">'+pv.fromLevel+'</b><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h14M12 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.800" stroke-linecap="square"/></svg><b class="lv-to">'+pv.toLevel+'</b>'+sparks()+'</div>'+
      '<div class="lv-stats">'+
        '<div class="lv-stat"><small>Hit points</small><div><s>'+hp.from+'</s><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="3"/></svg><b>'+hp.to+'</b></div><em>'+signed(hp.gain)+'</em>'+
          '<span>d'+hp.die+' average '+hp.average+(hp.conMod?', Constitution '+signed(hp.conMod):'')+'</span></div>'+
        '<div class="lv-stat'+(pb.to===pb.from?' flat':'')+'"><small>Proficiency</small><div>'+(pb.to===pb.from?'<b>'+signed(pb.to)+'</b>':'<s>'+signed(pb.from)+'</s><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="3"/></svg><b>'+signed(pb.to)+'</b>')+'</div>'+
          '<span>'+(pb.to===pb.from?'No change at this level':'Applies to attacks, saves and skills')+'</span></div>'+
      '</div>'+
      '<div class="lv-sec">New features</div>'+
      '<ul class="lv-feats">'+(pv.features.length?pv.features.map(featureCard).join(''):'<li class="lv-feat none"><div><p>Nothing new at this level.</p></div></li>')+'</ul>'+
      (function(){var up=pv.resources.filter(function(r){return r.from>0});return up.length?'<p class="lv-note">'+up.map(function(r){return esc(r.label)+': '+r.from+' to '+r.to+' uses'}).join('. ')+'.</p>':''})()+
      '<div class="lv-btns"><button type="button" class="lv-go" data-a="go">Take level '+pv.toLevel+'<kbd>Enter</kbd></button><button type="button" class="lv-no" data-a="no">Not yet<kbd>Esc</kbd></button></div>'+
      '</div></div>';
    document.body.appendChild(root);
    if(Fable.hudSettings&&Fable.hudSettings.reducedMotion&&Fable.hudSettings.reducedMotion())root.classList.add('calm');
    requestAnimationFrame(function(){root.classList.add('on')});
    if(o.sound)try{o.sound('sfx-star')}catch(e){}
    var goBtn=root.querySelector('.lv-go');
    try{goBtn.focus({preventScroll:true})}catch(e){}

    function close(){
      document.removeEventListener('keydown',onKey,true);
      if(root.parentNode)root.parentNode.removeChild(root);
      open=null;
      if(prevFocus&&prevFocus.focus)try{prevFocus.focus({preventScroll:true})}catch(e){}
    }
    function finish(res){
      if(done)return;done=true;close();
      if(o.onDone)o.onDone(res);
    }
    function take(){
      if(done||root.classList.contains('taken'))return;
      var r=R.levelUp(heroId);
      if(!r.ok){
        var n=root.querySelector('.lv-note')||root.querySelector('.lv-btns').insertAdjacentElement('beforebegin',document.createElement('p'));
        n.className='lv-note bad';n.textContent=(r.reasons&&r.reasons[0])||'That level cannot be taken right now';
        return;
      }
      root.classList.add('taken');
      if(o.sound)try{o.sound('sfx-action-surge')}catch(e){}
      var card=root.querySelector('.lv-edge');
      card.innerHTML='<div class="lv-kicker">'+esc(name)+'  -  '+esc(pv.className)+'</div><div class="lv-done" role="status"><span class="lv-big">Level '+pv.toLevel+'</span>'+sparks()+
        '<p>'+esc(pv.features.map(function(f){return f.name}).join(' and '))+(pv.features.length?' gained.':'')+' Hit points '+hp.to+'.</p></div>'+
        '<div class="lv-btns"><button type="button" class="lv-go" data-a="ok">Continue<kbd>Enter</kbd></button></div>';
      var ok=card.querySelector('.lv-go');try{ok.focus({preventScroll:true})}catch(e){}
      root._res={ok:true,level:pv.toLevel,preview:pv};
    }
    function onKey(e){
      var k=e.code;
      if(k==='Enter'||k==='NumpadEnter'||k==='Space'){
        e.preventDefault();e.stopImmediatePropagation();
        if(root.classList.contains('taken'))finish(root._res);else take();
      }else if(k==='Escape'){
        e.preventDefault();e.stopImmediatePropagation();
        finish(root.classList.contains('taken')?root._res:{ok:false,cancelled:true});
      }else if(k==='Tab'){
        var bs=Array.prototype.slice.call(root.querySelectorAll('button'));
        if(!bs.length)return;
        var i=bs.indexOf(document.activeElement),n=e.shiftKey?(i<=0?bs.length-1:i-1):(i<0||i>=bs.length-1?0:i+1);
        e.preventDefault();bs[n].focus();
      }else e.stopImmediatePropagation();
    }
    document.addEventListener('keydown',onKey,true);
    root.addEventListener('click',function(e){
      var b=e.target.closest&&e.target.closest('button[data-a]');
      if(!b)return;
      var a=b.getAttribute('data-a');
      if(a==='go')take();else if(a==='ok')finish(root._res);else finish({ok:false,cancelled:true});
    });
    open={close:function(){finish(root.classList.contains('taken')?root._res:{ok:false,cancelled:true})}};
    return open.close;
  }
};
})();
