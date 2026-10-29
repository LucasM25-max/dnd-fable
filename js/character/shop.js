/* The Armory's rules (implementation plan, Phase 9). Pure: every function takes a build and returns a new one, like the inventory.

   Fable.character.shop.catalog(shopId, build)       [{item, name, description, priceCp, sellCp, owned, canAfford, canSell}] in the shop's order
   Fable.character.shop.victories(build, owned)      [{id, name, description, costCp, owned}] the victory animations the shop sells
   Fable.character.shop.buy(build, shopId, itemId, qty) / sell(build, shopId, itemId, qty)    the inventory result ({ok, build, reasons, paidCp / earnedCp})
   An item can only be bought from a shop that stocks it. A shop pays only for what it stocks, and never for what the hero has equipped. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable,Ch=Fable.character=Fable.character||{},S=Ch.shop={};

function shop(id){
  var s=Fable.content.shops&&Fable.content.shops.get(id);
  if(!s)throw new Error('Shop: there is no shop "'+id+'"');
  return s;
}
function priceCp(s,row){
  var it=Fable.content.items.get(row.item);
  return row.price?Fable.money.toCp(row.price):it.costCp;
}
function ownedOf(build,id){
  var n=0;(build.inventory||[]).forEach(function(e){if(e.item===id)n+=e.qty});return n;
}
function equippedCount(build,id){
  var n=0;Object.keys(build.equipped||{}).forEach(function(k){if(build.equipped[k]===id)n++});return n;
}
S.catalog=function(shopId,build){
  var s=shop(shopId),purse=Ch.inventory.purseCp(build),rate=s.sellRate===undefined?Ch.inventory.SELL_RATE:s.sellRate;
  return s.stock.map(function(row){
    var it=Fable.content.items.get(row.item),p=priceCp(s,row),owned=ownedOf(build,row.item),sell=Math.floor(p*rate);
    return {item:row.item,name:it.name,description:it.description,priceCp:p,sellCp:sell,owned:owned,canAfford:purse>=p,maxAffordable:p>0?Math.floor(purse/p):0,
      canSell:owned-equippedCount(build,row.item)>0};
  });
};
S.victories=function(build,owned){
  var reg=Fable.content.victoryAnimations;
  return (reg?reg.list():[]).filter(function(v){return v.cost}).map(function(v){
    var c=Fable.money.toCp(v.cost);
    return {id:v.id,name:v.name,description:v.description,costCp:c,owned:owned.indexOf(v.id)>=0,canAfford:Ch.inventory.purseCp(build)>=c};
  });
};
function row(s,itemId){
  for(var i=0;i<s.stock.length;i++)if(s.stock[i].item===itemId)return s.stock[i];
  return null;
}
S.buy=function(build,shopId,itemId,qty){
  var s=shop(shopId),r=row(s,itemId);
  if(!r)return {ok:false,build:build,reasons:['The '+s.name+' does not sell that']};
  return Ch.inventory.buy(build,itemId,qty===undefined?1:qty,{priceCp:priceCp(s,r)});
};
S.sell=function(build,shopId,itemId,qty){
  var s=shop(shopId),r=row(s,itemId);
  qty=qty===undefined?1:qty;
  if(!r)return {ok:false,build:build,reasons:['The '+s.name+' does not buy that']};
  if(ownedOf(build,itemId)-equippedCount(build,itemId)<qty)return {ok:false,build:build,reasons:['You cannot sell what you are holding or wearing']};
  var rate=s.sellRate===undefined?Ch.inventory.SELL_RATE:s.sellRate;
  return Ch.inventory.sell(build,itemId,qty,{priceCp:Math.floor(priceCp(s,r)*rate)});
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
