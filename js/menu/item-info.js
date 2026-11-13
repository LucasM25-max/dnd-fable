/* What an item is, in words: the icon that stands in for it, its kind line and its statistics. The Store (js/menu/shop-ui.js) and the Collection
   (js/menu/collection-ui.js) both show items this way, so a sword reads the same in both.

   Fable.itemInfo.titleCase(text)    'light-armor' -> 'Light Armor'
   Fable.itemInfo.iconFor(item)      the name of a Fable.hudIcons glyph
   Fable.itemInfo.kindLine(item)     'Martial weapon', 'Heavy armor', 'Magic item' ...
   Fable.itemInfo.statsOf(item)      [[label, value], ...] for the details panel */
(function(){
Fable.itemInfo=(function(){
function iconFor(it){
  if(!it)return 'book';
  if(it.id==='potion-of-healing'||(it.use&&it.use.icon==='potion'))return 'potion';
  if(it.type==='armor')return 'guard';
  if(it.id==='dagger')return 'dagger';
  if(it.id==='javelin'||it.id==='spear')return 'javelin';
  if(it.type==='weapon')return 'sword';
  if(/^spell-scroll/.test(it.id))return 'scroll';
  if(it.type==='tool')return 'gear';
  if(it.type==='pack')return 'pickup';
  if(it.magic)return 'star';
  return 'book';
}
function titleCase(s){return String(s||'').replace(/(^|[-\s])(\w)/g,function(m,a,c){return (a?' ':'')+c.toUpperCase()})}
function kindLine(it){
  if(!it)return '';
  if(it.type==='weapon')return titleCase(it.category)+' weapon';
  if(it.type==='armor')return it.category==='shield'?'Shield':titleCase(it.category)+' armor';
  if(it.magic)return 'Magic item';
  return titleCase(it.type);
}
function statsOf(it){
  var out=[];
  if(!it)return out;
  if(it.type==='weapon'&&it.damage){
    out.push(['Damage',it.damage.dice+' '+it.damage.type]);
    if(it.versatile)out.push(['Two handed',(it.versatile.dice||it.versatile)+'']);
    if(it.range)out.push(['Range',it.range.normal+' / '+it.range.long+' ft']);
    if(it.properties&&it.properties.length)out.push(['Properties',it.properties.map(titleCase).join(', ')]);
    if(it.mastery)out.push(['Mastery',titleCase(it.mastery)]);
  }else if(it.type==='armor'&&it.ac){
    out.push(['Armor Class',it.ac.bonus?'+'+it.ac.bonus:String(it.ac.base)+(it.ac.dex==='full'?' + Dex':it.ac.dex==='cap'?' + Dex (max '+(it.ac.dexCap||2)+')':'')]);
    if(it.stealthDisadvantage)out.push(['Stealth','Disadvantage']);
    if(it.strengthRequirement)out.push(['Strength',String(it.strengthRequirement)]);
  }else if(it.use&&it.use.text){
    out.push(['Use',it.use.cost==='bonus'?'Bonus Action':titleCase(it.use.cost)]);
    out.push(['Effect',it.use.text.replace(/^Drink the potion as a Bonus Action to /,'').replace(/^./,function(c){return c.toUpperCase()})]);
  }
  if(it.type==='pack'&&it.contents&&it.contents.length){
    var C=Fable.content;
    out.push(['Holds',it.contents.map(function(c){var d=C&&C.items&&C.items.get(c.item);return (c.qty>1?c.qty+' ':'')+(d?d.name:c.item)}).join(', ')]);
  }
  if(it.amount>1)out.push(['Sold as','A bundle of '+it.amount]);
  if(it.uses>1)out.push(['Uses',String(it.uses)]);
  if(it.weight!==undefined)out.push(['Weight',it.weight+' lb'+(it.amount>1?' a bundle':'')]);
  return out;
}

return {titleCase:titleCase,iconFor:iconFor,kindLine:kindLine,statsOf:statsOf};
})();
})();
