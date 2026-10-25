/* Enemy AI profiles (implementation plan, section 16.5 and 16.8): the weights, risk appetite, morale and tricks a creature plays
   with. One engine plays them all, so a skirmisher, a brute and a beast act differently from the same code. A monster names its
   profile in `ai.profile` and may override any field next to it (the goblin does, with its own weights); an encounter may override
   again (the tutorial turns tricks off). Fable.ai.resolveProfile merges them in that order.

   weights          how much each evaluator term counts: damage, kill, risk, cover, retreatRoutes, resources (plan 16.5)
   engagement       the Tempo term (16.5): how much staying in the fight is worth; 1 is neutral, more makes a creature press on (default 1)
   riskAversion     0 ignores damage taken, 1 weighs it fully; the planner multiplies risk by this
   morale           fleeBelowHp (fraction of maximum hit points, 0 never), fleeIfAlone (bool), fleeIfAllyDefeated ('check' rolls a seeded
                    Wisdom check, true always flees, false never)
   tricks           what the planner may build plans out of (TRICKS below)
   tier             the default difficulty tier when the monster does not say (instinct, cunning, tactician, mastermind) */
(function(){
var C=Fable.content;
var TRICKS=['hit-and-run','throw-from-cover','hide-then-ambush','recover-daggers','focus-fire'];
var TIERS=['instinct','cunning','tactician','mastermind'];
var WEIGHTS=['damage','kill','risk','cover','retreatRoutes','resources'];
function num(v){return typeof v==='number'&&isFinite(v)&&v>=0}
/* The same checks for a profile and for an override block on a monster or an encounter, so a typo fails at load time. */
function checkAi(def,fail,where,partial){
  where=where||'';
  if(def.tier!==undefined&&TIERS.indexOf(def.tier)<0)fail(where+'tier must be one of '+TIERS.join(', '));
  if(def.weights!==undefined){
    if(!def.weights||typeof def.weights!=='object')fail(where+'weights must be an object');
    Object.keys(def.weights).forEach(function(k){
      if(WEIGHTS.indexOf(k)<0)fail(where+'weights.'+k+' is not a known term (known: '+WEIGHTS.join(', ')+')');
      else if(!num(def.weights[k]))fail(where+'weights.'+k+' must be a number of 0 or more');
    });
    if(!partial)WEIGHTS.forEach(function(k){if(def.weights[k]===undefined)fail(where+'weights.'+k+' is missing')});
  }else if(!partial)fail(where+'needs weights');
  if(def.engagement!==undefined&&(!num(def.engagement)||def.engagement>10))fail(where+'engagement must be a number from 0 to 10');
  if(def.riskAversion!==undefined&&(!num(def.riskAversion)||def.riskAversion>3))fail(where+'riskAversion must be a number from 0 to 3');
  else if(!partial&&def.riskAversion===undefined)fail(where+'needs riskAversion');
  if(def.morale!==undefined){
    var m=def.morale;
    if(!m||typeof m!=='object')fail(where+'morale must be an object');
    else{
      if(m.fleeBelowHp!==undefined&&(!num(m.fleeBelowHp)||m.fleeBelowHp>1))fail(where+'morale.fleeBelowHp must be a fraction from 0 to 1');
      if(m.fleeIfAlone!==undefined&&typeof m.fleeIfAlone!=='boolean')fail(where+'morale.fleeIfAlone must be true or false');
      if(m.fleeIfAllyDefeated!==undefined&&m.fleeIfAllyDefeated!=='check'&&typeof m.fleeIfAllyDefeated!=='boolean')fail(where+'morale.fleeIfAllyDefeated must be true, false or "check"');
    }
  }else if(!partial)fail(where+'needs morale');
  if(def.tricks!==undefined){
    if(!Array.isArray(def.tricks))fail(where+'tricks must be a list');
    else def.tricks.forEach(function(t){if(TRICKS.indexOf(t)<0)fail(where+'trick "'+t+'" is not known (known: '+TRICKS.join(', ')+')')});
  }else if(!partial)fail(where+'needs tricks');
}
C.AI_TRICKS=TRICKS;C.AI_TIERS=TIERS;C.AI_WEIGHTS=WEIGHTS;C.checkAiBlock=function(def,fail,where){checkAi(def,fail,where,true)};

C.defineKind('aiProfiles',{
  label:'AI profile',
  required:['tier','weights','riskAversion','morale','tricks'],
  validate:function(def,fail){checkAi(def,fail,'',false)}
});
C.aiProfiles.registerAll([
  {id:'skirmisher',name:'Skirmisher',source:'original',
   description:'Light, fragile, cunning. Throws from cover, stabs and slips away, and runs when the fight turns.',
   tier:'cunning',
   weights:{damage:1.0,kill:1.6,risk:1.2,cover:0.6,retreatRoutes:0.5,resources:0.4},
   riskAversion:0.6,
   morale:{fleeBelowHp:0.5,fleeIfAlone:true,fleeIfAllyDefeated:'check'},
   tricks:['hit-and-run','throw-from-cover','hide-then-ambush','recover-daggers','focus-fire']},
  {id:'brute',name:'Brute',source:'original',
   description:'Hits hard and keeps coming. Barely weighs its own safety.',
   tier:'cunning',
   weights:{damage:1.2,kill:1.8,risk:0.8,cover:0.1,retreatRoutes:0.1,resources:0.2},
   riskAversion:0.25,
   morale:{fleeBelowHp:0.2,fleeIfAlone:false,fleeIfAllyDefeated:false},
   tricks:['focus-fire']},
  {id:'beast',name:'Beast',source:'original',
   description:'Instinct: goes for the nearest target and has no tricks.',
   tier:'instinct',
   weights:{damage:1.0,kill:1.2,risk:0.5,cover:0,retreatRoutes:0,resources:0},
   riskAversion:0.2,
   morale:{fleeBelowHp:0.25,fleeIfAlone:false,fleeIfAllyDefeated:false},
   tricks:[]}
]);
})();
