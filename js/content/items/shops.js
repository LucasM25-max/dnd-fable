/* Shops (implementation plan, section 17 and Phase 9): what a shop sells, in order, and what it pays when the hero sells back.
     stock       [{item, price?}] listed top to bottom; price is a coin object ({gp:60}) that replaces the item's own price
     sellRate    the share of an item's price the shop pays when the hero sells it back (0 to 1)
     victories   true when the shop also sells victory animations (Fable.content.victoryAnimations that have a cost)
   The first thing in the Store is the Potion of Healing at 50 gp, the price the first fight's gold is meant to buy. The shop's id stays
   'armory' so saved games and tests keep working; only its name is shown to the player. */
(function(){
var C=Fable.content;
C.defineKind('shops',{
  label:'Shop',required:['stock'],
  refs:[{path:'stock.*.item',kind:'items'}],
  validate:function(d,fail){
    if(!Array.isArray(d.stock)||!d.stock.length)fail('stock must be a non empty list');
    else d.stock.forEach(function(e,i){
      if(!e||typeof e.item!=='string'||!e.item)fail('stock['+i+'] needs an item id');
      if(e&&e.price!==undefined){var why=Fable.money.checkCost(e.price);if(why)fail('stock['+i+'].price: '+why)}
      if(d.stock.some(function(o,j){return j<i&&e&&o.item===e.item}))fail('stock lists "'+(e&&e.item)+'" twice');
    });
    if(d.sellRate!==undefined&&!(typeof d.sellRate==='number'&&d.sellRate>=0&&d.sellRate<=1))fail('sellRate must be between 0 and 1');
  }
});
C.shops.register({
  id:'armory',name:'The Store',source:'original',
  description:'Potions, weapons and armor for the road. The quartermaster pays half for anything you sell back.',
  sellRate:.5,victories:true,
  stock:[
    {item:'potion-of-healing'},   /* 50 gp */
    {item:'javelin'},
    {item:'dagger'},
    {item:'handaxe'},
    {item:'mace'},
    {item:'spear'},
    {item:'leather-armor'},
    {item:'chain-shirt'},
    {item:'shield'}
  ]
});
})();
