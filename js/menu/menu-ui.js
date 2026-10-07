/* Hub menu buttons, toast and encounter picker. Play enters the 3D world. */
(function(){
var toast=document.getElementById('toast'),tt;
function say(m){toast.textContent=m;toast.classList.add('show');clearTimeout(tt);tt=setTimeout(function(){toast.classList.remove('show')},1800)}
document.querySelectorAll('[data-t]').forEach(function(b){b.addEventListener('click',function(){say('Mockup: this opens '+b.dataset.t+'.')})});
var E=[['Goblin Warrens','4 goblin warriors, cave map','200 XP and 80 to 120 gp'],['Bandit Road','5 bandits, forest road','125 XP and 60 to 90 gp'],['Wolf Den','3 wolves, rocky hills','150 XP and 70 to 100 gp']],ei=0;
function show(){document.getElementById('en').textContent=E[ei][0];document.getElementById('ed').textContent=E[ei][1];document.getElementById('rw').textContent='Reward: '+E[ei][2]}
document.getElementById('prev').onclick=function(){ei=(ei+2)%3;show()};document.getElementById('next').onclick=function(){ei=(ei+1)%3;show()};
document.getElementById('play').onclick=function(){Fable.enterWorld()};show();

})();
