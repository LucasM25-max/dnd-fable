/* Lookups over the core rules tables: ability modifiers, proficiency bonus and character levels from XP.
   Pure: no DOM, no Three.js. The numbers live in content (rules-core/progression.js), not here, so rebalancing or
   adding levels is a data change. The ability modifier is the SRD formula, which matches the Ability Modifiers table
   for every score from 1 to 30 (the tests check each one). */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var T=Fable.tables={};

function need(kind){
  var C=Fable.content,reg=C&&C[kind];
  if(!reg||typeof reg.list!=='function')throw new Error('Tables: the "'+kind+'" rules table is not loaded yet (wait for Fable.content.whenReady)');
  return reg;
}
function isInt(n){return typeof n==='number'&&isFinite(n)&&Math.floor(n)===n}

/* Score 1 to 30 -> modifier, for example 17 -> 3, 8 -> -1, 1 -> -5. */
T.abilityModifier=function(score){
  if(!isInt(score)||score<1||score>30)throw new Error('Tables: an ability score must be a whole number from 1 to 30, got '+String(score));
  return Math.floor((score-10)/2);
};

/* Character levels, lowest first: [{level, xp, proficiencyBonus}, ...]. */
T.levels=function(){return need('levels').list()};
T.maxLevel=function(){var l=T.levels();return l[l.length-1].level};

function levelRow(level){
  if(!isInt(level))throw new Error('Tables: a level must be a whole number, got '+String(level));
  var row=need('levels').get('level-'+level);
  if(!row)throw new Error('Tables: there is no level '+level+' (levels run from 1 to '+T.maxLevel()+')');
  return row;
}

/* Total XP needed to be this level. Level 1 needs 0. */
T.xpForLevel=function(level){return levelRow(level).xp};

/* Highest level whose XP threshold the total reaches. Negative or fractional totals are rejected. */
T.levelForXp=function(xp){
  if(!isInt(xp)||xp<0)throw new Error('Tables: XP must be a whole number of 0 or more, got '+String(xp));
  var levels=T.levels(),lv=levels[0].level;
  for(var i=0;i<levels.length;i++)if(xp>=levels[i].xp)lv=levels[i].level;
  return lv;
};

/* Where an XP total sits: {level, xp, levelStartXp, nextLevelXp (null at the top), intoLevel, neededForNext (null at the top), fraction 0..1}.
   Drives the XP bar on the results screen. At the maximum level the bar is full. */
T.xpProgress=function(xp){
  var lv=T.levelForXp(xp),start=T.xpForLevel(lv),next=lv<T.maxLevel()?T.xpForLevel(lv+1):null;
  return {
    level:lv,xp:xp,levelStartXp:start,nextLevelXp:next,
    intoLevel:xp-start,
    neededForNext:next===null?null:next-xp,
    fraction:next===null?1:(xp-start)/(next-start)
  };
};

/* Proficiency bonus for a character level (1 to 20) or a monster Challenge Rating (0 to 30, fractions such as 0.125 allowed). */
T.proficiencyBonus=function(levelOrCr){
  if(typeof levelOrCr!=='number'||!isFinite(levelOrCr)||levelOrCr<0||levelOrCr>30)
    throw new Error('Tables: a level or Challenge Rating must be a number from 0 to 30, got '+String(levelOrCr));
  var bands=need('proficiencyBands').list(),whole=Math.floor(levelOrCr);
  for(var i=0;i<bands.length;i++)if(whole>=bands[i].min&&whole<=bands[i].max)return bands[i].bonus;
  throw new Error('Tables: no proficiency bonus band covers '+levelOrCr);
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
