/* The economy: how an encounter turns into gold (implementation plan, section 17). Pure data, so the whole economy can be rebalanced
   without touching code, and a second economy (a harder campaign, an event) is one more row.

     goldPerXp     gold per point of XP before anything else (1 means 1 gp per XP)
     tiers         difficulty tiers lowest first: the multiplier on the gold, and which budget column decides the tier.
                   A fight belongs to the first tier whose budget its total XP fits inside; above every budget is the last tier.
     budgets       the XP budget for one character of each level (the 2024 encounter guidelines): low, moderate and high. A party's
                   budget is the sum over its characters.
     bonuses       performance bonuses, each a percent added to the gold when the rule holds:
                     hp-above           the hero finishes above this fraction of their hit points
                     rounds-within-par  the fight ends within the encounter's par rounds (rewards.par.rounds)
                     no-consumables     no consumable item was used
   Multipliers and percents are written as decimals and percents here; rewards.js turns them into whole numbers before it multiplies, so
   the same inputs always give the same gold and a half never rounds the wrong way. */
(function(){
var C=Fable.content;
C.defineKind('economies',{
  label:'Economy',
  required:['goldPerXp','tiers','budgets','bonuses'],
  validate:function(d,fail){
    function whole(n,scale){return typeof n==='number'&&isFinite(n)&&Math.abs(n*scale-Math.round(n*scale))<1e-9}
    if(typeof d.goldPerXp!=='number'||!(d.goldPerXp>=0)||!whole(d.goldPerXp,100))fail('goldPerXp must be a number of 0 or more with at most two decimals');
    if(!Array.isArray(d.tiers)||d.tiers.length<2)fail('tiers needs at least two tiers, lowest first');
    else d.tiers.forEach(function(t,i){
      if(!t||typeof t.id!=='string'||!t.id||typeof t.name!=='string'||!t.name)fail('tiers['+i+'] needs an id and a name');
      if(typeof t.multiplier!=='number'||!(t.multiplier>=0)||!whole(t.multiplier,100))fail('tiers['+i+'].multiplier must be a number of 0 or more with at most two decimals');
      var last=i===d.tiers.length-1;
      if(last){if(t.budget!==undefined&&t.budget!==null)fail('the last tier has no budget: it is everything above the one before')}
      else if(['low','moderate','high'].indexOf(t.budget)<0)fail('tiers['+i+'].budget must be low, moderate or high');
    });
    if(!Array.isArray(d.budgets)||!d.budgets.length)fail('budgets needs a row for each character level');
    else d.budgets.forEach(function(b,i){
      if(!b||!Number.isInteger(b.level)||b.level<1||b.level>20)fail('budgets['+i+'].level must be a whole number from 1 to 20');
      ['low','moderate','high'].forEach(function(k){if(!Number.isInteger(b[k])||b[k]<0)fail('budgets['+i+'].'+k+' must be a whole number of 0 or more')});
      if(b.low>b.moderate||b.moderate>b.high)fail('budgets['+i+'] must rise from low to moderate to high');
      if(d.budgets.some(function(o,j){return j<i&&o.level===b.level}))fail('budgets lists level '+b.level+' twice');
    });
    var RULES=['hp-above','rounds-within-par','no-consumables'];
    if(!Array.isArray(d.bonuses))fail('bonuses must be a list');
    else d.bonuses.forEach(function(b,i){
      if(!b||typeof b.id!=='string'||!b.id||typeof b.name!=='string'||!b.name)fail('bonuses['+i+'] needs an id and a name');
      if(!b||!Number.isInteger(b.percent)||b.percent<0||b.percent>100)fail('bonuses['+i+'].percent must be a whole number from 0 to 100');
      if(!b||RULES.indexOf(b.rule)<0)fail('bonuses['+i+'].rule must be one of '+RULES.join(', '));
      if(b&&b.rule==='hp-above'&&!(typeof b.fraction==='number'&&b.fraction>0&&b.fraction<1))fail('bonuses['+i+'] (hp-above) needs a fraction between 0 and 1');
      if(b&&typeof b.text!=='string')fail('bonuses['+i+'] needs text that says what earns it');
    });
  }
});
C.economies.register({
  id:'standard',name:'Standard economy',source:'original',
  goldPerXp:1,
  tiers:[
    {id:'low',name:'Low',multiplier:1,budget:'low'},
    {id:'moderate',name:'Moderate',multiplier:1.1,budget:'moderate'},
    {id:'high',name:'High',multiplier:1.25,budget:'high'},
    {id:'deadly',name:'Deadly',multiplier:1.5}
  ],
  /* XP budget per character, by character level (2024 encounter guidelines: Low, Moderate, High) */
  budgets:[
    {level:1,low:50,moderate:75,high:100},{level:2,low:100,moderate:150,high:200},{level:3,low:150,moderate:225,high:400},
    {level:4,low:250,moderate:375,high:500},{level:5,low:500,moderate:750,high:1100},{level:6,low:600,moderate:1000,high:1400},
    {level:7,low:750,moderate:1300,high:1700},{level:8,low:1000,moderate:1700,high:2100},{level:9,low:1300,moderate:2000,high:2600},
    {level:10,low:1600,moderate:2300,high:3100},{level:11,low:1900,moderate:2900,high:4100},{level:12,low:2200,moderate:3700,high:4700},
    {level:13,low:2600,moderate:4200,high:5400},{level:14,low:2900,moderate:4900,high:6200},{level:15,low:3300,moderate:5400,high:7800},
    {level:16,low:3800,moderate:6100,high:9800},{level:17,low:4500,moderate:7200,high:11700},{level:18,low:5000,moderate:8700,high:14200},
    {level:19,low:5500,moderate:10700,high:17200},{level:20,low:6400,moderate:13200,high:22000}
  ],
  bonuses:[
    {id:'steady',name:'Steady',percent:10,rule:'hp-above',fraction:.5,text:'Finish with more than half your hit points'},
    {id:'swift',name:'Swift',percent:10,rule:'rounds-within-par',text:'Finish within the encounter\'s par rounds'},
    {id:'resourceful',name:'Resourceful',percent:5,rule:'no-consumables',text:'Use no consumable items'}
  ]
});
})();
