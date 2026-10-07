/* Hub menu buttons and registry-driven encounter picker. */
(function(){
var toast=document.getElementById('toast'),tt;
function say(m){toast.textContent=m;toast.classList.add('show');clearTimeout(tt);tt=setTimeout(function(){toast.classList.remove('show')},1800)}
document.querySelectorAll('[data-t]').forEach(function(b){b.addEventListener('click',function(){say('Mockup: this opens '+b.dataset.t+'.')})});

var E=[],ei=0;
function show(){
  var name=document.getElementById('en'),desc=document.getElementById('ed'),rw=document.getElementById('rw');
  if(!E.length){name.textContent='No encounters';desc.textContent='Add an encounter package to continue';rw.textContent='';return}
  var e=E[ei],reward=e.rewards&&e.rewards.xp!=null?e.rewards.xp+' XP':'';
  var gold=e.rewards&&e.rewards.goldMin!=null?' and '+e.rewards.goldMin+' to '+e.rewards.goldMax+' gp':'';
  name.textContent=e.name;desc.textContent=e.description||e.map;rw.textContent='Reward: '+reward+gold;
  document.getElementById('prev').disabled=E.length<2;document.getElementById('next').disabled=E.length<2;
}
function refresh(){
  E=Fable.content.encounters.enabled();ei=Math.min(ei,Math.max(0,E.length-1));show();
}
document.getElementById('prev').onclick=function(){if(E.length){ei=(ei+E.length-1)%E.length;show()}};
document.getElementById('next').onclick=function(){if(E.length){ei=(ei+1)%E.length;show()}};
document.getElementById('play').onclick=function(){if(E[ei])Fable.enterWorld(E[ei].id)};
Fable.content.whenReady(refresh);
})();
