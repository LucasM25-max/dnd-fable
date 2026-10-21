/* Left edge: the first fight's coach (implementation plan, section 14, and plan.md first battle flow). A small plate that names
   the next thing to try - move, attack, Second Wind, end the turn - and ticks each one off as the fight shows the player
   did it. The steps are data on the encounter (encounter.tutorial), so another encounter can have its own or none. It can be
   dismissed and stays dismissed. It only reads the events the combat rules emit; it never changes the fight. */
(function(){
var DISMISS='dicebound.coach.off';
Fable.hudModules.tutorialCoach=function(hud){
  var host=document.createElement('div');
  host.className='coach';host.hidden=true;
  hud.root.appendChild(host);
  var steps=[],done={},off=false,last='';
  try{off=window.localStorage.getItem(DISMISS)==='1'}catch(e){}
  function draw(){
    if(off||!steps.length){host.hidden=true;return}
    var next=steps.filter(function(x){return !done[x.id]})[0];
    var key=JSON.stringify([done,!!next]);
    if(key===last)return;
    last=key;
    var finished=!next;
    host.hidden=false;
    host.innerHTML=hud.plate(
      '<header><b>First steps</b><button type="button" class="co-x" aria-label="Hide tips" data-tip="Hide tips" data-tip-right>'+Fable.hudIcons.svg('close')+'</button></header>'+
      '<ol>'+steps.map(function(x){
        return '<li class="'+(done[x.id]?'done':x===next?'now':'')+'"><i>'+(done[x.id]?Fable.hudIcons.svg('check'):'')+'</i><span>'+hud.escape(x.text)+'</span></li>';
      }).join('')+'</ol>'+(finished?'<p class="co-end">You know the basics. Good hunting.</p>':''),'sm');
  }
  host.addEventListener('click',function(e){
    if(e.target.closest&&e.target.closest('.co-x')){off=true;try{window.localStorage.setItem(DISMISS,'1')}catch(x){}host.hidden=true}
  });
  return {
    setSteps:function(list){steps=(list||[]).slice();done={};last='';draw()},
    event:function(kind){
      var changed=false;
      steps.forEach(function(x){if(!done[x.id]&&x.when===kind){done[x.id]=true;changed=true}});
      if(changed)draw();
    },
    update:function(){draw()}
  };
};
})();
